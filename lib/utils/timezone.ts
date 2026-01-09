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

// Legacy aliases for backwards compatibility
export const toUTC = localToUTC;
export const fromUTC = utcToLocal;
