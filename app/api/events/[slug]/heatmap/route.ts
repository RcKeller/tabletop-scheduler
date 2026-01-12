import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { format, eachDayOfInterval, isValid } from "date-fns";
import { expandPatternsToSlots, mergeOverlappingSlots } from "@/lib/utils/availability-expander";
import { generateTimeSlots, addThirtyMinutes, parseTimeToMinutes } from "@/lib/utils/time-slots";
import { localToUTC, utcToLocal } from "@/lib/utils/timezone";
import { computeEffectiveAvailabilityWithPriority } from "@/lib/utils/availability-priority";
// New availability system imports
import {
  computeHeatmap as computeHeatmapNew,
  computeEffectiveRanges,
  rangesToSlots,
} from "@/lib/availability";
import type { AvailabilityRule } from "@/lib/types/availability";

// Safely format a date, handling invalid dates
function safeFormatDate(date: unknown): string | null {
  try {
    if (date instanceof Date && isValid(date)) {
      return format(date, "yyyy-MM-dd");
    }
    if (typeof date === "string") {
      const parsed = new Date(date);
      if (isValid(parsed)) {
        return format(parsed, "yyyy-MM-dd");
      }
    }
    console.error("Invalid date encountered:", date);
    return null;
  } catch (e) {
    console.error("Error formatting date:", date, e);
    return null;
  }
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
    // Ensure dates are valid Date objects
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

    // Build availability data for each participant
    // This combines patterns + specific slots - exceptions for the full date range
    // Priority: Manual calendar > Unavailable patterns > Available patterns
    // IMPORTANT: Patterns are stored in participant's local timezone, specific slots and exceptions are in UTC
    // Check for debug mode
    const debugMode = request.nextUrl.searchParams.get("debug") === "true";
    const debugInfo: Record<string, unknown> = {};

    const participantsData = event.participants.map((participant) => {
      // Log debug info for GM
      if (debugMode && participant.isGm) {
        debugInfo.gmParticipant = {
          id: participant.id,
          displayName: participant.displayName,
          patterns: participant.generalAvailability.map(p => ({
            dayOfWeek: p.dayOfWeek,
            startTime: p.startTime,
            endTime: p.endTime,
            isAvailable: p.isAvailable,
          })),
        };
      }

      // Expand patterns to specific dates
      // NOTE: Patterns are now stored in UTC, so no timezone conversion needed
      const expandPatternsToUTCSlots = (patterns: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) => {
        const expanded = expandPatternsToSlots(patterns, rangeStart, rangeEnd);
        // Patterns are already in UTC, just filter valid slots
        return expanded.filter(slot => slot.startTime < slot.endTime);
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
      const availablePatternsInUTC = expandPatternsToUTCSlots(availablePatterns);
      const unavailablePatternsInUTC = expandPatternsToUTCSlots(unavailablePatterns);

      // Specific slots are already in UTC (manual calendar additions)
      // Handle both Date objects and string dates, filter out invalid entries
      const manualAdditions = participant.availability
        .map((a) => {
          const dateStr = safeFormatDate(a.date);
          if (!dateStr) {
            console.error("Skipping invalid availability entry for participant", participant.id, a);
            return null;
          }
          return {
            date: dateStr,
            startTime: a.startTime,
            endTime: a.endTime,
          };
        })
        .filter((a): a is { date: string; startTime: string; endTime: string } => a !== null);

      // Exceptions are already in UTC (manual calendar removals)
      // Handle both Date objects and string dates, filter out invalid entries
      const manualRemovals = participant.exceptions
        .map((e) => {
          const dateStr = safeFormatDate(e.date);
          if (!dateStr) {
            console.error("Skipping invalid exception entry for participant", participant.id, e);
            return null;
          }
          return {
            date: dateStr,
            startTime: e.startTime,
            endTime: e.endTime,
          };
        })
        .filter((e): e is { date: string; startTime: string; endTime: string } => e !== null);

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

      // Log debug info for GM's UTC slots
      if (debugMode && participant.isGm) {
        debugInfo.gmUTCSlots = effectiveAvailability.slice(0, 10); // First 10 for brevity
        debugInfo.gmUTCSlotsCount = effectiveAvailability.length;
      }

      return {
        id: participant.id,
        name: participant.displayName,
        isGm: participant.isGm,
        availability: effectiveAvailability,
      };
    });

    // Find GM participant for calculating time bounds
    const gmParticipant = participantsData.find(p => p.isGm);

    if (debugMode) {
      debugInfo.eventTimezone = event.timezone;
      debugInfo.effectiveEventTimezone = event.timezone || "UTC";
    }

    // Calculate heatmap cells
    const heatmapData: Record<string, { count: number; participantIds: string[] }> = {};

    // Generate time slots for the FULL day so we can capture all availability
    // We'll calculate effective bounds based on where availability actually exists
    const fullDaySlots = generateTimeSlots("00:00", "23:30");

    // Initialize all slots for full day
    for (const date of dateStrings) {
      for (const time of fullDaySlots) {
        const key = `${date}-${time}`;
        heatmapData[key] = { count: 0, participantIds: [] };
      }
    }

    // Fill in availability
    // IMPORTANT: Availability is in UTC, but heatmap keys are in event timezone
    // We need to convert each UTC time slot to event timezone before looking up
    const eventTimezone = event.timezone || "UTC";

    for (const participant of participantsData) {
      for (const slot of participant.availability) {
        const startMinutes = parseTimeToMinutes(slot.startTime);
        const endMinutes = parseTimeToMinutes(slot.endTime);

        // Determine if this is an overnight slot (end time <= start time numerically)
        // e.g., 22:00 to 02:00 (1320 to 120) or 12:00 to 02:00 (720 to 120)
        const isOvernight = endMinutes <= startMinutes && slot.endTime !== slot.startTime;

        // Skip truly invalid slots (same start and end)
        if (slot.startTime === slot.endTime) continue;

        let currentTime = slot.startTime;
        let iterations = 0;
        const maxIterations = 48; // Max 48 half-hour slots in a day
        let passedMidnight = false;

        while (iterations < maxIterations) {
          const currentMinutes = parseTimeToMinutes(currentTime);

          // Determine if we should stop
          if (isOvernight) {
            // For overnight slots: continue until we've passed midnight AND reached end time
            if (passedMidnight && currentMinutes >= endMinutes) break;
          } else {
            // For normal slots: stop when we reach end time
            if (currentMinutes >= endMinutes) break;
          }

          // Convert this UTC time slot to event timezone for heatmap lookup
          const localSlot = utcToLocal(currentTime, slot.date, eventTimezone);
          const key = `${localSlot.date}-${localSlot.time}`;

          if (heatmapData[key]) {
            heatmapData[key].count++;
            heatmapData[key].participantIds.push(participant.id);
          }

          // Increment by 30 minutes
          const nextTime = addThirtyMinutes(currentTime);
          // Detect midnight crossing
          if (parseTimeToMinutes(nextTime) < currentMinutes) {
            passedMidnight = true;
          }
          currentTime = nextTime;
          iterations++;
        }
      }
    }

    // Calculate effective time bounds based on GM's availability only
    // Players can only play when the GM is available, so we use GM's bounds
    // Bounds are converted to event timezone to match heatmap display
    let effectiveEarliest: string | null = null;
    let effectiveLatest: string | null = null;

    if (gmParticipant && gmParticipant.availability.length > 0) {
      // Collect all start and end times, converted to event timezone
      const startTimes: string[] = [];
      const endTimes: string[] = [];
      const debugConversions: Array<{ utc: { date: string; start: string; end: string }; local: { startDate: string; startTime: string; endDate: string; endTime: string } }> = [];

      for (const slot of gmParticipant.availability) {
        // Skip invalid slots
        if (slot.startTime >= slot.endTime) continue;

        // Convert from UTC to event timezone
        const localStart = utcToLocal(slot.startTime, slot.date, eventTimezone);
        const localEnd = utcToLocal(slot.endTime, slot.date, eventTimezone);

        startTimes.push(localStart.time);
        endTimes.push(localEnd.time);

        if (debugMode && debugConversions.length < 5) {
          debugConversions.push({
            utc: { date: slot.date, start: slot.startTime, end: slot.endTime },
            local: { startDate: localStart.date, startTime: localStart.time, endDate: localEnd.date, endTime: localEnd.time },
          });
        }
      }

      if (debugMode) {
        debugInfo.boundsCalculation = {
          sampleConversions: debugConversions,
          allStartTimes: [...new Set(startTimes)].sort().slice(0, 10),
          allEndTimes: [...new Set(endTimes)].sort().slice(0, 10),
        };
      }

      if (startTimes.length > 0) {
        // Find the earliest start time and latest end time
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

    // Add final bounds to debug info
    if (debugMode) {
      debugInfo.finalBounds = {
        effectiveEarliest,
        effectiveLatest,
        displayEarliest,
        displayLatest,
        fallbackEarliestTime: earliestTime,
        fallbackLatestTime: latestTime,
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
      // GM availability info for display callout (times in event timezone)
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
      // Include debug info only when requested
      ...(debugMode && { _debug: debugInfo }),
    });

    // Add cache headers for short-term caching (5 seconds stale-while-revalidate)
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
