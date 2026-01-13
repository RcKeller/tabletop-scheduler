/**
 * Unit tests for pattern editor behavior
 * Tests the core data transformations used by AvailabilityEditor
 */

import {
  computeEffectiveRanges,
  prepareRuleForStorage,
  convertPatternFromUTC,
  convertPatternToUTC,
  type AvailabilityRule,
  type CreateAvailabilityRuleInput,
  type DateRange,
} from "@/lib/availability";

// Helper to create a pattern rule (as stored in DB - UTC times)
function createPatternRule(
  id: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  isAvailable: boolean = true,
  originalTimezone: string = "UTC"
): AvailabilityRule {
  return {
    id,
    participantId: "test-participant",
    ruleType: isAvailable ? "available_pattern" : "blocked_pattern",
    dayOfWeek,
    specificDate: null,
    startTime,
    endTime,
    originalTimezone,
    originalDayOfWeek: dayOfWeek,
    reason: null,
    source: "manual",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Helper to create an override rule
function createOverrideRule(
  id: string,
  date: string,
  startTime: string,
  endTime: string,
  isAvailable: boolean = true
): AvailabilityRule {
  return {
    id,
    participantId: "test-participant",
    ruleType: isAvailable ? "available_override" : "blocked_override",
    dayOfWeek: null,
    specificDate: date,
    startTime,
    endTime,
    originalTimezone: "UTC",
    originalDayOfWeek: null,
    reason: null,
    source: "manual",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("Pattern Editor: Timezone Conversion", () => {
  describe("convertPatternToUTC", () => {
    it("converts Manila morning time to UTC (previous day)", () => {
      // Manila is UTC+8
      // 7am Manila = 11pm UTC previous day
      const result = convertPatternToUTC(1, "07:00", "09:00", "Asia/Manila");

      expect(result.dayOfWeek).toBe(0); // Sunday UTC (Monday Manila)
      expect(result.startTime).toBe("23:00");
      expect(result.endTime).toBe("01:00"); // Next day
    });

    it("converts LA evening time to UTC (same/next day)", () => {
      // LA is UTC-8
      // 6pm LA = 2am UTC next day
      const result = convertPatternToUTC(1, "18:00", "22:00", "America/Los_Angeles");

      expect(result.dayOfWeek).toBe(2); // Tuesday UTC (Monday LA evening)
      expect(result.startTime).toBe("02:00");
      expect(result.endTime).toBe("06:00");
    });

    it("handles overnight patterns in local time", () => {
      // 10pm to 2am Tokyo time
      // Tokyo is UTC+9
      // 10pm Tokyo = 1pm UTC same day
      // 2am Tokyo = 5pm UTC previous day (but since it's next day, same UTC day)
      const result = convertPatternToUTC(1, "22:00", "02:00", "Asia/Tokyo");

      // 22:00 Tokyo Monday = 13:00 UTC Monday
      // 02:00 Tokyo Tuesday = 17:00 UTC Monday
      expect(result.dayOfWeek).toBe(1);
      expect(result.startTime).toBe("13:00");
      expect(result.endTime).toBe("17:00");
    });

    it("handles UTC timezone (no conversion)", () => {
      const result = convertPatternToUTC(3, "14:00", "18:00", "UTC");

      expect(result.dayOfWeek).toBe(3);
      expect(result.startTime).toBe("14:00");
      expect(result.endTime).toBe("18:00");
    });
  });

  describe("convertPatternFromUTC", () => {
    it("converts UTC to Manila time (next day for early UTC)", () => {
      // 23:00 UTC Sunday = 7am Monday Manila
      const result = convertPatternFromUTC(0, "23:00", "01:00", "Asia/Manila");

      expect(result.dayOfWeek).toBe(1); // Monday Manila
      expect(result.startTime).toBe("07:00");
      expect(result.endTime).toBe("09:00");
    });

    it("converts UTC to LA time (previous day for late UTC)", () => {
      // 2am UTC Tuesday = 6pm Monday LA
      const result = convertPatternFromUTC(2, "02:00", "06:00", "America/Los_Angeles");

      expect(result.dayOfWeek).toBe(1); // Monday LA
      expect(result.startTime).toBe("18:00");
      expect(result.endTime).toBe("22:00");
    });

    it("handles UTC timezone (no conversion)", () => {
      const result = convertPatternFromUTC(3, "14:00", "18:00", "UTC");

      expect(result.dayOfWeek).toBe(3);
      expect(result.startTime).toBe("14:00");
      expect(result.endTime).toBe("18:00");
    });
  });

  describe("round-trip conversion", () => {
    it("Manila time survives round-trip", () => {
      const original = { dayOfWeek: 1, startTime: "07:00", endTime: "09:00" };
      const timezone = "Asia/Manila";

      const toUtc = convertPatternToUTC(original.dayOfWeek, original.startTime, original.endTime, timezone);
      const backToLocal = convertPatternFromUTC(toUtc.dayOfWeek, toUtc.startTime, toUtc.endTime, timezone);

      expect(backToLocal.dayOfWeek).toBe(original.dayOfWeek);
      expect(backToLocal.startTime).toBe(original.startTime);
      expect(backToLocal.endTime).toBe(original.endTime);
    });

    it("LA time survives round-trip", () => {
      const original = { dayOfWeek: 5, startTime: "18:00", endTime: "23:00" };
      const timezone = "America/Los_Angeles";

      const toUtc = convertPatternToUTC(original.dayOfWeek, original.startTime, original.endTime, timezone);
      const backToLocal = convertPatternFromUTC(toUtc.dayOfWeek, toUtc.startTime, toUtc.endTime, timezone);

      expect(backToLocal.dayOfWeek).toBe(original.dayOfWeek);
      expect(backToLocal.startTime).toBe(original.startTime);
      expect(backToLocal.endTime).toBe(original.endTime);
    });
  });
});

describe("Pattern Editor: Effective Availability Computation", () => {
  describe("basic patterns", () => {
    it("computes availability for weekday pattern", () => {
      // Pattern: available Monday-Friday 9am-5pm UTC
      const rules: AvailabilityRule[] = [
        createPatternRule("1", 1, "09:00", "17:00"), // Monday
        createPatternRule("2", 2, "09:00", "17:00"), // Tuesday
        createPatternRule("3", 3, "09:00", "17:00"), // Wednesday
        createPatternRule("4", 4, "09:00", "17:00"), // Thursday
        createPatternRule("5", 5, "09:00", "17:00"), // Friday
      ];

      const dateRange: DateRange = {
        startDate: "2025-01-06", // Monday
        endDate: "2025-01-12",   // Sunday
      };

      const result = computeEffectiveRanges(rules, dateRange);

      // Monday should have 9am-5pm
      const monday = result.get("2025-01-06");
      expect(monday?.availableRanges).toHaveLength(1);
      expect(monday?.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 1020 }); // 9:00-17:00

      // Saturday should have no availability
      const saturday = result.get("2025-01-11");
      expect(saturday?.availableRanges).toHaveLength(0);

      // Sunday should have no availability
      const sunday = result.get("2025-01-12");
      expect(sunday?.availableRanges).toHaveLength(0);
    });

    it("computes availability for multiple time blocks", () => {
      // Pattern: available Monday 2am-1pm AND 5pm-10pm UTC
      const rules: AvailabilityRule[] = [
        createPatternRule("1", 1, "02:00", "13:00"), // 2am-1pm
        createPatternRule("2", 1, "17:00", "22:00"), // 5pm-10pm
      ];

      const dateRange: DateRange = {
        startDate: "2025-01-06", // Monday
        endDate: "2025-01-06",
      };

      const result = computeEffectiveRanges(rules, dateRange);

      const monday = result.get("2025-01-06");
      expect(monday?.availableRanges).toHaveLength(2);
      expect(monday?.availableRanges[0]).toEqual({ startMinutes: 120, endMinutes: 780 }); // 2:00-13:00
      expect(monday?.availableRanges[1]).toEqual({ startMinutes: 1020, endMinutes: 1320 }); // 17:00-22:00
    });
  });

  describe("blocked patterns", () => {
    it("blocks time from available pattern", () => {
      // Pattern: available Monday 9am-5pm UTC, but blocked 12pm-1pm
      const rules: AvailabilityRule[] = [
        createPatternRule("1", 1, "09:00", "17:00", true),  // Available 9-5
        createPatternRule("2", 1, "12:00", "13:00", false), // Blocked 12-1 (lunch)
      ];

      const dateRange: DateRange = {
        startDate: "2025-01-06",
        endDate: "2025-01-06",
      };

      const result = computeEffectiveRanges(rules, dateRange);

      const monday = result.get("2025-01-06");
      expect(monday?.availableRanges).toHaveLength(2);
      expect(monday?.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 720 }); // 9:00-12:00
      expect(monday?.availableRanges[1]).toEqual({ startMinutes: 780, endMinutes: 1020 }); // 13:00-17:00
    });

    it("blocked pattern takes priority over available pattern", () => {
      // If all of Monday is blocked, nothing should be available
      const rules: AvailabilityRule[] = [
        createPatternRule("1", 1, "09:00", "17:00", true),  // Available 9-5
        createPatternRule("2", 1, "00:00", "23:30", false), // Blocked all day
      ];

      const dateRange: DateRange = {
        startDate: "2025-01-06",
        endDate: "2025-01-06",
      };

      const result = computeEffectiveRanges(rules, dateRange);

      const monday = result.get("2025-01-06");
      expect(monday?.availableRanges).toHaveLength(0);
    });
  });

  describe("overrides", () => {
    it("override adds availability on a specific date", () => {
      // No patterns, just a specific date override
      const rules: AvailabilityRule[] = [
        createOverrideRule("1", "2025-01-06", "10:00", "14:00", true),
      ];

      const dateRange: DateRange = {
        startDate: "2025-01-06",
        endDate: "2025-01-07",
      };

      const result = computeEffectiveRanges(rules, dateRange);

      const monday = result.get("2025-01-06");
      expect(monday?.availableRanges).toHaveLength(1);
      expect(monday?.availableRanges[0]).toEqual({ startMinutes: 600, endMinutes: 840 }); // 10:00-14:00

      const tuesday = result.get("2025-01-07");
      expect(tuesday?.availableRanges).toHaveLength(0);
    });

    it("blocked override removes availability from pattern", () => {
      // Pattern: available Monday 9-5
      // Override: blocked specifically on 2025-01-06
      const rules: AvailabilityRule[] = [
        createPatternRule("1", 1, "09:00", "17:00", true),
        createOverrideRule("2", "2025-01-06", "09:00", "17:00", false),
      ];

      const dateRange: DateRange = {
        startDate: "2025-01-06",
        endDate: "2025-01-13", // Two Mondays
      };

      const result = computeEffectiveRanges(rules, dateRange);

      // First Monday should be blocked (override)
      const firstMonday = result.get("2025-01-06");
      expect(firstMonday?.availableRanges).toHaveLength(0);

      // Second Monday should still be available (pattern)
      const secondMonday = result.get("2025-01-13");
      expect(secondMonday?.availableRanges).toHaveLength(1);
      expect(secondMonday?.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 1020 });
    });
  });
});

describe("Pattern Editor: Timezone Switching Scenarios", () => {
  it("Manila user creates availability, viewed from LA shows different times", () => {
    // User in Manila creates "Monday 7am-9am"
    // This should appear as "Sunday 3pm-5pm" when viewed from LA

    // First, prepare the rule as Manila user would
    const manilaPattern = prepareRuleForStorage(
      {
        ruleType: "available_pattern" as const,
        dayOfWeek: 1, // Monday in Manila
        startTime: "07:00",
        endTime: "09:00",
      },
      "Asia/Manila"
    );

    // Create the rule with UTC values
    const rule = createPatternRule(
      "1",
      manilaPattern.dayOfWeek!,
      manilaPattern.startTime,
      manilaPattern.endTime,
      true,
      "Asia/Manila"
    );

    // Convert to LA display timezone
    const laView = convertPatternFromUTC(
      rule.dayOfWeek!,
      rule.startTime,
      rule.endTime,
      "America/Los_Angeles"
    );

    // Manila Monday 7am = UTC Sunday 11pm = LA Sunday 3pm
    expect(laView.dayOfWeek).toBe(0); // Sunday in LA
    expect(laView.startTime).toBe("15:00"); // 3pm
    expect(laView.endTime).toBe("17:00"); // 5pm
  });

  it("LA user creates evening availability, viewed from Tokyo shows next morning", () => {
    // User in LA creates "Friday 6pm-10pm"
    // This should appear as "Saturday 11am-3pm" when viewed from Tokyo

    const laPattern = prepareRuleForStorage(
      {
        ruleType: "available_pattern" as const,
        dayOfWeek: 5, // Friday in LA
        startTime: "18:00",
        endTime: "22:00",
      },
      "America/Los_Angeles"
    );

    const rule = createPatternRule(
      "1",
      laPattern.dayOfWeek!,
      laPattern.startTime,
      laPattern.endTime,
      true,
      "America/Los_Angeles"
    );

    const tokyoView = convertPatternFromUTC(
      rule.dayOfWeek!,
      rule.startTime,
      rule.endTime,
      "Asia/Tokyo"
    );

    // LA Friday 6pm = UTC Saturday 2am = Tokyo Saturday 11am
    expect(tokyoView.dayOfWeek).toBe(6); // Saturday in Tokyo
    expect(tokyoView.startTime).toBe("11:00");
    expect(tokyoView.endTime).toBe("15:00");
  });

  it("user switches timezone and sees patterns shifted correctly", () => {
    // User creates pattern in UTC, then switches to Manila
    const utcRules: AvailabilityRule[] = [
      createPatternRule("1", 1, "14:00", "18:00"), // Monday 2pm-6pm UTC
    ];

    // View from Manila (UTC+8)
    const manilaView = convertPatternFromUTC(1, "14:00", "18:00", "Asia/Manila");
    expect(manilaView.dayOfWeek).toBe(1); // Still Monday (but late night)
    expect(manilaView.startTime).toBe("22:00"); // 10pm
    expect(manilaView.endTime).toBe("02:00"); // 2am next day (displayed as overnight)

    // View from LA (UTC-8)
    const laView = convertPatternFromUTC(1, "14:00", "18:00", "America/Los_Angeles");
    expect(laView.dayOfWeek).toBe(1); // Still Monday
    expect(laView.startTime).toBe("06:00"); // 6am
    expect(laView.endTime).toBe("10:00"); // 10am
  });
});

describe("Pattern Editor: Edge Cases", () => {
  it("handles India timezone (UTC+5:30)", () => {
    const indiaPattern = prepareRuleForStorage(
      {
        ruleType: "available_pattern" as const,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      },
      "Asia/Kolkata"
    );

    // India 9am = UTC 3:30am
    expect(indiaPattern.startTime).toBe("03:30");
    // India 5pm = UTC 11:30am
    expect(indiaPattern.endTime).toBe("11:30");
    expect(indiaPattern.dayOfWeek).toBe(1); // Same day
  });

  it("handles Nepal timezone (UTC+5:45)", () => {
    const nepalPattern = prepareRuleForStorage(
      {
        ruleType: "available_pattern" as const,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      },
      "Asia/Kathmandu"
    );

    // Nepal 9am = UTC 3:15am
    expect(nepalPattern.startTime).toBe("03:15");
    // Nepal 5pm = UTC 11:15am
    expect(nepalPattern.endTime).toBe("11:15");
  });

  it("handles patterns that span midnight in UTC", () => {
    // User in Manila creates availability for 5am-8am Manila time
    // This spans midnight in UTC: 9pm previous day to 12am
    const manilaPattern = prepareRuleForStorage(
      {
        ruleType: "available_pattern" as const,
        dayOfWeek: 2, // Tuesday Manila
        startTime: "05:00",
        endTime: "08:00",
      },
      "Asia/Manila"
    );

    // Manila Tuesday 5am = UTC Monday 9pm
    expect(manilaPattern.dayOfWeek).toBe(1); // Monday UTC
    expect(manilaPattern.startTime).toBe("21:00");
    // Manila Tuesday 8am = UTC Tuesday 12am
    expect(manilaPattern.endTime).toBe("00:00");
  });

  it("handles all-day availability", () => {
    const rules: AvailabilityRule[] = [
      createPatternRule("1", 1, "00:00", "23:30"),
    ];

    const dateRange: DateRange = {
      startDate: "2025-01-06",
      endDate: "2025-01-06",
    };

    const result = computeEffectiveRanges(rules, dateRange);

    const monday = result.get("2025-01-06");
    expect(monday?.availableRanges).toHaveLength(1);
    expect(monday?.availableRanges[0]).toEqual({ startMinutes: 0, endMinutes: 1410 }); // 00:00-23:30
  });
});

describe("Pattern Editor: Bug Regression Tests", () => {
  it("gap between patterns should NOT be marked as available (regression)", () => {
    // Bug: Setting "2am-1pm M-F" and "5pm-10pm every day" incorrectly
    // shows "1pm-5pm M-F" as available (the gap)

    const rules: AvailabilityRule[] = [
      // Monday patterns
      createPatternRule("1", 1, "02:00", "13:00"), // 2am-1pm
      createPatternRule("2", 1, "17:00", "22:00"), // 5pm-10pm
    ];

    const dateRange: DateRange = {
      startDate: "2025-01-06",
      endDate: "2025-01-06",
    };

    const result = computeEffectiveRanges(rules, dateRange);
    const monday = result.get("2025-01-06");

    // Should have exactly 2 ranges, NOT 3 (no gap filling)
    expect(monday?.availableRanges).toHaveLength(2);

    // First range: 2am-1pm (120-780 minutes)
    expect(monday?.availableRanges[0]).toEqual({ startMinutes: 120, endMinutes: 780 });

    // Second range: 5pm-10pm (1020-1320 minutes)
    expect(monday?.availableRanges[1]).toEqual({ startMinutes: 1020, endMinutes: 1320 });

    // The gap (1pm-5pm = 780-1020) should NOT be in available ranges
    const hasGap = monday?.availableRanges.some(
      r => r.startMinutes <= 780 && r.endMinutes >= 1020
    );
    expect(hasGap).toBe(false);
  });

  it("blocked pattern removes availability correctly (regression)", () => {
    // Adding blocked weekends should remove weekend availability
    const rules: AvailabilityRule[] = [
      // All week available 9-5
      createPatternRule("1", 0, "09:00", "17:00"), // Sunday
      createPatternRule("2", 1, "09:00", "17:00"), // Monday
      createPatternRule("3", 2, "09:00", "17:00"), // Tuesday
      createPatternRule("4", 3, "09:00", "17:00"), // Wednesday
      createPatternRule("5", 4, "09:00", "17:00"), // Thursday
      createPatternRule("6", 5, "09:00", "17:00"), // Friday
      createPatternRule("7", 6, "09:00", "17:00"), // Saturday
      // Blocked weekends
      createPatternRule("8", 0, "00:00", "23:30", false), // Sunday blocked
      createPatternRule("9", 6, "00:00", "23:30", false), // Saturday blocked
    ];

    const dateRange: DateRange = {
      startDate: "2025-01-05", // Sunday
      endDate: "2025-01-11",   // Saturday
    };

    const result = computeEffectiveRanges(rules, dateRange);

    // Sunday should be blocked
    expect(result.get("2025-01-05")?.availableRanges).toHaveLength(0);

    // Monday-Friday should be available
    expect(result.get("2025-01-06")?.availableRanges).toHaveLength(1);
    expect(result.get("2025-01-07")?.availableRanges).toHaveLength(1);
    expect(result.get("2025-01-08")?.availableRanges).toHaveLength(1);
    expect(result.get("2025-01-09")?.availableRanges).toHaveLength(1);
    expect(result.get("2025-01-10")?.availableRanges).toHaveLength(1);

    // Saturday should be blocked
    expect(result.get("2025-01-11")?.availableRanges).toHaveLength(0);
  });

  it("overnight patterns in non-UTC timezone work correctly (regression)", () => {
    // Manila user creates "7am-9am" pattern
    // In UTC this is "11pm previous day - 1am same day"
    // The pattern should appear correctly on the grid

    const manilaPattern = prepareRuleForStorage(
      {
        ruleType: "available_pattern" as const,
        dayOfWeek: 1, // Monday Manila
        startTime: "07:00",
        endTime: "09:00",
      },
      "Asia/Manila"
    );

    const rule = createPatternRule(
      "1",
      manilaPattern.dayOfWeek!,
      manilaPattern.startTime,
      manilaPattern.endTime,
      true,
      "Asia/Manila"
    );

    // The rule should be stored as UTC Sunday 11pm - Monday 1am
    expect(rule.dayOfWeek).toBe(0); // Sunday UTC
    expect(rule.startTime).toBe("23:00");
    expect(rule.endTime).toBe("01:00");

    // Now compute effective ranges for a week
    const dateRange: DateRange = {
      startDate: "2025-01-05", // Sunday
      endDate: "2025-01-06",   // Monday
    };

    const result = computeEffectiveRanges([rule], dateRange);

    // Sunday should have 11pm-midnight availability
    // The algorithm handles overnight by extending endMinutes past 1440
    const sunday = result.get("2025-01-05");
    expect(sunday?.availableRanges.length).toBeGreaterThanOrEqual(1);

    // Should include late night - either as 1380-1440 or 1380-1500 (overnight)
    const hasSundayNight = sunday?.availableRanges.some(
      r => r.startMinutes === 1380 && r.endMinutes >= 1440
    );
    expect(hasSundayNight).toBe(true);

    // The overnight portion (00:00-01:00 Monday) is represented as endMinutes > 1440
    // on Sunday's ranges, not as a separate Monday range
    // This is the expected behavior of the algorithm
  });
});
