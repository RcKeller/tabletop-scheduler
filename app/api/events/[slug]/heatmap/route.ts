import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { format, eachDayOfInterval, isValid } from "date-fns";
import {
  computeEffectiveRanges,
  rangesToSlots,
  timeToMinutes,
  minutesToTime,
  SLOT_DURATION_MINUTES,
} from "@/lib/availability";
import type { AvailabilityRule, DateRange } from "@/lib/types/availability";

// Generate time slots between start and end times
function generateTimeSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  let startMins = timeToMinutes(start);
  let endMins = timeToMinutes(end);

  // Handle overnight
  if (endMins <= startMins && end !== start) {
    endMins += 24 * 60;
  }

  for (let mins = startMins; mins < endMins; mins += SLOT_DURATION_MINUTES) {
    slots.push(minutesToTime(mins));
  }

  return slots;
}

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
            availabilityRules: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Use full event date range (or default to today if not set)
    const rangeStart = event.startDate ? new Date(event.startDate) : new Date();
    const rangeEnd = event.endDate ? new Date(event.endDate) : rangeStart;

    // Validate dates
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      console.error("Invalid event dates:", { startDate: event.startDate, endDate: event.endDate });
      return NextResponse.json({ error: "Invalid event date configuration" }, { status: 500 });
    }

    // Generate all dates in the range
    const allDates = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    const dateStrings = allDates.map(d => format(d, "yyyy-MM-dd"));

    // Get time window settings
    const earliestTime = event.earliestTime || "00:00";
    const latestTime = event.latestTime || "23:30";

    // Debug mode
    const debugMode = request.nextUrl.searchParams.get("debug") === "true";
    const debugInfo: Record<string, unknown> = {};

    // Date range for computing availability
    // Expand by ±1 day to handle timezone shifts - a local day might need UTC
    // data from the day before (eastern TZ) or after (western TZ)
    const expandedStart = new Date(rangeStart);
    expandedStart.setDate(expandedStart.getDate() - 1);
    const expandedEnd = new Date(rangeEnd);
    expandedEnd.setDate(expandedEnd.getDate() + 1);

    const dateRange: DateRange = {
      startDate: format(expandedStart, "yyyy-MM-dd"),
      endDate: format(expandedEnd, "yyyy-MM-dd"),
    };

    // Build availability data for each participant using new rules system
    const participantsData = event.participants.map((participant) => {
      // Convert Prisma rules to AvailabilityRule type
      const rules: AvailabilityRule[] = participant.availabilityRules.map((r) => ({
        id: r.id,
        participantId: r.participantId,
        ruleType: r.ruleType as AvailabilityRule["ruleType"],
        dayOfWeek: r.dayOfWeek,
        specificDate: r.specificDate ? format(r.specificDate, "yyyy-MM-dd") : null,
        startTime: r.startTime,
        endTime: r.endTime,
        originalTimezone: r.originalTimezone,
        originalDayOfWeek: r.originalDayOfWeek,
        reason: r.reason,
        source: r.source as AvailabilityRule["source"],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      // Compute effective availability using new algorithm
      const effectiveRanges = computeEffectiveRanges(rules, dateRange);

      // Convert ranges to slots for heatmap
      const availability: { date: string; startTime: string; endTime: string }[] = [];
      for (const [date, dayAvail] of effectiveRanges) {
        for (const range of dayAvail.availableRanges) {
          availability.push({
            date,
            startTime: minutesToTime(range.startMinutes),
            endTime: minutesToTime(range.endMinutes),
          });
        }
      }

      if (debugMode && participant.isGm) {
        debugInfo.gmParticipant = {
          id: participant.id,
          displayName: participant.displayName,
          rulesCount: rules.length,
          effectiveRangesCount: availability.length,
        };
      }

      return {
        id: participant.id,
        name: participant.displayName,
        isGm: participant.isGm,
        availability,
      };
    });

    // Find GM participant for calculating time bounds
    const gmParticipant = participantsData.find(p => p.isGm);
    const eventTimezone = event.timezone || "UTC";

    if (debugMode) {
      debugInfo.eventTimezone = eventTimezone;
    }

    // Calculate heatmap cells
    const heatmapData: Record<string, { count: number; participantIds: string[] }> = {};

    // Generate time slots for the FULL day
    const fullDaySlots = generateTimeSlots("00:00", "23:30");

    // Initialize all slots for full day
    for (const date of dateStrings) {
      for (const time of fullDaySlots) {
        const key = `${date}-${time}`;
        heatmapData[key] = { count: 0, participantIds: [] };
      }
    }

    // Fill in availability
    // Rules are stored in UTC, heatmap is displayed in event timezone
    // For now, we're treating the stored times as already in the correct timezone
    // (since the migration preserved the original data which was already in event timezone)
    for (const participant of participantsData) {
      for (const slot of participant.availability) {
        const startMins = timeToMinutes(slot.startTime);
        const endMins = timeToMinutes(slot.endTime);

        // Skip invalid slots
        if (slot.startTime === slot.endTime) continue;
        if (startMins >= endMins) continue;

        // Expand to 30-min slots
        for (let mins = startMins; mins < endMins; mins += SLOT_DURATION_MINUTES) {
          const time = minutesToTime(mins);
          const key = `${slot.date}-${time}`;

          if (heatmapData[key]) {
            heatmapData[key].count++;
            heatmapData[key].participantIds.push(participant.id);
          }
        }
      }
    }

    // Calculate effective time bounds based on GM's availability only
    let effectiveEarliest: string | null = null;
    let effectiveLatest: string | null = null;

    if (gmParticipant && gmParticipant.availability.length > 0) {
      const startTimes: string[] = [];
      const endTimes: string[] = [];

      for (const slot of gmParticipant.availability) {
        if (slot.startTime >= slot.endTime) continue;
        startTimes.push(slot.startTime);
        endTimes.push(slot.endTime);
      }

      if (startTimes.length > 0) {
        startTimes.sort();
        endTimes.sort();
        effectiveEarliest = startTimes[0];
        effectiveLatest = endTimes[endTimes.length - 1];
      }
    }

    // Use effective bounds if available, otherwise fall back to configured bounds
    const displayEarliest = effectiveEarliest || earliestTime;
    const displayLatest = effectiveLatest || latestTime;

    // Generate the final time slots for the effective range
    const timeSlots = generateTimeSlots(displayEarliest, displayLatest);

    if (debugMode) {
      debugInfo.finalBounds = {
        effectiveEarliest,
        effectiveLatest,
        displayEarliest,
        displayLatest,
      };
    }

    const response = NextResponse.json({
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startDate: event.startDate?.toISOString() || null,
        endDate: event.endDate?.toISOString() || null,
        earliestTime: displayEarliest,
        latestTime: displayLatest,
        sessionLengthMinutes: event.sessionLengthMinutes,
        timezone: eventTimezone,
      },
      gmAvailability: gmParticipant ? {
        name: gmParticipant.name,
        earliestTime: effectiveEarliest,
        latestTime: effectiveLatest,
        timezone: eventTimezone,
      } : null,
      dates: dateStrings,
      timeSlots,
      participants: participantsData,
      heatmap: heatmapData,
      totalParticipants: participantsData.length,
      ...(debugMode && { _debug: debugInfo }),
    });

    response.headers.set("Cache-Control", "public, s-maxage=1, stale-while-revalidate=5");

    return response;
  } catch (error) {
    console.error("Error fetching heatmap data:", error);
    console.error("Stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      { error: "Failed to fetch heatmap data", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
