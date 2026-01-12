import { addDays, startOfWeek } from "date-fns";

/**
 * Parse a time string (HH:MM) to minutes from midnight
 */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Format minutes from midnight to HH:MM string
 */
export function formatMinutesToTime(minutes: number): string {
  const normalizedMins = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalizedMins / 60);
  const minute = normalizedMins % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

/**
 * Add 30 minutes to a time string, wrapping at midnight
 */
export function addThirtyMinutes(time: string): string {
  const minutes = parseTimeToMinutes(time);
  return formatMinutesToTime(minutes + 30);
}

/**
 * Generate time slots (30-min intervals) between earliest and latest times
 * If earliest === latest, generates full 24 hours starting at that time
 * Handles crossing midnight (e.g., 22:00 to 02:00)
 */
export function generateTimeSlots(earliest: string, latest: string): string[] {
  const slots: string[] = [];
  const is24Hour = earliest === latest;

  const startMins = parseTimeToMinutes(earliest);
  let endMins = parseTimeToMinutes(latest);

  // If 24 hour or latest is before earliest (crosses midnight), adjust
  if (is24Hour) {
    endMins = startMins + 24 * 60;
  } else if (endMins <= startMins) {
    endMins += 24 * 60; // Crosses midnight
  }

  for (let mins = startMins; mins < endMins; mins += 30) {
    slots.push(formatMinutesToTime(mins));
  }

  return slots;
}

/**
 * Generate 7 days starting from a date (defaults to current week starting Sunday)
 */
export function getWeekDates(start?: Date): Date[] {
  const weekStart = start || startOfWeek(new Date(), { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Check if a time slot falls within a time range
 */
export function isTimeInRange(
  time: string,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const timeMins = parseTimeToMinutes(time);
  const startMins = parseTimeToMinutes(rangeStart);
  let endMins = parseTimeToMinutes(rangeEnd);

  // Handle ranges that cross midnight
  if (endMins <= startMins) {
    endMins += 24 * 60;
    const adjustedTime = timeMins < startMins ? timeMins + 24 * 60 : timeMins;
    return adjustedTime >= startMins && adjustedTime < endMins;
  }

  return timeMins >= startMins && timeMins < endMins;
}

