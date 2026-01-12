import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { format, parse } from "date-fns";

// Common timezones for gaming groups
export const COMMON_TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Sao_Paulo", label: "Brasília Time (BRT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Asia/Shanghai", label: "China (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Pacific/Auckland", label: "New Zealand (NZST)" },
  { value: "UTC", label: "UTC" },
] as const;

/**
 * Get the user's browser timezone
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Convert a local time to UTC.
 * Use this when SAVING data - user enters time in their timezone, we store in UTC.
 *
 * @param time - HH:MM format in user's local timezone
 * @param date - YYYY-MM-DD format in user's local timezone
 * @param fromTz - User's timezone (e.g., "America/Los_Angeles")
 * @returns { date, time } in UTC
 *
 * @example
 * // User in LA enters 5pm on Jan 15
 * localToUTC("17:00", "2024-01-15", "America/Los_Angeles")
 * // Returns { date: "2024-01-16", time: "01:00" } (next day in UTC)
 */
export function localToUTC(
  time: string,
  date: string,
  fromTz: string
): { date: string; time: string } {
  if (fromTz === "UTC") {
    return { date, time };
  }
  // Parse as a local time in the given timezone
  const dateTime = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  // Convert to UTC
  const utcDate = fromZonedTime(dateTime, fromTz);
  // IMPORTANT: Format in UTC timezone, not the browser's local timezone
  return {
    date: formatInTimeZone(utcDate, "UTC", "yyyy-MM-dd"),
    time: formatInTimeZone(utcDate, "UTC", "HH:mm"),
  };
}

/**
 * Convert UTC to a local time.
 * Use this when DISPLAYING data - we read UTC from storage, show in user's timezone.
 *
 * @param time - HH:MM format in UTC
 * @param date - YYYY-MM-DD format in UTC
 * @param toTz - User's timezone (e.g., "America/Los_Angeles")
 * @returns { date, time } in user's timezone
 *
 * @example
 * // UTC time 01:00 on Jan 16
 * utcToLocal("01:00", "2024-01-16", "America/Los_Angeles")
 * // Returns { date: "2024-01-15", time: "17:00" } (5pm previous day in LA)
 */
export function utcToLocal(
  time: string,
  date: string,
  toTz: string
): { date: string; time: string } {
  if (toTz === "UTC") {
    return { date, time };
  }
  // Parse as UTC - create a proper UTC date
  const utcDateTime = new Date(`${date}T${time}:00Z`);
  return {
    date: formatInTimeZone(utcDateTime, toTz, "yyyy-MM-dd"),
    time: formatInTimeZone(utcDateTime, toTz, "HH:mm"),
  };
}

/**
 * Convert a time from one timezone to another (general purpose).
 * Prefer localToUTC/utcToLocal for clarity when working with storage.
 */
export function convertTime(
  time: string,
  date: string,
  fromTz: string,
  toTz: string
): string {
  if (fromTz === toTz) {
    return time;
  }
  const dateTime = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  const utcDate = fromZonedTime(dateTime, fromTz);
  return formatInTimeZone(utcDate, toTz, "HH:mm");
}

/**
 * Convert a time from one timezone to another, returning both date and time.
 * Handles date changes when crossing midnight.
 */
export function convertDateTime(
  time: string,
  date: string,
  fromTz: string,
  toTz: string
): { date: string; time: string } {
  if (fromTz === toTz) {
    return { date, time };
  }
  const dateTime = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  const utcDate = fromZonedTime(dateTime, fromTz);
  return {
    date: formatInTimeZone(utcDate, toTz, "yyyy-MM-dd"),
    time: formatInTimeZone(utcDate, toTz, "HH:mm"),
  };
}

/**
 * Format a time for display in a specific timezone
 */
export function formatTimeInZone(
  isoDateTime: string,
  timezone: string,
  formatStr: string = "h:mm a"
): string {
  return formatInTimeZone(new Date(isoDateTime), timezone, formatStr);
}

/**
 * Get timezone abbreviation (e.g., "PST", "EST")
 */
export function getTimezoneAbbr(timezone: string, date: Date = new Date()): string {
  return formatInTimeZone(date, timezone, "zzz");
}

/**
 * Convert a recurring pattern (dayOfWeek + time) from local timezone to UTC.
 * Handles day-of-week shifts when crossing midnight.
 *
 * @param dayOfWeek - 0 (Sunday) to 6 (Saturday) in local timezone
 * @param startTime - HH:MM in local timezone
 * @param endTime - HH:MM in local timezone
 * @param fromTz - Source timezone
 * @returns Pattern with dayOfWeek and times in UTC
 *
 * @example
 * // Monday 1am-5am in Manila (UTC+8) becomes Sunday 5pm-9pm UTC
 * convertPatternToUTC(1, "01:00", "05:00", "Asia/Manila")
 * // Returns { dayOfWeek: 0, startTime: "17:00", endTime: "21:00" }
 */
export function convertPatternToUTC(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  fromTz: string
): { dayOfWeek: number; startTime: string; endTime: string } {
  if (fromTz === "UTC") {
    return { dayOfWeek, startTime, endTime };
  }

  // Use a reference week to determine the day shift
  // Pick a date that's definitely the correct day of week (Jan 2024 week)
  // Jan 7, 2024 is a Sunday (dayOfWeek 0)
  const refDate = new Date(2024, 0, 7 + dayOfWeek); // 7=Sun, 8=Mon, etc.
  const dateStr = format(refDate, "yyyy-MM-dd");

  const utcStart = localToUTC(startTime, dateStr, fromTz);
  const utcEnd = localToUTC(endTime, dateStr, fromTz);

  // Calculate the new day of week based on the date shift
  // Use UTC dates for consistent comparison across all browser timezones
  const refDateUTC = Date.UTC(2024, 0, 7 + dayOfWeek);
  const [utcYear, utcMonth, utcDay] = utcStart.date.split("-").map(Number);
  const utcStartDateUTC = Date.UTC(utcYear, utcMonth - 1, utcDay);
  const dayShift = Math.round((utcStartDateUTC - refDateUTC) / (24 * 60 * 60 * 1000));
  const newDayOfWeek = ((dayOfWeek + dayShift) % 7 + 7) % 7; // Handle negative modulo

  return {
    dayOfWeek: newDayOfWeek,
    startTime: utcStart.time,
    endTime: utcEnd.time,
  };
}

/**
 * Convert a recurring pattern from UTC to local timezone for display.
 * Handles day-of-week shifts when crossing midnight.
 * Properly handles overnight patterns where endTime < startTime in UTC.
 */
export function convertPatternFromUTC(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  toTz: string
): { dayOfWeek: number; startTime: string; endTime: string } {
  if (toTz === "UTC") {
    return { dayOfWeek, startTime, endTime };
  }

  // Use a reference week to determine the day shift
  // Jan 7, 2024 is a Sunday (dayOfWeek 0)
  const refDate = new Date(2024, 0, 7 + dayOfWeek);
  const dateStr = format(refDate, "yyyy-MM-dd");

  // Check if this is an overnight pattern in UTC (end time <= start time)
  const startMins = parseInt(startTime.split(":")[0]) * 60 + parseInt(startTime.split(":")[1]);
  const endMins = parseInt(endTime.split(":")[0]) * 60 + parseInt(endTime.split(":")[1]);
  const isOvernightUTC = endMins <= startMins && endTime !== startTime;

  // For overnight patterns, the end time is actually on the next day in UTC
  const endDateStr = isOvernightUTC
    ? format(new Date(2024, 0, 7 + dayOfWeek + 1), "yyyy-MM-dd")
    : dateStr;

  const localStart = utcToLocal(startTime, dateStr, toTz);
  const localEnd = utcToLocal(endTime, endDateStr, toTz);

  // Calculate the new day of week based on the date shift of the START time
  // Use UTC dates for consistent comparison across all browser timezones
  const refDateUTC = Date.UTC(2024, 0, 7 + dayOfWeek);
  const [localYear, localMonth, localDay] = localStart.date.split("-").map(Number);
  const localStartDateUTC = Date.UTC(localYear, localMonth - 1, localDay);
  const dayShift = Math.round((localStartDateUTC - refDateUTC) / (24 * 60 * 60 * 1000));
  const newDayOfWeek = ((dayOfWeek + dayShift) % 7 + 7) % 7;

  return {
    dayOfWeek: newDayOfWeek,
    startTime: localStart.time,
    endTime: localEnd.time,
  };
}

// Legacy aliases for backwards compatibility
export const toUTC = localToUTC;
export const fromUTC = utcToLocal;
