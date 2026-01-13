/**
 * Integration tests for pattern availability flow
 *
 * Tests the complete pipeline:
 * Pattern entry → Timezone conversion → UTC storage → Computation → Display
 */

import {
  computeEffectiveRanges,
  convertPatternToUTC,
  convertPatternFromUTC,
  prepareRuleForStorage,
  minutesToTime,
  timeToMinutes,
  utcToLocal,
} from "@/lib/availability";
import type { AvailabilityRule, DateRange, CreateAvailabilityRuleInput } from "@/lib/types/availability";

// Merge adjacent slots on the same date
function mergeAdjacentSlots(
  slots: { date: string; startTime: string; endTime: string }[]
): { date: string; startTime: string; endTime: string }[] {
  if (slots.length === 0) return [];

  // Group by date
  const byDate = new Map<string, { startTime: string; endTime: string }[]>();
  for (const slot of slots) {
    if (!byDate.has(slot.date)) {
      byDate.set(slot.date, []);
    }
    byDate.get(slot.date)!.push({ startTime: slot.startTime, endTime: slot.endTime });
  }

  const result: { date: string; startTime: string; endTime: string }[] = [];

  for (const [date, daySlots] of byDate) {
    // Sort by start time
    daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Merge adjacent/overlapping slots
    let current = daySlots[0];
    for (let i = 1; i < daySlots.length; i++) {
      const next = daySlots[i];
      // Check if adjacent or overlapping (endTime >= next.startTime)
      if (current.endTime >= next.startTime) {
        // Merge: extend current's end time
        current = {
          startTime: current.startTime,
          endTime: current.endTime > next.endTime ? current.endTime : next.endTime,
        };
      } else {
        // Gap: push current and start new
        result.push({ date, ...current });
        current = next;
      }
    }
    result.push({ date, ...current });
  }

  return result;
}

// Simulates what VirtualizedAvailabilityGrid.convertAvailabilityToLocal does
function convertSlotsToLocal(
  slots: { date: string; startTime: string; endTime: string }[],
  timezone: string
): { date: string; startTime: string; endTime: string }[] {
  if (timezone === "UTC") return slots;

  const result: { date: string; startTime: string; endTime: string }[] = [];

  for (const slot of slots) {
    const start = utcToLocal(slot.startTime, slot.date, timezone);

    // Handle "24:00" as "end of this day" = "00:00 of next day"
    let end;
    if (slot.endTime === "24:00") {
      const nextDate = new Date(slot.date + "T12:00:00Z");
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextDateStr = nextDate.toISOString().split("T")[0];
      end = utcToLocal("00:00", nextDateStr, timezone);
    } else {
      end = utcToLocal(slot.endTime, slot.date, timezone);
    }

    if (start.date === end.date) {
      if (start.time < end.time) {
        result.push({
          date: start.date,
          startTime: start.time,
          endTime: end.time,
        });
      }
    } else {
      // Slot crosses midnight when converted - split into two
      result.push({
        date: start.date,
        startTime: start.time,
        endTime: "24:00",
      });
      if (end.time > "00:00") {
        result.push({
          date: end.date,
          startTime: "00:00",
          endTime: end.time,
        });
      }
    }
  }

  return result;
}

// Helper to create a rule from pattern parameters (simulates what UI does)
function createPatternRule(
  participantId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  timezone: string,
  isAvailable: boolean = true
): AvailabilityRule {
  const ruleType = isAvailable ? "available_pattern" : "blocked_pattern";
  const prepared = prepareRuleForStorage(
    { ruleType, dayOfWeek, startTime, endTime },
    timezone
  );

  return {
    id: `test-${dayOfWeek}-${startTime}-${endTime}`,
    participantId,
    ruleType,
    dayOfWeek: prepared.dayOfWeek,
    specificDate: null,
    startTime: prepared.startTime,
    endTime: prepared.endTime,
    originalTimezone: prepared.originalTimezone,
    originalDayOfWeek: dayOfWeek,
    reason: null,
    source: "manual",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Simulate what AvailabilityEditor.rulesToTimeSlots does
function rulesToTimeSlots(
  rules: AvailabilityRule[],
  dateRange: DateRange
): { date: string; startTime: string; endTime: string }[] {
  // Expand date range by ±1 day for timezone shifts
  const expandedStart = new Date(dateRange.startDate + "T12:00:00Z");
  expandedStart.setUTCDate(expandedStart.getUTCDate() - 1);
  const expandedEnd = new Date(dateRange.endDate + "T12:00:00Z");
  expandedEnd.setUTCDate(expandedEnd.getUTCDate() + 1);

  const expandedRange: DateRange = {
    startDate: expandedStart.toISOString().split("T")[0],
    endDate: expandedEnd.toISOString().split("T")[0],
  };

  const effectiveRanges = computeEffectiveRanges(rules, expandedRange);
  const slots: { date: string; startTime: string; endTime: string }[] = [];

  for (const [date, dayAvail] of effectiveRanges) {
    for (const range of dayAvail.availableRanges) {
      // Handle overnight ranges (endMinutes >= 1440)
      if (range.endMinutes >= 1440) {
        // Split into two slots: one ending at midnight, one starting at 00:00 next day
        // Use "24:00" to represent "end of this day" (midnight)
        slots.push({
          date,
          startTime: minutesToTime(range.startMinutes),
          endTime: "24:00",
        });
        const nextDate = new Date(date + "T12:00:00Z");
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        const nextDateStr = nextDate.toISOString().split("T")[0];
        const wrappedEnd = range.endMinutes - 1440;
        if (wrappedEnd > 0) {
          slots.push({
            date: nextDateStr,
            startTime: "00:00",
            endTime: minutesToTime(wrappedEnd),
          });
        }
      } else {
        slots.push({
          date,
          startTime: minutesToTime(range.startMinutes),
          endTime: minutesToTime(range.endMinutes),
        });
      }
    }
  }

  return slots;
}

describe("Pattern Availability Integration", () => {
  const participantId = "test-participant";

  describe("User scenario: 2am-1pm M-F + 5pm-10pm every day", () => {
    // This is the exact bug reported by the user

    it("should show both time ranges as available, NOT the gap", () => {
      const timezone = "America/Los_Angeles"; // UTC-8

      // Create patterns exactly as user described
      const rules: AvailabilityRule[] = [];

      // Pattern 1: "2am-1pm M-F" (available)
      for (const day of [1, 2, 3, 4, 5]) { // Mon-Fri
        rules.push(createPatternRule(
          participantId,
          day,
          "02:00",
          "13:00",
          timezone,
          true
        ));
      }

      // Pattern 2: "5pm-10pm every day" (available)
      for (const day of [0, 1, 2, 3, 4, 5, 6]) { // All days
        rules.push(createPatternRule(
          participantId,
          day,
          "17:00",
          "22:00",
          timezone,
          true
        ));
      }

      // Log what rules we created
      console.log("Created rules:", rules.map(r => ({
        ruleType: r.ruleType,
        dayOfWeek: r.dayOfWeek,
        originalDayOfWeek: r.originalDayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        originalTimezone: r.originalTimezone,
      })));

      // Test for a week starting on a Monday
      // Jan 6, 2025 is a Monday
      const dateRange: DateRange = {
        startDate: "2025-01-06",
        endDate: "2025-01-12",
      };

      const slots = rulesToTimeSlots(rules, dateRange);

      console.log("Computed slots:", slots);

      // For Monday (2025-01-06), we should have:
      // - 2am-1pm (02:00-13:00)
      // - 5pm-10pm (17:00-22:00)
      // NOT 1pm-5pm (13:00-17:00) which is the gap

      const mondaySlots = slots.filter(s => s.date === "2025-01-06");
      console.log("Monday slots (UTC):", mondaySlots);

      // NOW CONVERT TO LOCAL TIME (as the grid does) and merge adjacent slots
      const localSlotsRaw = convertSlotsToLocal(slots, timezone);
      const localSlots = mergeAdjacentSlots(localSlotsRaw);
      console.log("All slots (converted to LA, merged):", localSlots);

      const mondayLocalSlots = localSlots.filter(s => s.date === "2025-01-06");
      console.log("Monday slots (LA time):", mondayLocalSlots);

      // Check that we have slots covering 2am-1pm LOCAL
      const has2amTo1pm = mondayLocalSlots.some(s => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        // Should cover 02:00 (120 minutes) to 13:00 (780 minutes)
        return start <= 120 && end >= 780;
      });

      // Check that we have slots covering 5pm-10pm LOCAL
      const has5pmTo10pm = mondayLocalSlots.some(s => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        // Should cover 17:00 (1020 minutes) to 22:00 (1320 minutes)
        return start <= 1020 && end >= 1320;
      });

      // Check that 1pm-5pm is NOT available (the gap)
      const gapStart = 13 * 60; // 1pm = 780 minutes
      const gapEnd = 17 * 60;   // 5pm = 1020 minutes
      const hasGap = mondayLocalSlots.some(s => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        // Would the gap be covered by this slot?
        // A slot covers the gap if it starts before the gap ends AND ends after the gap starts
        return start < gapEnd && end > gapStart;
      });

      console.log("has2amTo1pm:", has2amTo1pm);
      console.log("has5pmTo10pm:", has5pmTo10pm);
      console.log("hasGap (should be false):", hasGap);

      expect(has2amTo1pm).toBe(true);
      expect(has5pmTo10pm).toBe(true);
      expect(hasGap).toBe(false); // Gap should NOT be available
    });

    it("should correctly convert pattern times to UTC", () => {
      const timezone = "America/Los_Angeles"; // UTC-8

      // Monday 2am-1pm LA should become Monday 10am-9pm UTC
      const pattern1 = convertPatternToUTC(1, "02:00", "13:00", timezone);
      console.log("2am-1pm Monday LA -> UTC:", pattern1);

      // Monday 5pm-10pm LA should become Tuesday 1am-6am UTC
      const pattern2 = convertPatternToUTC(1, "17:00", "22:00", timezone);
      console.log("5pm-10pm Monday LA -> UTC:", pattern2);

      // For pattern1: Monday 2am LA = Monday 10am UTC
      // Day shouldn't shift
      expect(pattern1.dayOfWeek).toBe(1); // Still Monday
      expect(pattern1.startTime).toBe("10:00");
      expect(pattern1.endTime).toBe("21:00");

      // For pattern2: Monday 5pm LA = Tuesday 1am UTC
      // Day SHOULD shift to Tuesday
      expect(pattern2.dayOfWeek).toBe(2); // Tuesday
      expect(pattern2.startTime).toBe("01:00");
      expect(pattern2.endTime).toBe("06:00");
    });

    it("should compute effective ranges for UTC dates correctly", () => {
      const timezone = "America/Los_Angeles";

      // Create just the Monday patterns
      const rules: AvailabilityRule[] = [
        createPatternRule(participantId, 1, "02:00", "13:00", timezone, true), // 2am-1pm Mon
        createPatternRule(participantId, 1, "17:00", "22:00", timezone, true), // 5pm-10pm Mon
      ];

      console.log("Rules after conversion:", rules.map(r => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
      })));

      // The first rule (2am-1pm Mon LA) becomes Mon 10am-9pm UTC (dayOfWeek=1)
      // The second rule (5pm-10pm Mon LA) becomes Tue 1am-6am UTC (dayOfWeek=2)

      // So for Monday Jan 6 UTC:
      // - Only the 10am-9pm rule applies (dayOfWeek=1)
      const mondayEffective = computeEffectiveRanges(rules, {
        startDate: "2025-01-06",
        endDate: "2025-01-06",
      });

      console.log("Monday UTC effective:", mondayEffective.get("2025-01-06"));

      // For Tuesday Jan 7 UTC:
      // - Only the 1am-6am rule applies (dayOfWeek=2)
      const tuesdayEffective = computeEffectiveRanges(rules, {
        startDate: "2025-01-07",
        endDate: "2025-01-07",
      });

      console.log("Tuesday UTC effective:", tuesdayEffective.get("2025-01-07"));

      // Verify Monday UTC has 10am-9pm
      const mondayRanges = mondayEffective.get("2025-01-06")!.availableRanges;
      expect(mondayRanges.length).toBe(1);
      expect(minutesToTime(mondayRanges[0].startMinutes)).toBe("10:00");
      expect(minutesToTime(mondayRanges[0].endMinutes)).toBe("21:00");

      // Verify Tuesday UTC has 1am-6am
      const tuesdayRanges = tuesdayEffective.get("2025-01-07")!.availableRanges;
      expect(tuesdayRanges.length).toBe(1);
      expect(minutesToTime(tuesdayRanges[0].startMinutes)).toBe("01:00");
      expect(minutesToTime(tuesdayRanges[0].endMinutes)).toBe("06:00");
    });
  });

  describe("Eastern timezone (Manila UTC+8) with overnight UTC conversion", () => {
    // This tests the exact bug: patterns that cross midnight when converted to UTC

    it("should handle patterns that cross midnight in UTC", () => {
      const timezone = "Asia/Manila"; // UTC+8

      // User sets "7am-9am M-F" in Manila
      // 7am Manila = 11pm PREVIOUS DAY UTC (23:00)
      // 9am Manila = 1am SAME DAY UTC (01:00)
      // So this creates an overnight range in UTC: 23:00-01:00

      const rules: AvailabilityRule[] = [];

      // Pattern: 7am-9am Monday in Manila
      for (const day of [1, 2, 3, 4, 5]) {
        rules.push(createPatternRule(
          participantId,
          day,
          "07:00",
          "09:00",
          timezone,
          true
        ));
      }

      console.log("Manila 7am-9am rules:", rules.map(r => ({
        dayOfWeek: r.dayOfWeek,
        originalDayOfWeek: r.originalDayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
      })));

      // For Monday 7am-9am Manila:
      // - 7am Monday Manila = 11pm Sunday UTC
      // - 9am Monday Manila = 1am Monday UTC
      // So the rule should have dayOfWeek = 0 (Sunday) in UTC, times 23:00-01:00 (overnight)

      const dateRange: DateRange = {
        startDate: "2025-01-06", // Monday
        endDate: "2025-01-10",   // Friday
      };

      const slots = rulesToTimeSlots(rules, dateRange);
      console.log("Computed UTC slots for Manila 7am-9am:", slots.filter(s =>
        s.date >= "2025-01-05" && s.date <= "2025-01-11"
      ));

      // Convert to Manila time and merge adjacent slots
      const localSlotsRaw = convertSlotsToLocal(slots, timezone);
      const localSlots = mergeAdjacentSlots(localSlotsRaw);
      console.log("Converted to Manila time (merged):", localSlots.filter(s =>
        s.date >= "2025-01-06" && s.date <= "2025-01-10"
      ));

      // Monday Jan 6 in Manila should have 7am-9am availability
      const mondaySlots = localSlots.filter(s => s.date === "2025-01-06");
      console.log("Monday Manila slots:", mondaySlots);

      // Check that 7am-9am is covered
      const has7amTo9am = mondaySlots.some(s => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        // 7am = 420 minutes, 9am = 540 minutes
        return start <= 420 && end >= 540;
      });

      expect(has7amTo9am).toBe(true);
    });

    it("should show both patterns correctly in Manila timezone", () => {
      const timezone = "Asia/Manila"; // UTC+8

      // User sets:
      // 1. "5pm-11pm every day" (17:00-23:00 Manila = 09:00-15:00 UTC)
      // 2. "7am-9am M-F" (07:00-09:00 Manila = 23:00-01:00 UTC, overnight!)

      const rules: AvailabilityRule[] = [];

      // Pattern 1: 5pm-11pm every day
      for (const day of [0, 1, 2, 3, 4, 5, 6]) {
        rules.push(createPatternRule(participantId, day, "17:00", "23:00", timezone, true));
      }

      // Pattern 2: 7am-9am M-F
      for (const day of [1, 2, 3, 4, 5]) {
        rules.push(createPatternRule(participantId, day, "07:00", "09:00", timezone, true));
      }

      const dateRange: DateRange = {
        startDate: "2025-01-06", // Monday
        endDate: "2025-01-06",
      };

      const slots = rulesToTimeSlots(rules, dateRange);
      const localSlotsRaw = convertSlotsToLocal(slots, timezone);
      const localSlots = mergeAdjacentSlots(localSlotsRaw);
      const mondaySlots = localSlots.filter(s => s.date === "2025-01-06");

      console.log("Monday Manila with both patterns (merged):", mondaySlots);

      // Should have BOTH:
      // - 7am-9am (07:00-09:00)
      // - 5pm-11pm (17:00-23:00)

      const has7amTo9am = mondaySlots.some(s => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        return start <= 420 && end >= 540;
      });

      const has5pmTo11pm = mondaySlots.some(s => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        return start <= 1020 && end >= 1380;
      });

      // The gap (9am-5pm) should NOT be available
      const gapStart = 9 * 60;  // 9am = 540 minutes
      const gapEnd = 17 * 60;   // 5pm = 1020 minutes
      const hasGap = mondaySlots.some(s => {
        const start = timeToMinutes(s.startTime);
        const end = timeToMinutes(s.endTime);
        return start < gapEnd && end > gapStart;
      });

      expect(has7amTo9am).toBe(true);
      expect(has5pmTo11pm).toBe(true);
      expect(hasGap).toBe(false);
    });
  });

  describe("UTC timezone (no conversion)", () => {
    it("should work correctly when user is in UTC", () => {
      const timezone = "UTC";

      // Pattern: 2am-1pm Mon-Fri + 5pm-10pm every day
      const rules: AvailabilityRule[] = [];

      for (const day of [1, 2, 3, 4, 5]) {
        rules.push(createPatternRule(participantId, day, "02:00", "13:00", timezone, true));
      }
      for (const day of [0, 1, 2, 3, 4, 5, 6]) {
        rules.push(createPatternRule(participantId, day, "17:00", "22:00", timezone, true));
      }

      const dateRange: DateRange = {
        startDate: "2025-01-06", // Monday
        endDate: "2025-01-06",
      };

      const effective = computeEffectiveRanges(rules, dateRange);
      const mondayRanges = effective.get("2025-01-06")!.availableRanges;

      console.log("UTC Monday ranges:", mondayRanges.map(r => ({
        start: minutesToTime(r.startMinutes),
        end: minutesToTime(r.endMinutes),
      })));

      // Should have TWO separate ranges (not merged, because there's a gap)
      expect(mondayRanges.length).toBe(2);

      // First range: 2am-1pm
      expect(minutesToTime(mondayRanges[0].startMinutes)).toBe("02:00");
      expect(minutesToTime(mondayRanges[0].endMinutes)).toBe("13:00");

      // Second range: 5pm-10pm
      expect(minutesToTime(mondayRanges[1].startMinutes)).toBe("17:00");
      expect(minutesToTime(mondayRanges[1].endMinutes)).toBe("22:00");
    });
  });
});
