import {
  computeEffectiveForDate,
  computeEffectiveRanges,
  isSlotAvailable,
  computeHeatmap,
  findOverlappingSlots,
  findSessionSlots,
} from "../../../lib/availability/compute-effective";
import type { AvailabilityRule } from "../../../lib/types/availability";

// Helper to create test rules
function createRule(
  overrides: Partial<AvailabilityRule> & {
    ruleType: AvailabilityRule["ruleType"];
    startTime: string;
    endTime: string;
  }
): AvailabilityRule {
  return {
    id: overrides.id || Math.random().toString(36).substring(7),
    participantId: overrides.participantId || "participant-1",
    ruleType: overrides.ruleType,
    dayOfWeek: overrides.dayOfWeek ?? null,
    specificDate: overrides.specificDate ?? null,
    startTime: overrides.startTime,
    endTime: overrides.endTime,
    originalTimezone: overrides.originalTimezone || "UTC",
    originalDayOfWeek: overrides.originalDayOfWeek ?? null,
    reason: overrides.reason ?? null,
    source: overrides.source || "manual",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("compute-effective", () => {
  describe("computeEffectiveForDate", () => {
    it("returns empty when no rules exist", () => {
      const result = computeEffectiveForDate([], "2024-01-15");
      expect(result.availableRanges).toEqual([]);
      expect(result.blockedRanges).toEqual([]);
    });

    it("applies pattern rules matching day of week", () => {
      // Jan 15, 2024 is a Monday (dayOfWeek = 1)
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1, // Monday
          startTime: "09:00",
          endTime: "17:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([
        { startMinutes: 540, endMinutes: 1020 },
      ]);
    });

    it("ignores pattern rules for different day of week", () => {
      // Jan 15, 2024 is Monday, rule is for Tuesday
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 2, // Tuesday
          startTime: "09:00",
          endTime: "17:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([]);
    });

    it("applies override rules for specific date", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_override",
          specificDate: "2024-01-15",
          startTime: "10:00",
          endTime: "14:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([
        { startMinutes: 600, endMinutes: 840 },
      ]);
    });

    it("ignores override rules for different date", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_override",
          specificDate: "2024-01-16",
          startTime: "10:00",
          endTime: "14:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([]);
    });

    it("merges overlapping available patterns", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "13:00",
        }),
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "12:00",
          endTime: "17:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([
        { startMinutes: 540, endMinutes: 1020 }, // 9am-5pm merged
      ]);
    });

    it("combines available override with pattern", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "12:00",
        }),
        createRule({
          ruleType: "available_override",
          specificDate: "2024-01-15",
          startTime: "14:00",
          endTime: "17:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([
        { startMinutes: 540, endMinutes: 720 }, // 9am-12pm from pattern
        { startMinutes: 840, endMinutes: 1020 }, // 2pm-5pm from override
      ]);
    });
  });

  describe("blocked rules priority", () => {
    it("blocked pattern subtracts from available pattern", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
        }),
        createRule({
          ruleType: "blocked_pattern",
          dayOfWeek: 1,
          startTime: "12:00",
          endTime: "13:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([
        { startMinutes: 540, endMinutes: 720 }, // 9am-12pm
        { startMinutes: 780, endMinutes: 1020 }, // 1pm-5pm
      ]);
      expect(result.blockedRanges).toEqual([
        { startMinutes: 720, endMinutes: 780 }, // 12pm-1pm blocked
      ]);
    });

    it("blocked override subtracts from available", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
        }),
        createRule({
          ruleType: "blocked_override",
          specificDate: "2024-01-15",
          startTime: "14:00",
          endTime: "15:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([
        { startMinutes: 540, endMinutes: 840 }, // 9am-2pm
        { startMinutes: 900, endMinutes: 1020 }, // 3pm-5pm
      ]);
    });

    it("multiple blocked rules subtract correctly", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
        }),
        createRule({
          ruleType: "blocked_pattern",
          dayOfWeek: 1,
          startTime: "12:00",
          endTime: "13:00",
        }),
        createRule({
          ruleType: "blocked_override",
          specificDate: "2024-01-15",
          startTime: "15:00",
          endTime: "16:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([
        { startMinutes: 540, endMinutes: 720 }, // 9am-12pm
        { startMinutes: 780, endMinutes: 900 }, // 1pm-3pm
        { startMinutes: 960, endMinutes: 1020 }, // 4pm-5pm
      ]);
    });

    it("blocked rule completely removes availability", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "10:00",
          endTime: "12:00",
        }),
        createRule({
          ruleType: "blocked_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "13:00",
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([]);
    });
  });

  describe("computeEffectiveRanges", () => {
    it("computes for date range", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1, // Monday
          startTime: "09:00",
          endTime: "17:00",
        }),
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 2, // Tuesday
          startTime: "10:00",
          endTime: "18:00",
        }),
      ];

      const result = computeEffectiveRanges(rules, {
        startDate: "2024-01-15", // Monday
        endDate: "2024-01-16", // Tuesday
      });

      expect(result.size).toBe(2);
      expect(result.get("2024-01-15")?.availableRanges).toEqual([
        { startMinutes: 540, endMinutes: 1020 },
      ]);
      expect(result.get("2024-01-16")?.availableRanges).toEqual([
        { startMinutes: 600, endMinutes: 1080 },
      ]);
    });
  });

  describe("isSlotAvailable", () => {
    it("returns true for available slots", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
        }),
      ];

      expect(isSlotAvailable(rules, "2024-01-15", "10:00")).toBe(true);
      expect(isSlotAvailable(rules, "2024-01-15", "12:00")).toBe(true);
    });

    it("returns false for unavailable slots", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
        }),
      ];

      expect(isSlotAvailable(rules, "2024-01-15", "08:00")).toBe(false);
      expect(isSlotAvailable(rules, "2024-01-15", "18:00")).toBe(false);
    });

    it("respects blocked rules", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
        }),
        createRule({
          ruleType: "blocked_pattern",
          dayOfWeek: 1,
          startTime: "12:00",
          endTime: "13:00",
        }),
      ];

      expect(isSlotAvailable(rules, "2024-01-15", "11:30")).toBe(true);
      expect(isSlotAvailable(rules, "2024-01-15", "12:00")).toBe(false);
      expect(isSlotAvailable(rules, "2024-01-15", "13:00")).toBe(true);
    });
  });

  describe("computeHeatmap", () => {
    it("aggregates availability from multiple participants", () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      participantRules.set("p1", [
        createRule({
          participantId: "p1",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "11:00",
        }),
      ]);

      participantRules.set("p2", [
        createRule({
          participantId: "p2",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "10:00",
          endTime: "12:00",
        }),
      ]);

      const heatmap = computeHeatmap(participantRules, {
        startDate: "2024-01-15",
        endDate: "2024-01-15",
      });

      // 9:00-9:30, 9:30-10:00 - only p1
      expect(heatmap.get("2024-01-15|09:00")?.count).toBe(1);
      expect(heatmap.get("2024-01-15|09:30")?.count).toBe(1);

      // 10:00-10:30, 10:30-11:00 - both p1 and p2
      expect(heatmap.get("2024-01-15|10:00")?.count).toBe(2);
      expect(heatmap.get("2024-01-15|10:30")?.count).toBe(2);

      // 11:00-11:30, 11:30-12:00 - only p2
      expect(heatmap.get("2024-01-15|11:00")?.count).toBe(1);
      expect(heatmap.get("2024-01-15|11:30")?.count).toBe(1);

      // Verify participants
      expect(heatmap.get("2024-01-15|10:00")?.participantIds).toContain("p1");
      expect(heatmap.get("2024-01-15|10:00")?.participantIds).toContain("p2");
    });
  });

  describe("findOverlappingSlots", () => {
    it("finds slots where all participants are available", () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      participantRules.set("p1", [
        createRule({
          participantId: "p1",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "12:00",
        }),
      ]);

      participantRules.set("p2", [
        createRule({
          participantId: "p2",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "10:00",
          endTime: "14:00",
        }),
      ]);

      const overlapping = findOverlappingSlots(participantRules, {
        startDate: "2024-01-15",
        endDate: "2024-01-15",
      });

      // Only 10:00-12:00 should have both participants
      const times = overlapping.map((s) => s.time);
      expect(times).toContain("10:00");
      expect(times).toContain("10:30");
      expect(times).toContain("11:00");
      expect(times).toContain("11:30");
      expect(times).not.toContain("09:00");
      expect(times).not.toContain("12:00");
    });

    it("respects minParticipants parameter", () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      participantRules.set("p1", [
        createRule({
          participantId: "p1",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "12:00",
        }),
      ]);

      participantRules.set("p2", [
        createRule({
          participantId: "p2",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "10:00",
          endTime: "14:00",
        }),
      ]);

      // With minParticipants: 1, should get all slots
      const withMin1 = findOverlappingSlots(
        participantRules,
        { startDate: "2024-01-15", endDate: "2024-01-15" },
        1
      );
      expect(withMin1.some((s) => s.time === "09:00")).toBe(true);
      expect(withMin1.some((s) => s.time === "13:00")).toBe(true);
    });
  });

  describe("findSessionSlots", () => {
    it("finds consecutive slots for session length", () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      participantRules.set("p1", [
        createRule({
          participantId: "p1",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "13:00",
        }),
      ]);

      participantRules.set("p2", [
        createRule({
          participantId: "p2",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "10:00",
          endTime: "14:00",
        }),
      ]);

      // Find 2-hour (120 min) sessions
      const sessions = findSessionSlots(
        participantRules,
        { startDate: "2024-01-15", endDate: "2024-01-15" },
        120
      );

      // Should find sessions starting at 10:00, 10:30, 11:00 (all have 2+ hours of consecutive overlap)
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions.some((s) => s.startTime === "10:00")).toBe(true);
    });

    it("returns empty when no session-length availability exists", () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      participantRules.set("p1", [
        createRule({
          participantId: "p1",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00", // Only 1 hour
        }),
      ]);

      participantRules.set("p2", [
        createRule({
          participantId: "p2",
          ruleType: "available_pattern",
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00",
        }),
      ]);

      // Try to find 2-hour sessions - should fail
      const sessions = findSessionSlots(
        participantRules,
        { startDate: "2024-01-15", endDate: "2024-01-15" },
        120
      );

      expect(sessions.length).toBe(0);
    });
  });

  describe("overnight availability", () => {
    it("handles overnight patterns correctly", () => {
      const rules: AvailabilityRule[] = [
        createRule({
          ruleType: "available_pattern",
          dayOfWeek: 1, // Monday
          startTime: "22:00",
          endTime: "02:00", // Overnight to Tuesday
        }),
      ];

      const result = computeEffectiveForDate(rules, "2024-01-15");
      expect(result.availableRanges).toEqual([
        { startMinutes: 1320, endMinutes: 1560 }, // 22:00 to 26:00 (02:00 next day)
      ]);
    });
  });
});
