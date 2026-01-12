import { addDays, format, getDay, parseISO, isWithinInterval } from "date-fns";
import type { TimeSlot, GeneralAvailability } from "@/lib/types";

/**
 * Expands general availability patterns into specific time slots for a date range.
 * This is the core utility that bridges patterns and specific slots.
 * Handles overnight patterns where endTime <= startTime (e.g., 12:00-02:00).
 */
export function expandPatternsToSlots(
  patterns: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  startDate: Date | string,
  endDate: Date | string,
  earliestTime?: string,
  latestTime?: string
): TimeSlot[] {
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate;
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate;

  const slots: TimeSlot[] = [];
  let currentDate = start;

  // Iterate through each day in the range
  while (currentDate <= end) {
    const dayOfWeek = getDay(currentDate); // 0 = Sunday, 6 = Saturday
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const nextDateStr = format(addDays(currentDate, 1), "yyyy-MM-dd");

    // Find all patterns for this day of week
    const dayPatterns = patterns.filter((p) => p.dayOfWeek === dayOfWeek);

    for (const pattern of dayPatterns) {
      const startMins = parseTimeToMinutes(pattern.startTime);
      const endMins = parseTimeToMinutes(pattern.endTime);

      // Check if this is an overnight pattern (end time <= start time numerically)
      const isOvernight = endMins <= startMins && pattern.endTime !== pattern.startTime;

      // Skip patterns with same start and end (invalid)
      if (pattern.startTime === pattern.endTime) continue;

      if (isOvernight) {
        // For overnight patterns, split into two slots:
        // 1. From startTime to midnight (on current day)
        // 2. From midnight to endTime (on next day)
        slots.push({
          date: dateStr,
          startTime: pattern.startTime,
          endTime: "24:00", // End of current day
        });
        // Only add next day portion if next day is within the date range
        if (addDays(currentDate, 1) <= end) {
          slots.push({
            date: nextDateStr,
            startTime: "00:00",
            endTime: pattern.endTime,
          });
        }
      } else {
        // Normal same-day pattern
        let effectiveStart = pattern.startTime;
        let effectiveEnd = pattern.endTime;

        // Clamp to event's time window if provided
        if (earliestTime && latestTime) {
          effectiveStart = clampTime(effectiveStart, earliestTime, latestTime, "start");
          effectiveEnd = clampTime(effectiveEnd, earliestTime, latestTime, "end");

          // Skip if the pattern is completely outside the time window (for non-overnight only)
          if (parseTimeToMinutes(effectiveStart) >= parseTimeToMinutes(effectiveEnd)) {
            continue;
          }
        }

        slots.push({
          date: dateStr,
          startTime: effectiveStart,
          endTime: effectiveEnd,
        });
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return mergeOverlappingSlots(slots);
}

/**
 * Clamps a time to be within the event's time window
 */
function clampTime(
  time: string,
  earliest: string,
  latest: string,
  type: "start" | "end"
): string {
  const timeMinutes = parseTimeToMinutes(time);
  const earliestMinutes = parseTimeToMinutes(earliest);
  const latestMinutes = parseTimeToMinutes(latest);

  // Handle 24-hour case (earliest === latest)
  if (earliest === latest) {
    return time;
  }

  if (type === "start") {
    return timeMinutes < earliestMinutes ? earliest : time;
  } else {
    return timeMinutes > latestMinutes ? latest : time;
  }
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Merges overlapping time slots on the same date
 */
export function mergeOverlappingSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];

  // Group by date
  const byDate = new Map<string, TimeSlot[]>();
  for (const slot of slots) {
    const existing = byDate.get(slot.date) || [];
    existing.push(slot);
    byDate.set(slot.date, existing);
  }

  const result: TimeSlot[] = [];

  for (const [date, dateSlots] of byDate) {
    // Sort by start time
    dateSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let current = { ...dateSlots[0] };

    for (let i = 1; i < dateSlots.length; i++) {
      const next = dateSlots[i];

      // Check if overlapping or adjacent
      if (next.startTime <= current.endTime) {
        // Extend current slot if next ends later
        if (next.endTime > current.endTime) {
          current.endTime = next.endTime;
        }
      } else {
        // No overlap, push current and start new
        result.push(current);
        current = { ...next };
      }
    }

    result.push(current);
  }

  return result;
}

/**
 * Applies exceptions to remove unavailable times from slots
 */
export function applyExceptions(
  slots: TimeSlot[],
  exceptions: Array<{ date: string; startTime: string; endTime: string }>
): TimeSlot[] {
  if (exceptions.length === 0) return slots;

  const result: TimeSlot[] = [];

  for (const slot of slots) {
    // Find exceptions for this date
    const dateExceptions = exceptions.filter((e) => e.date === slot.date);

    if (dateExceptions.length === 0) {
      result.push(slot);
      continue;
    }

    // Sort exceptions by start time
    dateExceptions.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let currentStart = slot.startTime;
    const slotEnd = slot.endTime;

    for (const exception of dateExceptions) {
      // If exception starts after current position, add the gap
      if (exception.startTime > currentStart && exception.startTime < slotEnd) {
        result.push({
          date: slot.date,
          startTime: currentStart,
          endTime: exception.startTime,
        });
      }

      // Move current position past the exception
      if (exception.endTime > currentStart) {
        currentStart = exception.endTime;
      }
    }

    // Add remaining time after last exception
    if (currentStart < slotEnd) {
      result.push({
        date: slot.date,
        startTime: currentStart,
        endTime: slotEnd,
      });
    }
  }

  return result;
}

/**
 * Combines multiple sources of availability:
 * 1. Start with general patterns expanded to specific dates
 * 2. Merge in any specific slot additions (Calendar entries are additive)
 * 3. Apply exceptions (unavailable times) - these trump all other sources
 *
 * Priority: Exceptions > Calendar > Recurring Patterns
 */
export function computeEffectiveAvailability(
  patterns: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  specificSlots: TimeSlot[],
  exceptions: Array<{ date: string; startTime: string; endTime: string }>,
  startDate: Date | string,
  endDate: Date | string,
  earliestTime?: string,
  latestTime?: string
): TimeSlot[] {
  // Expand patterns to specific slots
  const patternSlots = expandPatternsToSlots(
    patterns,
    startDate,
    endDate,
    earliestTime,
    latestTime
  );

  // Combine both pattern slots and specific slots (additive merge)
  // This allows Calendar entries to add availability on top of Recurring patterns
  const combinedSlots = [
    ...patternSlots,
    ...specificSlots,
  ];

  // Apply exceptions (these remove time from all sources)
  const effectiveSlots = applyExceptions(combinedSlots, exceptions);

  // Merge overlapping slots to clean up the result
  return mergeOverlappingSlots(effectiveSlots);
}
