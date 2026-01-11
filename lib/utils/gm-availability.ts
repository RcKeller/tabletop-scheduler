import type { GeneralAvailability, TimeSlot } from "@/lib/types";

interface GmAvailabilityBounds {
  earliest: string | null; // "17:00" or null if no availability
  latest: string | null;   // "23:00" or null if no availability
}

/**
 * Calculate the earliest and latest availability bounds from GM's patterns and slots.
 * This is used to show callouts to players about when the GM is available.
 *
 * @param patterns - General availability patterns (weekly recurring)
 * @param slots - Specific time slots (date-specific overrides)
 * @returns The earliest and latest times the GM has marked as available
 */
export function getGmAvailabilityBounds(
  patterns: GeneralAvailability[],
  slots: TimeSlot[]
): GmAvailabilityBounds {
  const availableTimes: string[] = [];

  // Collect times from patterns (only where isAvailable is true or undefined)
  for (const pattern of patterns) {
    if (pattern.isAvailable === false) continue;

    // Parse start and end times
    const startMinutes = timeToMinutes(pattern.startTime);
    const endMinutes = timeToMinutes(pattern.endTime);

    if (startMinutes !== null && endMinutes !== null) {
      availableTimes.push(pattern.startTime);
      // For end time, we want to include the full block, so add the last slot start
      // End time is exclusive, so the last available slot starts 30 min before
      const lastSlotMinutes = endMinutes > 0 ? endMinutes - 30 : endMinutes;
      availableTimes.push(minutesToTime(lastSlotMinutes));
    }
  }

  // Collect times from slots (specific date overrides - if they exist, they're available)
  for (const slot of slots) {
    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = timeToMinutes(slot.endTime);

    if (startMinutes !== null && endMinutes !== null) {
      availableTimes.push(slot.startTime);
      // End time is exclusive, so the last available slot starts 30 min before
      const lastSlotMinutes = endMinutes > 0 ? endMinutes - 30 : endMinutes;
      availableTimes.push(minutesToTime(lastSlotMinutes));
    }
  }

  if (availableTimes.length === 0) {
    return { earliest: null, latest: null };
  }

  // Find min and max times
  let earliestMinutes = Infinity;
  let latestMinutes = -Infinity;

  for (const time of availableTimes) {
    const minutes = timeToMinutes(time);
    if (minutes === null) continue;

    if (minutes < earliestMinutes) {
      earliestMinutes = minutes;
    }
    if (minutes > latestMinutes) {
      latestMinutes = minutes;
    }
  }

  if (earliestMinutes === Infinity || latestMinutes === -Infinity) {
    return { earliest: null, latest: null };
  }

  return {
    earliest: minutesToTime(earliestMinutes),
    latest: minutesToTime(latestMinutes + 30), // Add 30 min back for display (end of last slot)
  };
}

/**
 * Convert a time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to a time string (HH:MM)
 */
function minutesToTime(minutes: number): string {
  // Handle negative or overflow
  while (minutes < 0) minutes += 24 * 60;
  minutes = minutes % (24 * 60);

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Format a 24hr time string to a more readable format
 * e.g., "17:00" -> "5:00 PM"
 */
export function formatTimeDisplay(time: string): string {
  const minutes = timeToMinutes(time);
  if (minutes === null) return time;

  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  const ampm = hours24 < 12 ? "AM" : "PM";

  return mins === 0 ? `${hours12} ${ampm}` : `${hours12}:${mins.toString().padStart(2, "0")} ${ampm}`;
}
