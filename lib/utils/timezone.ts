import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
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
 * Convert a time from one timezone to another
 */
export function convertTime(
  time: string, // HH:MM format
  date: string, // YYYY-MM-DD format
  fromTz: string,
  toTz: string
): string {
  const dateTime = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  const utcDate = fromZonedTime(dateTime, fromTz);
  return formatInTimeZone(utcDate, toTz, "HH:mm");
}

/**
 * Convert a date and time to UTC
 */
export function toUTC(
  time: string, // HH:MM format
  date: string, // YYYY-MM-DD format
  fromTz: string
): { date: string; time: string } {
  const dateTime = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  const utcDate = fromZonedTime(dateTime, fromTz);
  return {
    date: format(utcDate, "yyyy-MM-dd"),
    time: format(utcDate, "HH:mm"),
  };
}

/**
 * Convert UTC date and time to a specific timezone
 */
export function fromUTC(
  time: string, // HH:MM format
  date: string, // YYYY-MM-DD format
  toTz: string
): { date: string; time: string } {
  const dateTime = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  const zonedDate = toZonedTime(dateTime, toTz);
  return {
    date: formatInTimeZone(dateTime, toTz, "yyyy-MM-dd"),
    time: formatInTimeZone(dateTime, toTz, "HH:mm"),
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
 * Get timezone abbreviation
 */
export function getTimezoneAbbr(timezone: string, date: Date = new Date()): string {
  return formatInTimeZone(date, timezone, "zzz");
}
