import { addDays, format, getDay, eachDayOfInterval } from "date-fns";
import { addThirtyMinutes } from "@/lib/utils/time-slots";
import type { TimeSlot, GeneralAvailability } from "@/lib/types";

/**
 * Expand general availability patterns to specific slot keys for a week
 */
export function expandPatternsForWeek(
  patterns: GeneralAvailability[],
  weekStart: Date,
  earliestTime?: string,
  latestTime?: string
): Set<string> {
  const slots = new Set<string>();

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date);

    const dayPatterns = patterns.filter(p => p.dayOfWeek === dayOfWeek);

    for (const pattern of dayPatterns) {
      // Expand pattern to 30-min slots
      let currentTime = pattern.startTime;
      while (currentTime < pattern.endTime) {
        slots.add(`${dateStr}-${currentTime}`);
        currentTime = addThirtyMinutes(currentTime);
      }
    }
  }

  return slots;
}

/**
 * Convert TimeSlots array to a Set of slot keys (date-time format)
 */
export function slotsToKeySet(slots: TimeSlot[]): Set<string> {
  const result = new Set<string>();
  for (const slot of slots) {
    let currentTime = slot.startTime;
    while (currentTime < slot.endTime) {
      result.add(`${slot.date}-${currentTime}`);
      currentTime = addThirtyMinutes(currentTime);
    }
  }
  return result;
}

/**
 * Parse a slot key back to date and time parts
 */
function parseSlotKey(key: string): { date: string; time: string } {
  // Key format: "YYYY-MM-DD-HH:MM"
  const parts = key.split("-");
  const date = parts.slice(0, 3).join("-");
  const time = parts[3];
  return { date, time };
}

/**
 * Convert a Set of slot keys back to TimeSlots array (merging consecutive slots)
 */
export function keySetToSlots(keys: Set<string>): TimeSlot[] {
  const byDate = new Map<string, string[]>();

  for (const key of keys) {
    const { date, time } = parseSlotKey(key);
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(time);
  }

  const result: TimeSlot[] = [];

  for (const [date, times] of byDate) {
    times.sort();

    if (times.length === 0) continue;

    let rangeStart = times[0];
    let rangeEnd = addThirtyMinutes(times[0]);

    for (let i = 1; i < times.length; i++) {
      const time = times[i];
      if (time === rangeEnd) {
        rangeEnd = addThirtyMinutes(time);
      } else {
        result.push({ date, startTime: rangeStart, endTime: rangeEnd });
        rangeStart = time;
        rangeEnd = addThirtyMinutes(time);
      }
    }

    result.push({ date, startTime: rangeStart, endTime: rangeEnd });
  }

  return result;
}

/**
 * Expand general availability patterns to specific slot keys for a date range
 */
export function expandPatternsToDateRange(
  patterns: GeneralAvailability[],
  startDate: Date,
  endDate: Date,
  earliestTime?: string,
  latestTime?: string
): Set<string> {
  const slots = new Set<string>();
  const allDates = eachDayOfInterval({ start: startDate, end: endDate });

  for (const date of allDates) {
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date);

    const dayPatterns = patterns.filter(p => p.dayOfWeek === dayOfWeek);

    for (const pattern of dayPatterns) {
      // Expand pattern to 30-min slots
      let currentTime = pattern.startTime;
      while (currentTime < pattern.endTime) {
        slots.add(`${dateStr}-${currentTime}`);
        currentTime = addThirtyMinutes(currentTime);
      }
    }
  }

  return slots;
}
