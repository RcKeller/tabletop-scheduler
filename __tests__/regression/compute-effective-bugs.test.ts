/**
 * REGRESSION TESTS: Compute Effective Availability Bugs
 *
 * These tests cover edge cases in computing effective availability from
 * patterns and overrides that have caused issues in production.
 */

import {
  computeEffectiveForDate,
  computeEffectiveRanges,
} from '../../lib/availability/compute-effective';
import type { AvailabilityRule } from '../../lib/types/availability';

// ============================================================================
// REGRESSION: Override Priority Over Pattern
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Override Priority Over Pattern', () => {
  /**
   * BUG: Overrides were sometimes not taking priority over patterns,
   * causing incorrect availability display.
   *
   * Priority order (highest first):
   * 1. blocked_override
   * 2. blocked_pattern
   * 3. available_override
   * 4. available_pattern
   */

  const baseRule = {
    id: '',
    participantId: 'test-1',
    createdAt: new Date(),
    crossesMidnight: false,
    originalDayOfWeek: null,
    originalTimezone: 'UTC',
    specificDate: null,
  };

  it('blocked_override removes availability from pattern', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        ...baseRule,
        id: '2',
        ruleType: 'blocked_override',
        dayOfWeek: null,
        specificDate: '2025-01-06',
        startTime: '12:00',
        endTime: '13:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should have 2 available ranges (9-12, 13-17)
    expect(result.availableRanges.length).toBe(2);
    expect(result.availableRanges[0]).toEqual({
      startMinutes: 540,
      endMinutes: 720,
    }); // 9am-12pm
    expect(result.availableRanges[1]).toEqual({
      startMinutes: 780,
      endMinutes: 1020,
    }); // 1pm-5pm
  });

  it('available_override adds to pattern', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
      },
      {
        ...baseRule,
        id: '2',
        ruleType: 'available_override',
        dayOfWeek: null,
        specificDate: '2025-01-06',
        startTime: '14:00',
        endTime: '17:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should have 2 available ranges (9-12 from pattern, 14-17 from override)
    expect(result.availableRanges.length).toBe(2);
  });

  it('blocked_pattern takes priority over available_pattern', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        ...baseRule,
        id: '2',
        ruleType: 'blocked_pattern',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '13:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should have 2 available ranges (9-12, 13-17)
    expect(result.availableRanges.length).toBe(2);
  });
});

// ============================================================================
// REGRESSION: Overnight Pattern Spanning Days
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Overnight Pattern Spanning Days', () => {
  /**
   * BUG: Overnight patterns (crossing midnight) were not correctly
   * applying to both affected days.
   *
   * Note: computeEffectiveForDate only looks at a single day, so overnight
   * patterns that start on day N will only show up on day N. The caller
   * must handle the next-day portion separately.
   */

  const baseRule = {
    id: '',
    participantId: 'test-1',
    createdAt: new Date(),
    originalDayOfWeek: null,
    originalTimezone: 'UTC',
    specificDate: null,
  };

  it('overnight pattern shows slots starting on same day', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 0, // Sunday UTC (starts 23:00)
        startTime: '23:00',
        endTime: '01:00',
        crossesMidnight: true,
      },
    ];

    const sunday = computeEffectiveForDate(rules, '2025-01-05');

    // Sunday should have 23:00-24:00 (1380-1440) or the full overnight range
    expect(sunday.availableRanges.length).toBeGreaterThan(0);
    const range = sunday.availableRanges[0];
    expect(range.startMinutes).toBe(1380); // 23:00
  });
});

// ============================================================================
// REGRESSION: Empty Result Handling
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Empty Result Handling', () => {
  /**
   * BUG: No rules for a date could cause errors.
   */

  it('no rules returns empty availability', () => {
    const result = computeEffectiveForDate([], '2025-01-06');

    expect(result.availableRanges).toEqual([]);
    expect(result.blockedRanges).toEqual([]);
  });

  it('computeEffectiveRanges returns map for each day', () => {
    const result = computeEffectiveRanges([], {
      startDate: '2025-01-06',
      endDate: '2025-01-12',
    });

    // Should have entries for each day
    expect(result.size).toBe(7);

    // Each day should have empty ranges
    for (const [, dayEffective] of result) {
      expect(dayEffective.availableRanges).toEqual([]);
      expect(dayEffective.blockedRanges).toEqual([]);
    }
  });

  it('pattern for different day returns empty for queried day', () => {
    const rules: AvailabilityRule[] = [
      {
        id: '1',
        participantId: 'test-1',
        ruleType: 'available_pattern',
        dayOfWeek: 5, // Friday
        startTime: '09:00',
        endTime: '17:00',
        createdAt: new Date(),
        crossesMidnight: false,
        originalDayOfWeek: null,
        originalTimezone: 'UTC',
        specificDate: null,
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06'); // Monday

    expect(result.availableRanges).toEqual([]);
  });
});

// ============================================================================
// REGRESSION: Full Day Patterns
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Full Day Patterns', () => {
  /**
   * BUG: Full day patterns (00:00-24:00) were sometimes generating
   * incorrect minute ranges.
   */

  const baseRule = {
    id: '',
    participantId: 'test-1',
    createdAt: new Date(),
    crossesMidnight: false,
    originalDayOfWeek: null,
    originalTimezone: 'UTC',
    specificDate: null,
  };

  it('00:00-24:00 pattern creates full day range', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '00:00',
        endTime: '24:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    expect(result.availableRanges.length).toBe(1);
    expect(result.availableRanges[0]).toEqual({
      startMinutes: 0,
      endMinutes: 1440,
    });
  });

  it('full day with lunch block creates two ranges', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '00:00',
        endTime: '24:00',
      },
      {
        ...baseRule,
        id: '2',
        ruleType: 'blocked_pattern',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '13:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should have 2 available ranges (0-720, 780-1440)
    expect(result.availableRanges.length).toBe(2);
    expect(result.availableRanges[0]).toEqual({
      startMinutes: 0,
      endMinutes: 720,
    }); // Midnight to noon
    expect(result.availableRanges[1]).toEqual({
      startMinutes: 780,
      endMinutes: 1440,
    }); // 1pm to midnight
  });
});

// ============================================================================
// REGRESSION: Adjacent Ranges Not Merging
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Adjacent Ranges Not Merging', () => {
  /**
   * BUG: Multiple adjacent patterns were sometimes not being merged
   * into a single continuous range.
   */

  const baseRule = {
    id: '',
    participantId: 'test-1',
    createdAt: new Date(),
    crossesMidnight: false,
    originalDayOfWeek: null,
    originalTimezone: 'UTC',
    specificDate: null,
  };

  it('adjacent patterns merge into single range', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
      },
      {
        ...baseRule,
        id: '2',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '17:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should merge into single range 9am-5pm
    expect(result.availableRanges.length).toBe(1);
    expect(result.availableRanges[0]).toEqual({
      startMinutes: 540,
      endMinutes: 1020,
    });
  });

  it('overlapping patterns merge correctly', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '14:00',
      },
      {
        ...baseRule,
        id: '2',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '17:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should merge into single range 9am-5pm
    expect(result.availableRanges.length).toBe(1);
    expect(result.availableRanges[0]).toEqual({
      startMinutes: 540,
      endMinutes: 1020,
    });
  });
});

// ============================================================================
// REGRESSION: Multi-Week Pattern Application
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Multi-Week Pattern Application', () => {
  /**
   * BUG: Patterns weren't applying correctly across multiple weeks.
   */

  const baseRule = {
    id: '',
    participantId: 'test-1',
    createdAt: new Date(),
    crossesMidnight: false,
    originalDayOfWeek: null,
    originalTimezone: 'UTC',
    specificDate: null,
  };

  it('pattern applies to same day across weeks', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '17:00',
      },
    ];

    const result = computeEffectiveRanges(rules, {
      startDate: '2025-01-06', // Monday week 1
      endDate: '2025-01-13', // Monday week 2
    });

    // Both Mondays should have the pattern
    const monday1 = result.get('2025-01-06');
    const monday2 = result.get('2025-01-13');

    expect(monday1).toBeDefined();
    expect(monday2).toBeDefined();

    expect(monday1!.availableRanges).toEqual([
      { startMinutes: 540, endMinutes: 1020 },
    ]);
    expect(monday2!.availableRanges).toEqual([
      { startMinutes: 540, endMinutes: 1020 },
    ]);
  });

  it('override only affects specific date not pattern', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '17:00',
      },
      {
        ...baseRule,
        id: '2',
        ruleType: 'blocked_override',
        dayOfWeek: null,
        specificDate: '2025-01-06', // Only this Monday
        startTime: '09:00',
        endTime: '17:00',
      },
    ];

    const result = computeEffectiveRanges(rules, {
      startDate: '2025-01-06', // Monday week 1 (blocked)
      endDate: '2025-01-13', // Monday week 2 (should be available)
    });

    const monday1 = result.get('2025-01-06');
    const monday2 = result.get('2025-01-13');

    // First Monday should be fully blocked
    expect(monday1!.availableRanges).toEqual([]);

    // Second Monday should have normal pattern
    expect(monday2!.availableRanges).toEqual([
      { startMinutes: 540, endMinutes: 1020 },
    ]);
  });
});

// ============================================================================
// REGRESSION: Edge Case Time Boundaries
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Edge Case Time Boundaries', () => {
  /**
   * BUG: Patterns at day boundaries (midnight, end of day) had issues.
   */

  const baseRule = {
    id: '',
    participantId: 'test-1',
    createdAt: new Date(),
    crossesMidnight: false,
    originalDayOfWeek: null,
    originalTimezone: 'UTC',
    specificDate: null,
  };

  it('pattern starting at midnight', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '00:00',
        endTime: '06:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    expect(result.availableRanges).toEqual([
      { startMinutes: 0, endMinutes: 360 },
    ]);
  });

  it('pattern ending at midnight (24:00)', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '18:00',
        endTime: '24:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    expect(result.availableRanges).toEqual([
      { startMinutes: 1080, endMinutes: 1440 },
    ]);
  });

  it('30-minute slot at end of day', () => {
    const rules: AvailabilityRule[] = [
      {
        ...baseRule,
        id: '1',
        ruleType: 'available_pattern',
        dayOfWeek: 1,
        startTime: '23:30',
        endTime: '24:00',
      },
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    expect(result.availableRanges).toEqual([
      { startMinutes: 1410, endMinutes: 1440 },
    ]);
  });
});
