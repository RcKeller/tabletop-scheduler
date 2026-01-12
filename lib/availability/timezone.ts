/**
 * Timezone utilities for availability rules
 *
 * This module provides functions for converting availability rules between timezones,
 * handling day-of-week shifts, and converting for display.
 *
 * Key principles:
 * - Database stores everything in UTC (dayOfWeek, startTime, endTime)
 * - Original timezone and day are preserved for cross-timezone clarity
 * - Conversion happens on read (for display) and write (for storage)
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { format, parse, addDays } from "date-fns";
import type {
  AvailabilityRule,
  CreateAvailabilityRuleInput,
  TimeRange,
} from "../types/availability";
import { timeToMinutes, minutesToTime } from "./range-math";

// Re-export common utilities from the existing timezone module
export {
  getBrowserTimezone,
  COMMON_TIMEZONES,
  getTimezoneAbbr,
} from "../utils/timezone";

/**
 * Reference date utilities
 * We use a fixed reference week (Jan 7-13, 2024) where Jan 7 is Sunday
 * This ensures consistent day-of-week calculations regardless of browser timezone
 */
const REFERENCE_SUNDAY = new Date(Date.UTC(2024, 0, 7, 12, 0, 0)); // Jan 7, 2024 noon UTC

function getReferenceDateForDay(dayOfWeek: number): Date {
  return addDays(REFERENCE_SUNDAY, dayOfWeek);
}

function getReferenceDateString(dayOfWeek: number): string {
  const d = getReferenceDateForDay(dayOfWeek);
  return format(d, "yyyy-MM-dd");
}

/**
 * Convert a local time to UTC
 */
export function localToUTC(
  time: string,
  date: string,
  fromTz: string
): { date: string; time: string } {
  if (fromTz === "UTC") {
    return { date, time };
  }
  const dateTime = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
  const utcDate = fromZonedTime(dateTime, fromTz);
  return {
    date: formatInTimeZone(utcDate, "UTC", "yyyy-MM-dd"),
    time: formatInTimeZone(utcDate, "UTC", "HH:mm"),
  };
}

/**
 * Convert UTC to local time
 */
export function utcToLocal(
  time: string,
  date: string,
  toTz: string
): { date: string; time: string } {
  if (toTz === "UTC") {
    return { date, time };
  }
  const utcDateTime = new Date(`${date}T${time}:00Z`);
  return {
    date: formatInTimeZone(utcDateTime, toTz, "yyyy-MM-dd"),
    time: formatInTimeZone(utcDateTime, toTz, "HH:mm"),
  };
}

/**
 * Convert a pattern rule from user's local timezone to UTC for storage
 *
 * @param localDayOfWeek - Day of week in user's timezone (0-6)
 * @param startTime - Start time in user's timezone (HH:MM)
 * @param endTime - End time in user's timezone (HH:MM)
 * @param fromTz - User's timezone
 * @returns UTC dayOfWeek and times
 *
 * @example
 * // Tuesday 1am-5am in Manila (UTC+8) becomes Monday 5pm-9pm UTC
 * convertPatternToUTC(2, "01:00", "05:00", "Asia/Manila")
 * // Returns { dayOfWeek: 1, startTime: "17:00", endTime: "21:00" }
 */
export function convertPatternToUTC(
  localDayOfWeek: number,
  startTime: string,
  endTime: string,
  fromTz: string
): { dayOfWeek: number; startTime: string; endTime: string } {
  if (fromTz === "UTC") {
    return { dayOfWeek: localDayOfWeek, startTime, endTime };
  }

  const dateStr = getReferenceDateString(localDayOfWeek);

  // Convert start time
  const utcStart = localToUTC(startTime, dateStr, fromTz);

  // Handle overnight patterns - end time may be on next day
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const isOvernight = endMins <= startMins && endTime !== startTime;

  const endDateStr = isOvernight
    ? getReferenceDateString((localDayOfWeek + 1) % 7)
    : dateStr;
  const utcEnd = localToUTC(endTime, endDateStr, fromTz);

  // Calculate UTC day of week from date shift
  const refDateUTC = Date.UTC(2024, 0, 7 + localDayOfWeek);
  const [utcYear, utcMonth, utcDay] = utcStart.date.split("-").map(Number);
  const utcStartDateUTC = Date.UTC(utcYear, utcMonth - 1, utcDay);
  const dayShift = Math.round(
    (utcStartDateUTC - refDateUTC) / (24 * 60 * 60 * 1000)
  );
  const utcDayOfWeek = ((localDayOfWeek + dayShift) % 7 + 7) % 7;

  return {
    dayOfWeek: utcDayOfWeek,
    startTime: utcStart.time,
    endTime: utcEnd.time,
  };
}

/**
 * Convert a pattern rule from UTC to user's timezone for display
 *
 * @param utcDayOfWeek - Day of week in UTC (0-6)
 * @param startTime - Start time in UTC (HH:MM)
 * @param endTime - End time in UTC (HH:MM)
 * @param toTz - User's display timezone
 * @returns Local dayOfWeek and times
 */
export function convertPatternFromUTC(
  utcDayOfWeek: number,
  startTime: string,
  endTime: string,
  toTz: string
): { dayOfWeek: number; startTime: string; endTime: string } {
  if (toTz === "UTC") {
    return { dayOfWeek: utcDayOfWeek, startTime, endTime };
  }

  const dateStr = getReferenceDateString(utcDayOfWeek);

  // Check for overnight pattern in UTC
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const isOvernightUTC = endMins <= startMins && endTime !== startTime;

  const endDateStr = isOvernightUTC
    ? getReferenceDateString((utcDayOfWeek + 1) % 7)
    : dateStr;

  const localStart = utcToLocal(startTime, dateStr, toTz);
  const localEnd = utcToLocal(endTime, endDateStr, toTz);

  // Calculate local day of week from date shift
  const refDateUTC = Date.UTC(2024, 0, 7 + utcDayOfWeek);
  const [localYear, localMonth, localDay] = localStart.date.split("-").map(Number);
  const localStartDateUTC = Date.UTC(localYear, localMonth - 1, localDay);
  const dayShift = Math.round(
    (localStartDateUTC - refDateUTC) / (24 * 60 * 60 * 1000)
  );
  const localDayOfWeek = ((utcDayOfWeek + dayShift) % 7 + 7) % 7;

  return {
    dayOfWeek: localDayOfWeek,
    startTime: localStart.time,
    endTime: localEnd.time,
  };
}

/**
 * Convert an override rule's date and times from local to UTC
 */
export function convertOverrideToUTC(
  localDate: string,
  startTime: string,
  endTime: string,
  fromTz: string
): { date: string; startTime: string; endTime: string } {
  if (fromTz === "UTC") {
    return { date: localDate, startTime, endTime };
  }

  const utcStart = localToUTC(startTime, localDate, fromTz);

  // Handle overnight
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const isOvernight = endMins <= startMins && endTime !== startTime;

  const endLocalDate = isOvernight
    ? format(addDays(new Date(localDate), 1), "yyyy-MM-dd")
    : localDate;
  const utcEnd = localToUTC(endTime, endLocalDate, fromTz);

  return {
    date: utcStart.date,
    startTime: utcStart.time,
    endTime: utcEnd.time,
  };
}

/**
 * Convert an override rule from UTC to local timezone for display
 */
export function convertOverrideFromUTC(
  utcDate: string,
  startTime: string,
  endTime: string,
  toTz: string
): { date: string; startTime: string; endTime: string } {
  if (toTz === "UTC") {
    return { date: utcDate, startTime, endTime };
  }

  const localStart = utcToLocal(startTime, utcDate, toTz);

  // Handle overnight in UTC
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const isOvernightUTC = endMins <= startMins && endTime !== startTime;

  const endUtcDate = isOvernightUTC
    ? format(addDays(new Date(utcDate), 1), "yyyy-MM-dd")
    : utcDate;
  const localEnd = utcToLocal(endTime, endUtcDate, toTz);

  return {
    date: localStart.date,
    startTime: localStart.time,
    endTime: localEnd.time,
  };
}

/**
 * Convert a full availability rule to user's display timezone
 */
export function convertRuleForDisplay(
  rule: AvailabilityRule,
  displayTz: string
): {
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
} {
  if (rule.dayOfWeek !== null) {
    // Pattern rule
    const converted = convertPatternFromUTC(
      rule.dayOfWeek,
      rule.startTime,
      rule.endTime,
      displayTz
    );
    return {
      dayOfWeek: converted.dayOfWeek,
      specificDate: null,
      startTime: converted.startTime,
      endTime: converted.endTime,
    };
  } else if (rule.specificDate) {
    // Override rule
    const converted = convertOverrideFromUTC(
      rule.specificDate,
      rule.startTime,
      rule.endTime,
      displayTz
    );
    return {
      dayOfWeek: null,
      specificDate: converted.date,
      startTime: converted.startTime,
      endTime: converted.endTime,
    };
  }

  // Fallback (shouldn't happen)
  return {
    dayOfWeek: rule.dayOfWeek,
    specificDate: rule.specificDate,
    startTime: rule.startTime,
    endTime: rule.endTime,
  };
}

/**
 * Prepare a rule input for storage (convert to UTC)
 */
export function prepareRuleForStorage(
  input: {
    ruleType: CreateAvailabilityRuleInput["ruleType"];
    dayOfWeek?: number | null;
    specificDate?: string | null;
    startTime: string;
    endTime: string;
  },
  userTimezone: string
): {
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  originalTimezone: string;
  originalDayOfWeek: number | null;
} {
  const isPattern =
    input.ruleType === "available_pattern" ||
    input.ruleType === "blocked_pattern";

  if (isPattern && input.dayOfWeek !== null && input.dayOfWeek !== undefined) {
    const converted = convertPatternToUTC(
      input.dayOfWeek,
      input.startTime,
      input.endTime,
      userTimezone
    );
    return {
      dayOfWeek: converted.dayOfWeek,
      specificDate: null,
      startTime: converted.startTime,
      endTime: converted.endTime,
      originalTimezone: userTimezone,
      originalDayOfWeek: input.dayOfWeek,
    };
  } else if (input.specificDate) {
    const converted = convertOverrideToUTC(
      input.specificDate,
      input.startTime,
      input.endTime,
      userTimezone
    );
    return {
      dayOfWeek: null,
      specificDate: converted.date,
      startTime: converted.startTime,
      endTime: converted.endTime,
      originalTimezone: userTimezone,
      originalDayOfWeek: null,
    };
  }

  // Fallback (shouldn't happen with valid input)
  return {
    dayOfWeek: input.dayOfWeek ?? null,
    specificDate: input.specificDate ?? null,
    startTime: input.startTime,
    endTime: input.endTime,
    originalTimezone: userTimezone,
    originalDayOfWeek: null,
  };
}

/**
 * Get the UTC day of week for a specific date
 */
export function getUTCDayOfWeek(date: string): number {
  const d = new Date(`${date}T12:00:00Z`);
  return d.getUTCDay();
}

/**
 * Get the local day of week for a specific date in a timezone
 */
export function getLocalDayOfWeek(date: string, timezone: string): number {
  const d = new Date(`${date}T12:00:00Z`);
  const dayStr = formatInTimeZone(d, timezone, "i"); // 1=Monday, 7=Sunday
  const isoDay = parseInt(dayStr, 10);
  return isoDay === 7 ? 0 : isoDay; // Convert to 0=Sunday format
}

/**
 * Generate an array of dates for a given date range
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  let current = start;
  while (current <= end) {
    dates.push(format(current, "yyyy-MM-dd"));
    current = addDays(current, 1);
  }

  return dates;
}

/**
 * Day of week names
 */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_NAMES_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;
