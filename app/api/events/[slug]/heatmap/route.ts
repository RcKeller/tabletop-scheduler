import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { startOfWeek, endOfWeek, format, addDays } from "date-fns";
import { computeEffectiveAvailability } from "@/lib/utils/availability-expander";
import { generateTimeSlots, addThirtyMinutes } from "@/lib/utils/time-slots";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const weekStartParam = searchParams.get("weekStart");

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

    // Determine the week to show
    let weekStart: Date;
    if (weekStartParam) {
      weekStart = startOfWeek(new Date(weekStartParam), { weekStartsOn: 0 });
    } else if (event.startDate) {
      weekStart = startOfWeek(event.startDate, { weekStartsOn: 0 });
    } else {
      weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    }

    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

    // Generate week dates
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      weekDates.push(format(addDays(weekStart, i), "yyyy-MM-dd"));
    }

    // Get time window settings
    const earliestTime = event.earliestTime || "00:00";
    const latestTime = event.latestTime || "23:30";

    // Build availability data for each participant
    // This now combines patterns + specific slots - exceptions
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

      // Compute effective availability for this week
      const effectiveAvailability = computeEffectiveAvailability(
        patterns,
        specificSlots,
        exceptions,
        weekStart,
        weekEnd,
        earliestTime,
        latestTime
      );

      // Filter to only include slots within this week
      const weekAvailability = effectiveAvailability.filter((slot) =>
        weekDates.includes(slot.date)
      );

      return {
        id: participant.id,
        name: participant.displayName,
        availability: weekAvailability,
      };
    });

    // Calculate heatmap cells
    const heatmapData: Record<string, { count: number; participantIds: string[] }> = {};

    // Generate time slots using shared utility
    const timeSlots = generateTimeSlots(earliestTime, latestTime);

    // Initialize all slots
    for (const date of weekDates) {
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
      weekStart: weekStart.toISOString(),
      weekDates,
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
