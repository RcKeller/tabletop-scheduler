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
 * Handles "24:00" as midnight of the next day
 */
export function localToUTC(
  time: string,
  date: string,
  fromTz: string
): { date: string; time: string } {
  // Handle "24:00" as "00:00 of the next day"
  let adjustedTime = time;
  let adjustedDate = date;
  if (time === "24:00") {
    adjustedTime = "00:00";
    adjustedDate = format(addDays(new Date(date), 1), "yyyy-MM-dd");
  }

  if (fromTz === "UTC") {
    return { date: adjustedDate, time: adjustedTime };
  }
  const dateTime = parse(`${adjustedDate} ${adjustedTime}`, "yyyy-MM-dd HH:mm", new Date());
  const utcDate = fromZonedTime(dateTime, fromTz);
  return {
    date: formatInTimeZone(utcDate, "UTC", "yyyy-MM-dd"),
    time: formatInTimeZone(utcDate, "UTC", "HH:mm"),
  };
}

/**
 * Convert UTC to local time
 * Handles "24:00" as midnight of the next day
 */
export function utcToLocal(
  time: string,
  date: string,
  toTz: string
): { date: string; time: string } {
  // Handle "24:00" as "00:00 of the next day"
  let adjustedTime = time;
  let adjustedDate = date;
  if (time === "24:00") {
    adjustedTime = "00:00";
    adjustedDate = format(addDays(new Date(date), 1), "yyyy-MM-dd");
  }

  if (toTz === "UTC") {
    return { date: adjustedDate, time: adjustedTime };
  }
  const utcDateTime = new Date(`${adjustedDate}T${adjustedTime}:00Z`);
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
): { dayOfWeek: number; startTime: string; endTime: string; crossesMidnight: boolean } {
  // Determine if ORIGINAL input crosses midnight BEFORE any conversion
  // This is the key fix: capture user intent at the source
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  let crossesMidnight = endMins <= startMins && endTime !== startTime;

  // Special case: 00:00-24:00 is a full day (24 hours), not midnight crossing
  // But after timezone conversion, it may appear as same time on different days
  const isFullDay = startTime === "00:00" && endTime === "24:00";

  if (fromTz === "UTC") {
    // For UTC with 00:00-24:00, keep crossesMidnight=false since "24:00" already means end of day
    // For other full-day patterns that might result from conversion (e.g., 08:00-08:00), we need crossesMidnight=true
    return { dayOfWeek: localDayOfWeek, startTime, endTime, crossesMidnight };
  }

  const dateStr = getReferenceDateString(localDayOfWeek);

  // Convert start time
  const utcStart = localToUTC(startTime, dateStr, fromTz);

  // Handle overnight patterns - end time may be on next day
  // Note: for "24:00", localToUTC already advances to next day internally
  const endDateStr = crossesMidnight
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

  // After UTC conversion, check if the end is on a different day than start
  // This happens for full-day patterns (00:00-24:00) where localToUTC("24:00")
  // advances to next day's "00:00", resulting in same numeric time but different dates
  if (!crossesMidnight && utcStart.date !== utcEnd.date) {
    // The UTC end is on a different day - this pattern spans midnight in UTC
    crossesMidnight = true;
  }

  // For full day patterns, if start and end times are the same,
  // we need crossesMidnight=true to ensure 24-hour duration
  if (isFullDay && utcStart.time === utcEnd.time) {
    crossesMidnight = true;
  }

  return {
    dayOfWeek: utcDayOfWeek,
    startTime: utcStart.time,
    endTime: utcEnd.time,
    crossesMidnight,
  };
}

/**
 * Convert a pattern rule from UTC to user's timezone for display
 *
 * @param utcDayOfWeek - Day of week in UTC (0-6)
 * @param startTime - Start time in UTC (HH:MM)
 * @param endTime - End time in UTC (HH:MM)
 * @param toTz - User's display timezone
 * @param crossesMidnight - Optional flag indicating if pattern crosses midnight (for full-day patterns)
 * @returns Local dayOfWeek and times
 */
export function convertPatternFromUTC(
  utcDayOfWeek: number,
  startTime: string,
  endTime: string,
  toTz: string,
  crossesMidnight?: boolean
): { dayOfWeek: number; startTime: string; endTime: string } {
  if (toTz === "UTC") {
    return { dayOfWeek: utcDayOfWeek, startTime, endTime };
  }

  const dateStr = getReferenceDateString(utcDayOfWeek);

  // Check for overnight pattern in UTC
  // Use explicit crossesMidnight if provided, otherwise infer from times
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const isOvernightUTC = crossesMidnight ?? (endMins <= startMins && endTime !== startTime);

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

  // Handle full-day patterns: if start and end are the same time but on different days,
  // this is a 24-hour pattern and we should return "24:00" as the end time
  let finalEndTime = localEnd.time;
  if (localStart.time === localEnd.time && localStart.date !== localEnd.date) {
    finalEndTime = "24:00";
  }

  return {
    dayOfWeek: localDayOfWeek,
    startTime: localStart.time,
    endTime: finalEndTime,
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
): { date: string; startTime: string; endTime: string; crossesMidnight: boolean } {
  // Determine if ORIGINAL input crosses midnight BEFORE any conversion
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const crossesMidnight = endMins <= startMins && endTime !== startTime;

  if (fromTz === "UTC") {
    return { date: localDate, startTime, endTime, crossesMidnight };
  }

  const utcStart = localToUTC(startTime, localDate, fromTz);

  const endLocalDate = crossesMidnight
    ? format(addDays(new Date(localDate), 1), "yyyy-MM-dd")
    : localDate;
  const utcEnd = localToUTC(endTime, endLocalDate, fromTz);

  return {
    date: utcStart.date,
    startTime: utcStart.time,
    endTime: utcEnd.time,
    crossesMidnight,
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
  crossesMidnight: boolean;
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
      crossesMidnight: converted.crossesMidnight,
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
      crossesMidnight: converted.crossesMidnight,
    };
  }

  // Fallback (shouldn't happen with valid input)
  // Compute crossesMidnight for fallback too
  const startMins = timeToMinutes(input.startTime);
  const endMins = timeToMinutes(input.endTime);
  const crossesMidnight = endMins <= startMins && input.endTime !== input.startTime;

  return {
    dayOfWeek: input.dayOfWeek ?? null,
    specificDate: input.specificDate ?? null,
    startTime: input.startTime,
    endTime: input.endTime,
    originalTimezone: userTimezone,
    originalDayOfWeek: null,
    crossesMidnight,
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

/**
 * Convert a pattern from one timezone to another
 *
 * @param days - Array of days of week in source timezone (0-6)
 * @param startTime - Start time in source timezone (HH:MM)
 * @param endTime - End time in source timezone (HH:MM)
 * @param fromTz - Source timezone
 * @param toTz - Target timezone
 * @returns Converted days and times in target timezone
 *
 * @example
 * // 3pm-9pm PST on weekdays becomes different times/days in Manila
 * convertPatternBetweenTimezones([1,2,3,4,5], "15:00", "21:00", "America/Los_Angeles", "Asia/Manila")
 */
export function convertPatternBetweenTimezones(
  days: number[],
  startTime: string,
  endTime: string,
  fromTz: string,
  toTz: string
): { days: number[]; startTime: string; endTime: string } {
  if (fromTz === toTz) {
    return { days: [...days], startTime, endTime };
  }

  // Check if this is a full-day pattern (00:00-24:00)
  // Full-day patterns are treated semantically: "available all day Monday" means
  // "available the entire Monday" in whatever timezone you're viewing.
  // This is because the UI pattern editor doesn't support crossesMidnight patterns.
  const isFullDay = startTime === "00:00" && endTime === "24:00";

  if (isFullDay) {
    // Semantic interpretation: "all day" means 00:00-24:00 in the target timezone too
    // We still need to figure out which day(s) to show based on timezone offset
    // For simplicity, keep the same days - "Monday all day" stays "Monday all day"
    return {
      days: [...days],
      startTime: "00:00",
      endTime: "24:00",
    };
  }

  // Convert through UTC: fromTz -> UTC -> toTz
  // All days should map consistently since we're dealing with the same time range
  // Just use the first day to determine the conversion, then apply to all days
  const newDays: number[] = [];
  let newStartTime = startTime;
  let newEndTime = endTime;

  for (const day of days) {
    // Convert to UTC
    const utc = convertPatternToUTC(day, startTime, endTime, fromTz);
    // Convert from UTC to target timezone, passing crossesMidnight for full-day patterns
    const local = convertPatternFromUTC(utc.dayOfWeek, utc.startTime, utc.endTime, toTz, utc.crossesMidnight);

    if (!newDays.includes(local.dayOfWeek)) {
      newDays.push(local.dayOfWeek);
    }
    // Times should be the same for all days (same time range)
    newStartTime = local.startTime;
    newEndTime = local.endTime;
  }

  newDays.sort((a, b) => a - b);

  return {
    days: newDays,
    startTime: newStartTime,
    endTime: newEndTime,
  };
}
