import { addDays, format, getDay, parseISO, isWithinInterval } from "date-fns";
import type { TimeSlot, GeneralAvailability } from "@/lib/types";

/**
 * Expands general availability patterns into specific time slots for a date range.
 * This is the core utility that bridges patterns and specific slots.
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

    // Find all patterns for this day of week
    const dayPatterns = patterns.filter((p) => p.dayOfWeek === dayOfWeek);

    for (const pattern of dayPatterns) {
      let effectiveStart = pattern.startTime;
      let effectiveEnd = pattern.endTime;

      // Clamp to event's time window if provided
      if (earliestTime && latestTime) {
        effectiveStart = clampTime(effectiveStart, earliestTime, latestTime, "start");
        effectiveEnd = clampTime(effectiveEnd, earliestTime, latestTime, "end");

        // Skip if the pattern is completely outside the time window
        if (effectiveStart >= effectiveEnd) {
          continue;
        }
      }

      slots.push({
        date: dateStr,
        startTime: effectiveStart,
        endTime: effectiveEnd,
      });
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
 * 2. Merge in any specific slot overrides
 * 3. Apply exceptions (unavailable times)
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

  // Merge with specific slots (specific slots take precedence for their dates)
  const specificDates = new Set(specificSlots.map((s) => s.date));
  const combinedSlots = [
    // Keep pattern slots for dates without specific overrides
    ...patternSlots.filter((s) => !specificDates.has(s.date)),
    // Add all specific slots
    ...specificSlots,
  ];

  // Apply exceptions
  const effectiveSlots = applyExceptions(combinedSlots, exceptions);

  return mergeOverlappingSlots(effectiveSlots);
}
