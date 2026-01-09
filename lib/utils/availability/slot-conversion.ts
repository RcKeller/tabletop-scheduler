import { addDays, format, getDay, eachDayOfInterval } from "date-fns";
import { addThirtyMinutes, parseTimeToMinutes } from "@/lib/utils/time-slots";
import type { TimeSlot, GeneralAvailability } from "@/lib/types";

/**
 * Check if we should continue generating slots (handles overnight times)
 * For overnight ranges like 22:00-02:00, we need to handle the wraparound
 */
function shouldContinueSlotGeneration(currentTime: string, endTime: string, startTime: string): boolean {
  const currentMins = parseTimeToMinutes(currentTime);
  const endMins = parseTimeToMinutes(endTime);
  const startMins = parseTimeToMinutes(startTime);

  // If end time is after or equal to start time (normal case like 09:00-17:00)
  if (endMins > startMins) {
    return currentMins < endMins;
  }

  // Overnight case (like 22:00-02:00)
  // Continue if we haven't wrapped around yet (current >= start)
  // Or if we've wrapped but haven't reached end yet (current < end)
  if (currentMins >= startMins) {
    return true; // Still in first day portion
  }
  return currentMins < endMins; // In next day portion
}

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
    const nextDateStr = format(addDays(date, 1), "yyyy-MM-dd");
    const dayOfWeek = getDay(date);

    const dayPatterns = patterns.filter(p => p.dayOfWeek === dayOfWeek);

    for (const pattern of dayPatterns) {
      // Expand pattern to 30-min slots (handles overnight)
      let currentTime = pattern.startTime;
      const isOvernight = parseTimeToMinutes(pattern.endTime) <= parseTimeToMinutes(pattern.startTime);
      let passedMidnight = false;

      while (shouldContinueSlotGeneration(currentTime, pattern.endTime, pattern.startTime)) {
        // Use next day's date if we've passed midnight in an overnight pattern
        const slotDate = (isOvernight && passedMidnight) ? nextDateStr : dateStr;
        slots.add(`${slotDate}-${currentTime}`);

        const nextTime = addThirtyMinutes(currentTime);
        // Check if we just crossed midnight
        if (parseTimeToMinutes(nextTime) < parseTimeToMinutes(currentTime)) {
          passedMidnight = true;
        }
        currentTime = nextTime;
      }
    }
  }

  return slots;
}

/**
 * Convert TimeSlots array to a Set of slot keys (date-time format)
 * Handles overnight slots where endTime < startTime
 */
export function slotsToKeySet(slots: TimeSlot[]): Set<string> {
  const result = new Set<string>();
  for (const slot of slots) {
    let currentTime = slot.startTime;
    const isOvernight = parseTimeToMinutes(slot.endTime) <= parseTimeToMinutes(slot.startTime) && slot.endTime !== slot.startTime;
    let passedMidnight = false;

    while (shouldContinueSlotGeneration(currentTime, slot.endTime, slot.startTime)) {
      // For overnight slots, use next day's date after midnight
      let slotDate = slot.date;
      if (isOvernight && passedMidnight) {
        // Increment the date by one day
        const [year, month, day] = slot.date.split("-").map(Number);
        const nextDate = new Date(year, month - 1, day + 1);
        slotDate = format(nextDate, "yyyy-MM-dd");
      }

      result.add(`${slotDate}-${currentTime}`);

      const nextTime = addThirtyMinutes(currentTime);
      if (parseTimeToMinutes(nextTime) < parseTimeToMinutes(currentTime)) {
        passedMidnight = true;
      }
      currentTime = nextTime;
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
 * Handles overnight patterns where endTime < startTime
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
    const nextDateStr = format(addDays(date, 1), "yyyy-MM-dd");
    const dayOfWeek = getDay(date);

    const dayPatterns = patterns.filter(p => p.dayOfWeek === dayOfWeek);

    for (const pattern of dayPatterns) {
      // Expand pattern to 30-min slots (handles overnight)
      let currentTime = pattern.startTime;
      const isOvernight = parseTimeToMinutes(pattern.endTime) <= parseTimeToMinutes(pattern.startTime);
      let passedMidnight = false;

      while (shouldContinueSlotGeneration(currentTime, pattern.endTime, pattern.startTime)) {
        // Use next day's date if we've passed midnight in an overnight pattern
        const slotDate = (isOvernight && passedMidnight) ? nextDateStr : dateStr;
        slots.add(`${slotDate}-${currentTime}`);

        const nextTime = addThirtyMinutes(currentTime);
        // Check if we just crossed midnight
        if (parseTimeToMinutes(nextTime) < parseTimeToMinutes(currentTime)) {
          passedMidnight = true;
        }
        currentTime = nextTime;
      }
    }
  }

  return slots;
}
