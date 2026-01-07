import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { format, eachDayOfInterval } from "date-fns";
import { computeEffectiveAvailability } from "@/lib/utils/availability-expander";
import { generateTimeSlots, addThirtyMinutes } from "@/lib/utils/time-slots";

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
    const participantsData = event.participants.map((participant) => {
      // Convert database records to the right format
      const patterns = participant.generalAvailability.map((p) => ({
        dayOfWeek: p.dayOfWeek,
        startTime: p.startTime,
        endTime: p.endTime,
      }));

      const specificSlots = participant.availability.map((a) => ({
        date: format(a.date, "yyyy-MM-dd"),
        startTime: a.startTime,
        endTime: a.endTime,
      }));

      const exceptions = participant.exceptions.map((e) => ({
        date: format(e.date, "yyyy-MM-dd"),
        startTime: e.startTime,
        endTime: e.endTime,
      }));

      // Compute effective availability for the full date range
      const effectiveAvailability = computeEffectiveAvailability(
        patterns,
        specificSlots,
        exceptions,
        rangeStart,
        rangeEnd,
        earliestTime,
        latestTime
      );

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
