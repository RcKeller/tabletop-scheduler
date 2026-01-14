/**
 * Range math utilities for availability computation
 *
 * All operations work on TimeRange objects representing minutes from midnight.
 * Ranges can span midnight (endMinutes > 1440) for overnight availability.
 */

import {
  TimeRange,
  MINUTES_PER_DAY,
  SLOT_DURATION_MINUTES,
} from "../types/availability";

/**
 * Parse HH:MM time string to minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight to HH:MM string
 * Handles values >= 1440 by wrapping (e.g., 1500 -> "01:00")
 */
export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Create a TimeRange from HH:MM strings
 *
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format (can be "24:00" for end of day)
 * @param crossesMidnight - Explicit flag indicating if range crosses midnight:
 *   - true: User specified overnight range (e.g., "10pm-2am") - add MINUTES_PER_DAY
 *   - false: User specified same-day range - never add MINUTES_PER_DAY
 *   - undefined: Legacy behavior - infer from time comparison
 *
 * This explicit flag is critical for timezone conversion: when a same-day range
 * like "00:00-23:30" in Manila converts to UTC as "16:00-15:30", the times look
 * inverted but should NOT be treated as overnight.
 */
export function createRange(
  startTime: string,
  endTime: string,
  crossesMidnight?: boolean
): TimeRange {
  const startMinutes = timeToMinutes(startTime);
  let endMinutes = timeToMinutes(endTime);

  // Handle "24:00" as end of day (1440 minutes)
  if (endTime === "24:00") {
    endMinutes = MINUTES_PER_DAY;
  }

  // Apply overnight logic based on explicit flag or legacy inference
  if (crossesMidnight === true) {
    // Explicit: user specified overnight range
    endMinutes += MINUTES_PER_DAY;
  } else if (crossesMidnight === false) {
    // Explicit: user specified same-day range - do NOT add MINUTES_PER_DAY
    // Even if endMinutes <= startMinutes due to timezone conversion artifact
  } else {
    // Legacy: undefined - use old inference logic for backward compatibility
    if (endMinutes <= startMinutes && endTime !== startTime) {
      endMinutes += MINUTES_PER_DAY;
    }
  }

  // Special case: if both are "00:00" (midnight), interpret as full day
  // This handles AI edge case where "all day" might produce "00:00-00:00"
  if (startMinutes === 0 && endMinutes === 0 && startTime === endTime) {
    endMinutes = MINUTES_PER_DAY; // 24:00 = full day
  }

  return { startMinutes, endMinutes };
}

/**
 * Check if two ranges overlap
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

/**
 * Check if two ranges are adjacent (can be merged)
 */
export function rangesAdjacent(a: TimeRange, b: TimeRange): boolean {
  return a.endMinutes === b.startMinutes || b.endMinutes === a.startMinutes;
}

/**
 * Merge two overlapping or adjacent ranges into one
 * Returns null if ranges don't overlap or touch
 */
export function mergeTwo(a: TimeRange, b: TimeRange): TimeRange | null {
  if (!rangesOverlap(a, b) && !rangesAdjacent(a, b)) {
    return null;
  }
  return {
    startMinutes: Math.min(a.startMinutes, b.startMinutes),
    endMinutes: Math.max(a.endMinutes, b.endMinutes),
  };
}

/**
 * Merge an array of ranges into non-overlapping, sorted ranges
 * O(n log n) due to sorting
 */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];

  // Sort by start time
  const sorted = [...ranges].sort((a, b) => a.startMinutes - b.startMinutes);

  const merged: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    const combined = mergeTwo(last, current);
    if (combined) {
      merged[merged.length - 1] = combined;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Subtract range B from range A
 * Returns array of 0, 1, or 2 ranges
 */
export function subtractOne(a: TimeRange, b: TimeRange): TimeRange[] {
  // No overlap - return A unchanged
  if (!rangesOverlap(a, b)) {
    return [a];
  }

  const result: TimeRange[] = [];

  // Left portion (before B starts)
  if (a.startMinutes < b.startMinutes) {
    result.push({
      startMinutes: a.startMinutes,
      endMinutes: b.startMinutes,
    });
  }

  // Right portion (after B ends)
  if (a.endMinutes > b.endMinutes) {
    result.push({
      startMinutes: b.endMinutes,
      endMinutes: a.endMinutes,
    });
  }

  return result;
}

/**
 * Subtract multiple ranges from a base set of ranges
 * Returns the remaining availability after removing blocked times
 */
export function subtractRanges(
  base: TimeRange[],
  toSubtract: TimeRange[]
): TimeRange[] {
  if (toSubtract.length === 0) return mergeRanges(base);
  if (base.length === 0) return [];

  let result = mergeRanges(base);

  for (const sub of toSubtract) {
    const newResult: TimeRange[] = [];
    for (const range of result) {
      newResult.push(...subtractOne(range, sub));
    }
    result = newResult;
  }

  return mergeRanges(result);
}

/**
 * Add ranges together (union)
 * Same as merging - combines all ranges
 */
export function addRanges(a: TimeRange[], b: TimeRange[]): TimeRange[] {
  return mergeRanges([...a, ...b]);
}

/**
 * Find the intersection of two ranges
 * Returns null if no intersection
 */
export function intersectTwo(a: TimeRange, b: TimeRange): TimeRange | null {
  if (!rangesOverlap(a, b)) return null;

  return {
    startMinutes: Math.max(a.startMinutes, b.startMinutes),
    endMinutes: Math.min(a.endMinutes, b.endMinutes),
  };
}

/**
 * Find intersection of two sets of ranges
 */
export function intersectRanges(
  a: TimeRange[],
  b: TimeRange[]
): TimeRange[] {
  if (a.length === 0 || b.length === 0) return [];

  const result: TimeRange[] = [];

  for (const rangeA of a) {
    for (const rangeB of b) {
      const intersection = intersectTwo(rangeA, rangeB);
      if (intersection) {
        result.push(intersection);
      }
    }
  }

  return mergeRanges(result);
}

/**
 * Expand ranges to 30-minute slots
 * Only call this at UI render time, not during computation
 */
export function rangesToSlots(
  ranges: TimeRange[],
  date: string
): { date: string; time: string }[] {
  const slots: { date: string; time: string }[] = [];

  for (const range of ranges) {
    let currentDate = date;
    let daysAdvanced = 0;

    // Iterate from start to end, tracking absolute progress
    for (
      let absoluteMinutes = range.startMinutes;
      absoluteMinutes < range.endMinutes;
      absoluteMinutes += SLOT_DURATION_MINUTES
    ) {
      // Calculate the display time (wrapped to 0-1439)
      const displayMinutes = absoluteMinutes % MINUTES_PER_DAY;
      const time = minutesToTime(displayMinutes);

      // Calculate which day this slot falls on
      const dayOffset = Math.floor(absoluteMinutes / MINUTES_PER_DAY);
      if (dayOffset > daysAdvanced) {
        // Advance the date
        const d = new Date(date + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() + dayOffset);
        currentDate = d.toISOString().split("T")[0];
        daysAdvanced = dayOffset;
      }

      slots.push({ date: currentDate, time });
    }
  }

  return slots;
}

/**
 * Convert slots back to ranges (for saving)
 * Groups consecutive slots into ranges
 */
export function slotsToRanges(
  slots: { date: string; time: string }[]
): Map<string, TimeRange[]> {
  const byDate = new Map<string, number[]>();

  // Group by date and convert to minutes
  for (const slot of slots) {
    const minutes = timeToMinutes(slot.time);
    if (!byDate.has(slot.date)) {
      byDate.set(slot.date, []);
    }
    byDate.get(slot.date)!.push(minutes);
  }

  // Convert to ranges per date
  const result = new Map<string, TimeRange[]>();

  for (const [date, minutesList] of byDate) {
    // Sort and group consecutive
    const sorted = [...minutesList].sort((a, b) => a - b);
    const ranges: TimeRange[] = [];

    let rangeStart = sorted[0];
    let rangeEnd = rangeStart + SLOT_DURATION_MINUTES;

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      if (current === rangeEnd) {
        // Consecutive - extend range
        rangeEnd = current + SLOT_DURATION_MINUTES;
      } else {
        // Gap - save current range and start new
        ranges.push({ startMinutes: rangeStart, endMinutes: rangeEnd });
        rangeStart = current;
        rangeEnd = current + SLOT_DURATION_MINUTES;
      }
    }

    // Save last range
    ranges.push({ startMinutes: rangeStart, endMinutes: rangeEnd });
    result.set(date, ranges);
  }

  return result;
}

/**
 * Calculate total minutes covered by ranges
 */
export function totalMinutes(ranges: TimeRange[]): number {
  const merged = mergeRanges(ranges);
  return merged.reduce(
    (sum, range) => sum + (range.endMinutes - range.startMinutes),
    0
  );
}

/**
 * Check if a specific minute is covered by any range
 */
export function minuteInRanges(minute: number, ranges: TimeRange[]): boolean {
  return ranges.some(
    (range) => minute >= range.startMinutes && minute < range.endMinutes
  );
}

/**
 * Clamp ranges to a time window
 * Useful for filtering to event's time bounds
 */
export function clampToWindow(
  ranges: TimeRange[],
  windowStart: number,
  windowEnd: number
): TimeRange[] {
  const window: TimeRange = {
    startMinutes: windowStart,
    endMinutes: windowEnd,
  };

  return intersectRanges(ranges, [window]);
}
