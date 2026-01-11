import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { format, eachDayOfInterval } from "date-fns";
import { expandPatternsToSlots, mergeOverlappingSlots, applyExceptions } from "@/lib/utils/availability-expander";
import { generateTimeSlots, addThirtyMinutes } from "@/lib/utils/time-slots";
import { localToUTC } from "@/lib/utils/timezone";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        participants: {
          include: {
            availability: true,
            generalAvailability: true,
            exceptions: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Use full event date range (or default to today if not set)
    const rangeStart = event.startDate || new Date();
    const rangeEnd = event.endDate || rangeStart;

    // Generate all dates in the range
    const allDates = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    const dateStrings = allDates.map(d => format(d, "yyyy-MM-dd"));

    // Get time window settings
    const earliestTime = event.earliestTime || "00:00";
    const latestTime = event.latestTime || "23:30";

    // Build availability data for each participant
    // This combines patterns + specific slots - exceptions for the full date range
    // IMPORTANT: Patterns are stored in participant's local timezone, specific slots and exceptions are in UTC
    const participantsData = event.participants.map((participant) => {
      const participantTimezone = participant.timezone || "UTC";

      // Separate patterns into available and unavailable (blocked times)
      const availablePatterns = participant.generalAvailability
        .filter((p) => p.isAvailable !== false)
        .map((p) => ({
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        }));

      const unavailablePatterns = participant.generalAvailability
        .filter((p) => p.isAvailable === false)
        .map((p) => ({
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        }));

      // Specific slots are already in UTC
      const specificSlots = participant.availability.map((a) => ({
        date: format(a.date, "yyyy-MM-dd"),
        startTime: a.startTime,
        endTime: a.endTime,
      }));

      // Exceptions are already in UTC
      const exceptions = participant.exceptions.map((e) => ({
        date: format(e.date, "yyyy-MM-dd"),
        startTime: e.startTime,
        endTime: e.endTime,
      }));

      // Expand AVAILABLE patterns to specific slots (patterns are in local timezone)
      const expandedAvailablePatterns = expandPatternsToSlots(
        availablePatterns,
        rangeStart,
        rangeEnd
      );

      // Convert expanded available patterns from participant's local timezone to UTC
      // Handle slots that cross midnight when converted
      const availablePatternsInUTC: Array<{ date: string; startTime: string; endTime: string }> = [];
      for (const slot of expandedAvailablePatterns) {
        const start = localToUTC(slot.startTime, slot.date, participantTimezone);
        const end = localToUTC(slot.endTime, slot.date, participantTimezone);

        if (start.date === end.date) {
          // Same day - simple case
          if (start.time < end.time) {
            availablePatternsInUTC.push({
              date: start.date,
              startTime: start.time,
              endTime: end.time,
            });
          }
        } else {
          // Slot crosses midnight when converted to UTC - split into two slots
          availablePatternsInUTC.push({
            date: start.date,
            startTime: start.time,
            endTime: "23:59",
          });
          availablePatternsInUTC.push({
            date: end.date,
            startTime: "00:00",
            endTime: end.time,
          });
        }
      }

      // Expand UNAVAILABLE patterns to specific slots (these become recurring blocked times)
      const expandedUnavailablePatterns = expandPatternsToSlots(
        unavailablePatterns,
        rangeStart,
        rangeEnd
      );

      // Convert unavailable patterns from participant's local timezone to UTC
      // Handle slots that cross midnight when converted
      const blockedPatternsInUTC: Array<{ date: string; startTime: string; endTime: string }> = [];
      for (const slot of expandedUnavailablePatterns) {
        const start = localToUTC(slot.startTime, slot.date, participantTimezone);
        const end = localToUTC(slot.endTime, slot.date, participantTimezone);

        if (start.date === end.date) {
          // Same day - simple case
          if (start.time < end.time) {
            blockedPatternsInUTC.push({
              date: start.date,
              startTime: start.time,
              endTime: end.time,
            });
          }
        } else {
          // Slot crosses midnight when converted to UTC - split into two slots
          blockedPatternsInUTC.push({
            date: start.date,
            startTime: start.time,
            endTime: "23:59",
          });
          blockedPatternsInUTC.push({
            date: end.date,
            startTime: "00:00",
            endTime: end.time,
          });
        }
      }

      // Combine UTC available patterns with UTC specific slots
      const allSlots = [...availablePatternsInUTC, ...specificSlots];

      // Combine stored exceptions with blocked pattern exceptions
      const allExceptions = [...exceptions, ...blockedPatternsInUTC];

      // Apply ALL exceptions (both stored and from unavailable patterns)
      const effectiveSlots = applyExceptions(allSlots, allExceptions);

      // Merge overlapping slots
      const effectiveAvailability = mergeOverlappingSlots(effectiveSlots);

      return {
        id: participant.id,
        name: participant.displayName,
        availability: effectiveAvailability,
      };
    });

    // Calculate heatmap cells
    const heatmapData: Record<string, { count: number; participantIds: string[] }> = {};

    // Generate time slots using shared utility
    const timeSlots = generateTimeSlots(earliestTime, latestTime);

    // Initialize all slots
    for (const date of dateStrings) {
      for (const time of timeSlots) {
        const key = `${date}-${time}`;
        heatmapData[key] = { count: 0, participantIds: [] };
      }
    }

    // Fill in availability
    for (const participant of participantsData) {
      for (const slot of participant.availability) {
        let currentTime = slot.startTime;
        while (currentTime < slot.endTime) {
          const key = `${slot.date}-${currentTime}`;
          if (heatmapData[key]) {
            heatmapData[key].count++;
            heatmapData[key].participantIds.push(participant.id);
          }

          // Increment by 30 minutes
          currentTime = addThirtyMinutes(currentTime);
        }
      }
    }

    const response = NextResponse.json({
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startDate: event.startDate?.toISOString() || null,
        endDate: event.endDate?.toISOString() || null,
        earliestTime: event.earliestTime,
        latestTime: event.latestTime,
        sessionLengthMinutes: event.sessionLengthMinutes,
      },
      dates: dateStrings,
      timeSlots,
      participants: participantsData,
      heatmap: heatmapData,
      totalParticipants: participantsData.length,
    });

    // Add cache headers for short-term caching (5 seconds stale-while-revalidate)
    response.headers.set("Cache-Control", "public, s-maxage=1, stale-while-revalidate=5");

    return response;
  } catch (error) {
    console.error("Error fetching heatmap data:", error);
    return NextResponse.json(
      { error: "Failed to fetch heatmap data" },
      { status: 500 }
    );
  }
}
