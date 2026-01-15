/**
 * REGRESSION TESTS: Pattern Save & State Management Bugs
 *
 * These tests cover state management scenarios that have broken in production.
 * Each test documents the bug, root cause, and fix.
 * DO NOT MODIFY these tests without understanding the original bug.
 */

import {
  prepareRuleForStorage,
  convertPatternFromUTC,
} from '../../lib/availability/timezone';
import {
  computeEffectiveForDate,
  computeEffectiveRanges,
} from '../../lib/availability/compute-effective';
import { createRange, timeToMinutes } from '../../lib/availability/range-math';
import type { AvailabilityRule, DateRange } from '../../lib/types/availability';

// Helper to create pattern rules
function createPatternRule(
  id: string,
  participantId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  timezone: string = 'UTC'
): AvailabilityRule {
  const prepared = prepareRuleForStorage(
    {
      ruleType: 'available_pattern',
      dayOfWeek,
      startTime,
      endTime,
    },
    timezone
  );

  return {
    id,
    participantId,
    ruleType: 'available_pattern',
    dayOfWeek: prepared.dayOfWeek,
    specificDate: null,
    startTime: prepared.startTime,
    endTime: prepared.endTime,
    originalTimezone: timezone,
    originalDayOfWeek: dayOfWeek,
    crossesMidnight: prepared.crossesMidnight,
    reason: null,
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Helper to create override rules
function createOverrideRule(
  id: string,
  participantId: string,
  date: string,
  startTime: string,
  endTime: string
): AvailabilityRule {
  return {
    id,
    participantId,
    ruleType: 'available_override',
    dayOfWeek: null,
    specificDate: date,
    startTime,
    endTime,
    originalTimezone: 'UTC',
    originalDayOfWeek: null,
    crossesMidnight: false,
    reason: null,
    source: 'manual',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ============================================================================
// REGRESSION: Pattern Save Should Not Delete Override Rules
// Date: 2026-01-13
// ============================================================================

describe('REGRESSION: Pattern Save Should Not Delete Override Rules', () => {
  /**
   * BUG: When saving recurring patterns, manual calendar entries (override rules
   * from drag-select) would disappear.
   *
   * ROOT CAUSE: savePatterns was reading override rules from effectiveRules,
   * but effectiveRules wasn't updated after grid saves (due to skipRefetch=true).
   *
   * FIX: Added localOverrideSlots state to track grid slots locally.
   * When patterns save, use localOverrideSlots instead of stale effectiveRules.
   *
   * This test verifies the data layer correctly handles both pattern and
   * override rules independently.
   */

  it('patterns and overrides should compute independently', () => {
    // Pattern: Monday 9am-5pm
    const patternRule = createPatternRule('p1', 'user1', 1, '09:00', '17:00');

    // Override: Specific date (Wednesday Jan 8) 2pm-6pm
    const overrideRule = createOverrideRule('o1', 'user1', '2025-01-08', '14:00', '18:00');

    // Compute for Monday (Jan 6) - should only have pattern
    const monday = computeEffectiveForDate([patternRule, overrideRule], '2025-01-06');
    expect(monday.availableRanges.length).toBe(1);
    expect(monday.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 1020 });

    // Compute for Wednesday (Jan 8) - should only have override
    const wednesday = computeEffectiveForDate([patternRule, overrideRule], '2025-01-08');
    expect(wednesday.availableRanges.length).toBe(1);
    expect(wednesday.availableRanges[0]).toEqual({ startMinutes: 840, endMinutes: 1080 });

    // Compute for Tuesday (Jan 7) - should have nothing
    const tuesday = computeEffectiveForDate([patternRule, overrideRule], '2025-01-07');
    expect(tuesday.availableRanges.length).toBe(0);
  });

  it('removing patterns should not affect overrides', () => {
    // Simulate: User has both pattern and override
    const rules: AvailabilityRule[] = [
      createPatternRule('p1', 'user1', 1, '09:00', '17:00'),
      createOverrideRule('o1', 'user1', '2025-01-08', '14:00', '18:00'),
    ];

    // Verify both work
    const mondayBefore = computeEffectiveForDate(rules, '2025-01-06');
    const wedBefore = computeEffectiveForDate(rules, '2025-01-08');
    expect(mondayBefore.availableRanges.length).toBe(1);
    expect(wedBefore.availableRanges.length).toBe(1);

    // Simulate: User removes all patterns (only override remains)
    const afterPatternRemoval: AvailabilityRule[] = [
      createOverrideRule('o1', 'user1', '2025-01-08', '14:00', '18:00'),
    ];

    // Monday should now be empty
    const mondayAfter = computeEffectiveForDate(afterPatternRemoval, '2025-01-06');
    expect(mondayAfter.availableRanges.length).toBe(0);

    // Wednesday override should still exist
    const wedAfter = computeEffectiveForDate(afterPatternRemoval, '2025-01-08');
    expect(wedAfter.availableRanges.length).toBe(1);
    expect(wedAfter.availableRanges[0]).toEqual({ startMinutes: 840, endMinutes: 1080 });
  });

  it('updating patterns should not affect unrelated overrides', () => {
    const override = createOverrideRule('o1', 'user1', '2025-01-08', '14:00', '18:00');

    // Before: Pattern Monday 9-5
    const before = [
      createPatternRule('p1', 'user1', 1, '09:00', '17:00'),
      override,
    ];

    // After: Pattern changed to Monday 10-6
    const after = [
      createPatternRule('p1', 'user1', 1, '10:00', '18:00'),
      override,
    ];

    // Monday should change
    const mondayBefore = computeEffectiveForDate(before, '2025-01-06');
    const mondayAfter = computeEffectiveForDate(after, '2025-01-06');
    expect(mondayBefore.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 1020 });
    expect(mondayAfter.availableRanges[0]).toEqual({ startMinutes: 600, endMinutes: 1080 });

    // Wednesday override should be unchanged
    const wedBefore = computeEffectiveForDate(before, '2025-01-08');
    const wedAfter = computeEffectiveForDate(after, '2025-01-08');
    expect(wedBefore.availableRanges[0]).toEqual({ startMinutes: 840, endMinutes: 1080 });
    expect(wedAfter.availableRanges[0]).toEqual({ startMinutes: 840, endMinutes: 1080 });
  });
});

// ============================================================================
// REGRESSION: Pattern Extraction Should Match Input
// Date: 2026-01-13
// ============================================================================

describe('REGRESSION: Pattern Extraction Should Match Input', () => {
  /**
   * BUG: Patterns would flash and disappear immediately after being added.
   *
   * ROOT CAUSE: Debounced save used stale closure - savePatterns captured old
   * patternEntries state. Also, useEffect was overwriting local state from
   * server response.
   *
   * FIX: Added refs to track latest state, and isUserEditingRef to prevent
   * useEffect from overwriting during edits.
   *
   * This test verifies that pattern round-trip conversion is consistent.
   */

  it('pattern should survive storage round-trip', () => {
    const timezone = 'America/Los_Angeles';
    const originalDay = 1;
    const originalStart = '09:00';
    const originalEnd = '17:00';

    // Convert to UTC for storage
    const prepared = prepareRuleForStorage(
      {
        ruleType: 'available_pattern',
        dayOfWeek: originalDay,
        startTime: originalStart,
        endTime: originalEnd,
      },
      timezone
    );

    // Simulate storing in DB and retrieving
    const storedRule: AvailabilityRule = {
      id: 'test',
      participantId: 'user1',
      ruleType: 'available_pattern',
      dayOfWeek: prepared.dayOfWeek,
      specificDate: null,
      startTime: prepared.startTime,
      endTime: prepared.endTime,
      originalTimezone: timezone,
      originalDayOfWeek: originalDay,
      crossesMidnight: prepared.crossesMidnight,
      reason: null,
      source: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Extract back to local timezone for display
    const extracted = convertPatternFromUTC(
      storedRule.dayOfWeek!,
      storedRule.startTime,
      storedRule.endTime,
      timezone,
      storedRule.crossesMidnight
    );

    // Should match original input
    expect(extracted.dayOfWeek).toBe(originalDay);
    expect(extracted.startTime).toBe(originalStart);
    expect(extracted.endTime).toBe(originalEnd);
  });

  it('multiple patterns should all survive round-trip', () => {
    const timezone = 'Asia/Manila';
    const patterns = [
      { day: 1, start: '09:00', end: '17:00' },
      { day: 2, start: '10:00', end: '18:00' },
      { day: 3, start: '14:00', end: '22:00' },
      { day: 4, start: '08:00', end: '12:00' },
      { day: 5, start: '18:00', end: '23:00' },
    ];

    for (const pattern of patterns) {
      const prepared = prepareRuleForStorage(
        {
          ruleType: 'available_pattern',
          dayOfWeek: pattern.day,
          startTime: pattern.start,
          endTime: pattern.end,
        },
        timezone
      );

      const extracted = convertPatternFromUTC(
        prepared.dayOfWeek!,
        prepared.startTime,
        prepared.endTime,
        timezone,
        prepared.crossesMidnight
      );

      expect(extracted.dayOfWeek).toBe(pattern.day);
      expect(extracted.startTime).toBe(pattern.start);
      expect(extracted.endTime).toBe(pattern.end);
    }
  });
});

// ============================================================================
// REGRESSION: Effective Rules After Multiple Operations
// Date: 2026-01-13
// ============================================================================

describe('REGRESSION: Effective Rules After Multiple Operations', () => {
  /**
   * This tests the data consistency after multiple add/remove operations,
   * simulating what happens in the UI when users make multiple changes.
   */

  it('adding then removing pattern should return to original state', () => {
    const original: AvailabilityRule[] = [
      createPatternRule('p1', 'user1', 1, '09:00', '17:00'),
    ];

    const mondayOriginal = computeEffectiveForDate(original, '2025-01-06');
    expect(mondayOriginal.availableRanges.length).toBe(1);

    // Add Tuesday pattern
    const afterAdd: AvailabilityRule[] = [
      ...original,
      createPatternRule('p2', 'user1', 2, '10:00', '18:00'),
    ];

    const mondayAfterAdd = computeEffectiveForDate(afterAdd, '2025-01-06');
    const tuesdayAfterAdd = computeEffectiveForDate(afterAdd, '2025-01-07');
    expect(mondayAfterAdd.availableRanges.length).toBe(1);
    expect(tuesdayAfterAdd.availableRanges.length).toBe(1);

    // Remove Tuesday pattern
    const afterRemove = original;
    const mondayAfterRemove = computeEffectiveForDate(afterRemove, '2025-01-06');
    const tuesdayAfterRemove = computeEffectiveForDate(afterRemove, '2025-01-07');
    expect(mondayAfterRemove.availableRanges.length).toBe(1);
    expect(tuesdayAfterRemove.availableRanges.length).toBe(0);

    // Monday should be exactly the same as original
    expect(mondayAfterRemove.availableRanges[0]).toEqual(mondayOriginal.availableRanges[0]);
  });

  it('modifying pattern times should update correctly', () => {
    // Original: Monday 9am-5pm
    const original: AvailabilityRule[] = [
      createPatternRule('p1', 'user1', 1, '09:00', '17:00'),
    ];

    // Modified: Monday 10am-6pm
    const modified: AvailabilityRule[] = [
      createPatternRule('p1', 'user1', 1, '10:00', '18:00'),
    ];

    const beforeMod = computeEffectiveForDate(original, '2025-01-06');
    const afterMod = computeEffectiveForDate(modified, '2025-01-06');

    expect(beforeMod.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 1020 });
    expect(afterMod.availableRanges[0]).toEqual({ startMinutes: 600, endMinutes: 1080 });
  });
});

// ============================================================================
// REGRESSION: Override Should Take Priority Over Pattern
// Date: 2026-01-13
// ============================================================================

describe('REGRESSION: Override Should Take Priority Over Pattern', () => {
  /**
   * Verifies that the priority system works correctly:
   * 1. blocked_override (highest)
   * 2. blocked_pattern
   * 3. available_override
   * 4. available_pattern (lowest)
   */

  it('blocked_override removes availability from available_pattern', () => {
    const monday = '2025-01-06';
    const rules: AvailabilityRule[] = [
      createPatternRule('p1', 'user1', 1, '09:00', '17:00'),
      {
        ...createOverrideRule('o1', 'user1', monday, '09:00', '17:00'),
        ruleType: 'blocked_override',
      },
    ];

    const result = computeEffectiveForDate(rules, monday);
    expect(result.availableRanges.length).toBe(0);
  });

  it('available_override adds to days without patterns', () => {
    const wednesday = '2025-01-08'; // No pattern for Wednesday
    const rules: AvailabilityRule[] = [
      createPatternRule('p1', 'user1', 1, '09:00', '17:00'), // Monday only
      createOverrideRule('o1', 'user1', wednesday, '14:00', '18:00'),
    ];

    // Monday has pattern
    const mondayResult = computeEffectiveForDate(rules, '2025-01-06');
    expect(mondayResult.availableRanges.length).toBe(1);
    expect(mondayResult.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 1020 });

    // Wednesday has override only
    const wedResult = computeEffectiveForDate(rules, wednesday);
    expect(wedResult.availableRanges.length).toBe(1);
    expect(wedResult.availableRanges[0]).toEqual({ startMinutes: 840, endMinutes: 1080 });
  });

  it('available_override extends pattern availability', () => {
    const monday = '2025-01-06';
    const rules: AvailabilityRule[] = [
      createPatternRule('p1', 'user1', 1, '09:00', '17:00'), // Pattern 9-5
      createOverrideRule('o1', 'user1', monday, '18:00', '21:00'), // Override 6-9pm
    ];

    const result = computeEffectiveForDate(rules, monday);

    // Should have both ranges (9-5 and 6-9pm)
    expect(result.availableRanges.length).toBe(2);
    expect(result.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 1020 }); // 9-5
    expect(result.availableRanges[1]).toEqual({ startMinutes: 1080, endMinutes: 1260 }); // 6-9pm
  });
});

// ============================================================================
// REGRESSION: Week Boundary Handling
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Week Boundary Handling', () => {
  /**
   * Tests that patterns correctly wrap around week boundaries
   * (Sunday → Monday, Saturday → Sunday).
   */

  it('Sunday pattern should apply to all Sundays', () => {
    const rule = createPatternRule('p1', 'user1', 0, '10:00', '14:00'); // Sunday

    // Jan 5, 2025 is a Sunday
    const jan5 = computeEffectiveForDate([rule], '2025-01-05');
    expect(jan5.availableRanges.length).toBe(1);

    // Jan 12, 2025 is also a Sunday
    const jan12 = computeEffectiveForDate([rule], '2025-01-12');
    expect(jan12.availableRanges.length).toBe(1);

    // Jan 6, 2025 is Monday - should not match
    const jan6 = computeEffectiveForDate([rule], '2025-01-06');
    expect(jan6.availableRanges.length).toBe(0);
  });

  it('Saturday pattern should apply to all Saturdays', () => {
    const rule = createPatternRule('p1', 'user1', 6, '10:00', '14:00'); // Saturday

    // Jan 4, 2025 is a Saturday
    const jan4 = computeEffectiveForDate([rule], '2025-01-04');
    expect(jan4.availableRanges.length).toBe(1);

    // Jan 11, 2025 is also a Saturday
    const jan11 = computeEffectiveForDate([rule], '2025-01-11');
    expect(jan11.availableRanges.length).toBe(1);

    // Jan 5, 2025 is Sunday - should not match
    const jan5 = computeEffectiveForDate([rule], '2025-01-05');
    expect(jan5.availableRanges.length).toBe(0);
  });

  it('patterns for all 7 days should cover entire week', () => {
    const rules = [0, 1, 2, 3, 4, 5, 6].map((day) =>
      createPatternRule(`p${day}`, 'user1', day, '09:00', '17:00')
    );

    const dateRange: DateRange = {
      startDate: '2025-01-05', // Sunday
      endDate: '2025-01-11',   // Saturday
    };

    const results = computeEffectiveRanges(rules, dateRange);

    // Every day should have availability
    for (let i = 5; i <= 11; i++) {
      const date = `2025-01-${i.toString().padStart(2, '0')}`;
      const dayResult = results.get(date);
      expect(dayResult?.availableRanges.length).toBe(1);
      expect(dayResult?.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 1020 });
    }
  });
});
