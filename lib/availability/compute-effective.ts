/**
 * Core algorithm for computing effective availability from rules
 *
 * Priority system (highest wins):
 * 1. blocked_override - One-off blocks always take precedence
 * 2. blocked_pattern - Recurring blocks
 * 3. available_override - One-off availability additions
 * 4. available_pattern - Recurring weekly availability
 *
 * Algorithm operates on TIME RANGES for efficiency.
 * Slot expansion only happens at UI render time.
 */

import type {
  AvailabilityRule,
  TimeRange,
  DayAvailability,
  DateRange,
} from "../types/availability";
import {
  createRange,
  mergeRanges,
  subtractRanges,
  addRanges,
  timeToMinutes,
} from "./range-math";
import { getUTCDayOfWeek, getDateRange } from "./timezone";

/**
 * Filter rules by type
 */
function filterByType(
  rules: AvailabilityRule[],
  ...types: AvailabilityRule["ruleType"][]
): AvailabilityRule[] {
  return rules.filter((r) => types.includes(r.ruleType));
}

/**
 * Get pattern rules that apply to a specific UTC day of week
 */
function getPatternsForDay(
  rules: AvailabilityRule[],
  utcDayOfWeek: number
): AvailabilityRule[] {
  return rules.filter(
    (r) =>
      (r.ruleType === "available_pattern" ||
        r.ruleType === "blocked_pattern") &&
      r.dayOfWeek === utcDayOfWeek
  );
}

/**
 * Get override rules that apply to a specific UTC date
 */
function getOverridesForDate(
  rules: AvailabilityRule[],
  utcDate: string
): AvailabilityRule[] {
  return rules.filter(
    (r) =>
      (r.ruleType === "available_override" ||
        r.ruleType === "blocked_override") &&
      r.specificDate === utcDate
  );
}

/**
 * Convert rules to time ranges
 */
function rulesToRanges(rules: AvailabilityRule[]): TimeRange[] {
  return rules.map((rule) => createRange(rule.startTime, rule.endTime));
}

/**
 * Compute effective availability for a single UTC date
 *
 * @param rules - All rules for the participant
 * @param utcDate - The date in UTC (YYYY-MM-DD)
 * @returns Effective availability with available and blocked ranges
 */
export function computeEffectiveForDate(
  rules: AvailabilityRule[],
  utcDate: string
): DayAvailability {
  const utcDayOfWeek = getUTCDayOfWeek(utcDate);

  // Step 1: Get base availability from patterns
  const availablePatterns = filterByType(rules, "available_pattern").filter(
    (r) => r.dayOfWeek === utcDayOfWeek
  );
  let availableRanges = mergeRanges(rulesToRanges(availablePatterns));

  // Step 2: Add available overrides for this date
  const availableOverrides = filterByType(rules, "available_override").filter(
    (r) => r.specificDate === utcDate
  );
  if (availableOverrides.length > 0) {
    availableRanges = addRanges(
      availableRanges,
      rulesToRanges(availableOverrides)
    );
  }

  // Step 3: Collect blocked ranges (patterns for this day + overrides for this date)
  const blockedPatterns = filterByType(rules, "blocked_pattern").filter(
    (r) => r.dayOfWeek === utcDayOfWeek
  );
  const blockedOverrides = filterByType(rules, "blocked_override").filter(
    (r) => r.specificDate === utcDate
  );
  const blockedRanges = mergeRanges([
    ...rulesToRanges(blockedPatterns),
    ...rulesToRanges(blockedOverrides),
  ]);

  // Step 4: Subtract blocked from available
  const effectiveAvailable = subtractRanges(availableRanges, blockedRanges);

  return {
    date: utcDate,
    availableRanges: effectiveAvailable,
    blockedRanges,
  };
}

/**
 * Compute effective availability for a date range
 *
 * @param rules - All rules for the participant
 * @param range - Start and end dates (inclusive)
 * @returns Map of date -> DayAvailability
 */
export function computeEffectiveRanges(
  rules: AvailabilityRule[],
  range: DateRange
): Map<string, DayAvailability> {
  const result = new Map<string, DayAvailability>();
  const dates = getDateRange(range.startDate, range.endDate);

  for (const date of dates) {
    result.set(date, computeEffectiveForDate(rules, date));
  }

  return result;
}

/**
 * Check if a specific UTC date/time slot is available
 *
 * @param rules - All rules for the participant
 * @param utcDate - Date in UTC (YYYY-MM-DD)
 * @param utcTime - Time in UTC (HH:MM)
 * @returns true if available, false otherwise
 */
export function isSlotAvailable(
  rules: AvailabilityRule[],
  utcDate: string,
  utcTime: string
): boolean {
  const effective = computeEffectiveForDate(rules, utcDate);
  const minutes = timeToMinutes(utcTime);

  return effective.availableRanges.some(
    (range) => minutes >= range.startMinutes && minutes < range.endMinutes
  );
}

/**
 * Compute availability for multiple participants and aggregate into heatmap
 *
 * @param participantRules - Map of participantId -> rules
 * @param range - Date range to compute
 * @returns Map of "date|time" -> { count, participantIds }
 */
export function computeHeatmap(
  participantRules: Map<string, AvailabilityRule[]>,
  range: DateRange
): Map<string, { count: number; participantIds: string[] }> {
  const heatmap = new Map<string, { count: number; participantIds: string[] }>();
  const dates = getDateRange(range.startDate, range.endDate);

  // Process each participant
  for (const [participantId, rules] of participantRules) {
    for (const date of dates) {
      const effective = computeEffectiveForDate(rules, date);

      // Expand ranges to slots for heatmap aggregation
      for (const range of effective.availableRanges) {
        let minutes = range.startMinutes;
        while (minutes < range.endMinutes) {
          const time = `${Math.floor(minutes / 60)
            .toString()
            .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;

          // Handle overnight (minutes >= 1440)
          let slotDate = date;
          let slotMinutes = minutes;
          if (minutes >= 1440) {
            slotMinutes = minutes - 1440;
            // Increment date
            const d = new Date(`${date}T12:00:00Z`);
            d.setUTCDate(d.getUTCDate() + 1);
            slotDate = d.toISOString().split("T")[0];
          }

          const slotTime = `${Math.floor(slotMinutes / 60)
            .toString()
            .padStart(2, "0")}:${(slotMinutes % 60)
            .toString()
            .padStart(2, "0")}`;

          const key = `${slotDate}|${slotTime}`;
          const existing = heatmap.get(key) || { count: 0, participantIds: [] };
          existing.count++;
          existing.participantIds.push(participantId);
          heatmap.set(key, existing);

          minutes += 30; // 30-minute slots
        }
      }
    }
  }

  return heatmap;
}

/**
 * Find time slots where all participants are available
 *
 * @param participantRules - Map of participantId -> rules
 * @param range - Date range to search
 * @param minParticipants - Minimum number of participants required (default: all)
 * @returns Array of { date, time, participantIds } for qualifying slots
 */
export function findOverlappingSlots(
  participantRules: Map<string, AvailabilityRule[]>,
  range: DateRange,
  minParticipants?: number
): { date: string; time: string; participantIds: string[] }[] {
  const heatmap = computeHeatmap(participantRules, range);
  const totalParticipants = participantRules.size;
  const threshold = minParticipants ?? totalParticipants;

  const result: { date: string; time: string; participantIds: string[] }[] = [];

  for (const [key, data] of heatmap) {
    if (data.count >= threshold) {
      const [date, time] = key.split("|");
      result.push({ date, time, participantIds: data.participantIds });
    }
  }

  // Sort by date then time
  result.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  return result;
}

/**
 * Compute session-length availability (consecutive slots)
 *
 * @param participantRules - Map of participantId -> rules
 * @param range - Date range to search
 * @param sessionMinutes - Required session length in minutes
 * @param minParticipants - Minimum participants required
 * @returns Array of session start slots that have enough consecutive availability
 */
export function findSessionSlots(
  participantRules: Map<string, AvailabilityRule[]>,
  range: DateRange,
  sessionMinutes: number,
  minParticipants?: number
): { date: string; startTime: string; endTime: string; participantIds: string[] }[] {
  const overlapping = findOverlappingSlots(participantRules, range, minParticipants);
  const slotsNeeded = Math.ceil(sessionMinutes / 30);

  // Group by date for easier processing
  const byDate = new Map<string, { time: string; participantIds: string[] }[]>();
  for (const slot of overlapping) {
    if (!byDate.has(slot.date)) {
      byDate.set(slot.date, []);
    }
    byDate.get(slot.date)!.push({ time: slot.time, participantIds: slot.participantIds });
  }

  const sessions: {
    date: string;
    startTime: string;
    endTime: string;
    participantIds: string[];
  }[] = [];

  for (const [date, slots] of byDate) {
    // Sort slots by time
    slots.sort((a, b) => a.time.localeCompare(b.time));

    // Find consecutive runs
    for (let i = 0; i <= slots.length - slotsNeeded; i++) {
      // Check if we have enough consecutive slots
      let isConsecutive = true;
      const participantSets = [new Set(slots[i].participantIds)];

      for (let j = 1; j < slotsNeeded; j++) {
        const prevTime = slots[i + j - 1].time;
        const currTime = slots[i + j].time;

        // Check if times are consecutive (30 min apart)
        const prevMins = timeToMinutes(prevTime);
        const currMins = timeToMinutes(currTime);

        if (currMins - prevMins !== 30) {
          isConsecutive = false;
          break;
        }

        participantSets.push(new Set(slots[i + j].participantIds));
      }

      if (isConsecutive) {
        // Find participants available for all slots
        const commonParticipants = [...participantSets[0]].filter((p) =>
          participantSets.every((set) => set.has(p))
        );

        if (commonParticipants.length >= (minParticipants ?? participantRules.size)) {
          const startTime = slots[i].time;
          const lastSlotTime = slots[i + slotsNeeded - 1].time;
          const lastMins = timeToMinutes(lastSlotTime);
          const endMins = lastMins + 30;
          const endTime = `${Math.floor(endMins / 60)
            .toString()
            .padStart(2, "0")}:${(endMins % 60).toString().padStart(2, "0")}`;

          sessions.push({
            date,
            startTime,
            endTime,
            participantIds: commonParticipants,
          });
        }
      }
    }
  }

  return sessions;
}
