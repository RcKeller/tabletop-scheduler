/**
 * Availability Priority Algorithm
 *
 * Priority order (highest to lowest):
 * 1. Manual calendar adjustments (specific availability entries)
 * 2. Schedule unavailable patterns (blocks time)
 * 3. Schedule available patterns (base availability)
 *
 * This module properly handles time range subtraction so that
 * "available 1pm-5pm" + "not available 2pm-3pm" = "available 1pm-2pm and 3pm-5pm"
 */

import { addThirtyMinutes, parseTimeToMinutes, formatMinutesToTime } from "./time-slots";

interface TimeRange {
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Subtract time ranges from a base set of ranges.
 * Returns the remaining available time after subtraction.
 *
 * Example:
 *   base: [{ date: "2024-01-01", startTime: "13:00", endTime: "17:00" }]
 *   subtract: [{ date: "2024-01-01", startTime: "14:00", endTime: "15:00" }]
 *   result: [
 *     { date: "2024-01-01", startTime: "13:00", endTime: "14:00" },
 *     { date: "2024-01-01", startTime: "15:00", endTime: "17:00" }
 *   ]
 */
export function subtractTimeRanges(base: TimeRange[], subtract: TimeRange[]): TimeRange[] {
  if (subtract.length === 0) return base;

  const result: TimeRange[] = [];

  for (const slot of base) {
    // Find all subtractions that apply to this date
    const applicableSubtractions = subtract.filter(s => s.date === slot.date);

    if (applicableSubtractions.length === 0) {
      result.push(slot);
      continue;
    }

    // Sort subtractions by start time
    applicableSubtractions.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Process the slot, carving out the subtractions
    let currentStart = slot.startTime;
    const slotEnd = slot.endTime;

    for (const sub of applicableSubtractions) {
      // Skip subtractions that don't overlap with remaining slot
      if (sub.endTime <= currentStart || sub.startTime >= slotEnd) {
        continue;
      }

      // If subtraction starts after current position, keep the gap
      if (sub.startTime > currentStart) {
        result.push({
          date: slot.date,
          startTime: currentStart,
          endTime: sub.startTime,
        });
      }

      // Move current position past the subtraction
      if (sub.endTime > currentStart) {
        currentStart = sub.endTime;
      }

      // If we've passed the end of the slot, stop
      if (currentStart >= slotEnd) {
        break;
      }
    }

    // Add any remaining time after all subtractions
    if (currentStart < slotEnd) {
      result.push({
        date: slot.date,
        startTime: currentStart,
        endTime: slotEnd,
      });
    }
  }

  return result;
}

/**
 * Add (merge) time ranges together.
 * Combines overlapping and adjacent ranges.
 */
export function addTimeRanges(base: TimeRange[], additions: TimeRange[]): TimeRange[] {
  if (additions.length === 0) return base;

  const combined = [...base, ...additions];

  // Group by date
  const byDate = new Map<string, TimeRange[]>();
  for (const slot of combined) {
    const existing = byDate.get(slot.date) || [];
    existing.push(slot);
    byDate.set(slot.date, existing);
  }

  const result: TimeRange[] = [];

  for (const [date, slots] of byDate) {
    if (slots.length === 0) continue;

    // Sort by start time
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let current = { ...slots[0] };

    for (let i = 1; i < slots.length; i++) {
      const next = slots[i];

      // Check if overlapping or adjacent
      if (next.startTime <= current.endTime) {
        // Extend if next ends later
        if (next.endTime > current.endTime) {
          current.endTime = next.endTime;
        }
      } else {
        // Gap - push current and start new
        result.push(current);
        current = { ...next };
      }
    }

    result.push(current);
  }

  return result;
}

/**
 * Compute effective availability using proper priority order:
 * 1. Start with available patterns (base)
 * 2. Subtract unavailable patterns
 * 3. Apply manual overrides (additions and removals)
 *
 * @param availablePatterns - Recurring "available" time patterns expanded to date range
 * @param unavailablePatterns - Recurring "unavailable" time patterns expanded to date range
 * @param manualAdditions - Specific calendar entries adding availability (highest priority adds)
 * @param manualRemovals - Specific exceptions removing availability (highest priority removes)
 */
export function computeEffectiveAvailabilityWithPriority(
  availablePatterns: TimeRange[],
  unavailablePatterns: TimeRange[],
  manualAdditions: TimeRange[],
  manualRemovals: TimeRange[]
): TimeRange[] {
  // Step 1: Start with available patterns
  let effective = [...availablePatterns];

  // Step 2: Subtract unavailable patterns
  effective = subtractTimeRanges(effective, unavailablePatterns);

  // Step 3: Add manual additions (these override pattern-based removals)
  effective = addTimeRanges(effective, manualAdditions);

  // Step 4: Subtract manual removals (highest priority)
  effective = subtractTimeRanges(effective, manualRemovals);

  return effective;
}

/**
 * Convert a slot-based representation (Set of "date-time" keys) to TimeRange array
 */
export function slotKeysToRanges(keys: Set<string>): TimeRange[] {
  const sortedKeys = Array.from(keys).sort();
  const byDate = new Map<string, string[]>();

  for (const key of sortedKeys) {
    const parts = key.split("-");
    const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
    const time = parts[3];

    const times = byDate.get(date) || [];
    times.push(time);
    byDate.set(date, times);
  }

  const result: TimeRange[] = [];

  for (const [date, times] of byDate) {
    times.sort();

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
 * Convert TimeRange array to a slot-based representation (Set of "date-time" keys)
 */
export function rangesToSlotKeys(ranges: TimeRange[]): Set<string> {
  const keys = new Set<string>();

  for (const range of ranges) {
    // Skip invalid ranges
    if (range.startTime >= range.endTime) continue;

    let currentTime = range.startTime;
    let iterations = 0;
    const maxIterations = 48;

    while (currentTime < range.endTime && iterations < maxIterations) {
      keys.add(`${range.date}-${currentTime}`);
      currentTime = addThirtyMinutes(currentTime);
      iterations++;
    }
  }

  return keys;
}
