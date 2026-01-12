import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { format, eachDayOfInterval } from "date-fns";
import { expandPatternsToSlots, mergeOverlappingSlots } from "@/lib/utils/availability-expander";
import { generateTimeSlots, addThirtyMinutes } from "@/lib/utils/time-slots";
import { localToUTC } from "@/lib/utils/timezone";
import { computeEffectiveAvailabilityWithPriority } from "@/lib/utils/availability-priority";

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
    // Priority: Manual calendar > Unavailable patterns > Available patterns
    // IMPORTANT: Patterns are stored in participant's local timezone, specific slots and exceptions are in UTC
    const participantsData = event.participants.map((participant) => {
      const participantTimezone = participant.timezone || "UTC";

      // Helper to expand patterns and convert to UTC
      const expandAndConvertToUTC = (patterns: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) => {
        const expanded = expandPatternsToSlots(patterns, rangeStart, rangeEnd);
        const inUTC: Array<{ date: string; startTime: string; endTime: string }> = [];

        for (const slot of expanded) {
          const start = localToUTC(slot.startTime, slot.date, participantTimezone);
          const end = localToUTC(slot.endTime, slot.date, participantTimezone);

          if (start.date === end.date) {
            if (start.time < end.time) {
              inUTC.push({
                date: start.date,
                startTime: start.time,
                endTime: end.time,
              });
            }
          } else {
            // Slot crosses midnight when converted to UTC - split into two slots
            inUTC.push({
              date: start.date,
              startTime: start.time,
              endTime: "23:59",
            });
            inUTC.push({
              date: end.date,
              startTime: "00:00",
              endTime: end.time,
            });
          }
        }
        return inUTC;
      };

      // Separate patterns into available and unavailable
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

      // Expand patterns and convert to UTC
      const availablePatternsInUTC = expandAndConvertToUTC(availablePatterns);
      const unavailablePatternsInUTC = expandAndConvertToUTC(unavailablePatterns);

      // Specific slots are already in UTC (manual calendar additions)
      const manualAdditions = participant.availability.map((a) => ({
        date: format(a.date, "yyyy-MM-dd"),
        startTime: a.startTime,
        endTime: a.endTime,
      }));

      // Exceptions are already in UTC (manual calendar removals)
      const manualRemovals = participant.exceptions.map((e) => ({
        date: format(e.date, "yyyy-MM-dd"),
        startTime: e.startTime,
        endTime: e.endTime,
      }));

      // Use the priority-based algorithm:
      // Priority: Manual > Unavailable patterns > Available patterns
      const effectiveSlots = computeEffectiveAvailabilityWithPriority(
        availablePatternsInUTC,
        unavailablePatternsInUTC,
        manualAdditions,
        manualRemovals
      );

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
        // Skip invalid slots where start >= end
        if (slot.startTime >= slot.endTime) continue;

        let currentTime = slot.startTime;
        let iterations = 0;
        const maxIterations = 48; // Max 48 half-hour slots in a day

        while (currentTime < slot.endTime && iterations < maxIterations) {
          const key = `${slot.date}-${currentTime}`;
          if (heatmapData[key]) {
            heatmapData[key].count++;
            heatmapData[key].participantIds.push(participant.id);
          }

          // Increment by 30 minutes
          currentTime = addThirtyMinutes(currentTime);
          iterations++;
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
