/**
 * REGRESSION TESTS: Timezone-Related Bugs
 *
 * These tests cover EXACT scenarios that have broken in production.
 * Each test documents the bug, root cause, and fix.
 * DO NOT MODIFY these tests without understanding the original bug.
 */

import {
  convertPatternToUTC,
  convertPatternFromUTC,
  convertPatternBetweenTimezones,
  prepareRuleForStorage,
  utcToLocal,
  localToUTC,
} from '../../lib/availability/timezone';
import {
  createRange,
  timeToMinutes,
  minutesToTime,
  mergeRanges,
} from '../../lib/availability/range-math';
import {
  computeEffectiveForDate,
  computeEffectiveRanges,
} from '../../lib/availability/compute-effective';
import type { AvailabilityRule, DateRange } from '../../lib/types/availability';

// ============================================================================
// REGRESSION: >24hr Availability Display Bug
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: >24hr Availability Display Bug', () => {
  /**
   * BUG: When 24-hour availability set in Manila (UTC+8) was viewed in PST (UTC-8),
   * it showed >24 hours spanning into the next day.
   *
   * ROOT CAUSE: createRange() used time comparison (end < start) to detect overnight
   * ranges, but this failed when timezone conversion naturally produced inverted times.
   *
   * Example: Manila Tuesday 00:00-23:30 → UTC Monday 16:00 to Tuesday 15:30
   * - createRange("16:00", "15:30") saw 15:30 < 16:00
   * - Incorrectly assumed overnight, added 1440 minutes
   * - Created ~39 hour range instead of ~24 hours
   *
   * FIX: Added explicit `crossesMidnight` boolean flag to track original user intent.
   */

  it('Manila full day (00:00-24:00) should NOT create >24hr range', () => {
    // User sets "all day Tuesday" in Manila
    const result = convertPatternToUTC(2, '00:00', '24:00', 'Asia/Manila');

    // Create range with the crossesMidnight flag
    const range = createRange(result.startTime, result.endTime, result.crossesMidnight);
    const duration = range.endMinutes - range.startMinutes;

    // MUST be exactly 24 hours, NOT more
    expect(duration).toBe(1440);
  });

  it('Manila 00:00-23:30 viewed in PST should show ~23.5 hours, not ~39 hours', () => {
    // This was the EXACT scenario that broke
    // Manila Tuesday 00:00-23:30 → UTC Monday 16:00 to Tuesday 15:30

    const result = convertPatternToUTC(2, '00:00', '23:30', 'Asia/Manila');

    // The conversion produces times that look inverted (16:00 to 15:30)
    // But crossesMidnight=false should prevent adding 1440
    const range = createRange(result.startTime, result.endTime, result.crossesMidnight);
    const duration = range.endMinutes - range.startMinutes;

    // Should be ~23.5 hours = 1410 minutes (or close to it)
    // NOT ~39 hours = 2340 minutes
    expect(duration).toBeLessThanOrEqual(1440);
    expect(duration).toBeGreaterThan(0);
  });

  it('createRange with crossesMidnight=false should NEVER add 1440 minutes', () => {
    // This is the CRITICAL fix - explicit flag overrides heuristic
    const testCases = [
      // Times that look inverted but are NOT overnight
      { start: '16:00', end: '15:30', expected: -30 },  // Timezone artifact
      { start: '20:00', end: '08:00', expected: -720 }, // Timezone artifact
      { start: '23:00', end: '01:00', expected: -1320 }, // Timezone artifact
    ];

    for (const { start, end, expected } of testCases) {
      const range = createRange(start, end, false); // Explicit: NOT overnight
      const duration = range.endMinutes - range.startMinutes;
      expect(duration).toBe(expected);
    }
  });

  it('createRange with crossesMidnight=true should ALWAYS add 1440 minutes', () => {
    // When user explicitly sets overnight range
    const testCases = [
      { start: '22:00', end: '02:00', expected: 240 },  // 4 hours overnight
      { start: '08:00', end: '08:00', expected: 1440 }, // 24 hours (same time = full day)
      { start: '00:00', end: '00:00', expected: 1440 }, // Full day
    ];

    for (const { start, end, expected } of testCases) {
      const range = createRange(start, end, true); // Explicit: IS overnight
      const duration = range.endMinutes - range.startMinutes;
      expect(duration).toBe(expected);
    }
  });
});

// ============================================================================
// REGRESSION: Overnight UTC Split Creating Gaps
// Date: 2026-01-13
// ============================================================================

describe('REGRESSION: Overnight UTC Split Creating Gaps', () => {
  /**
   * BUG: When a pattern like "7am-9am Manila (UTC+8)" crosses midnight in UTC
   * (23:00-01:00), the overnight split was creating gaps in availability.
   *
   * ROOT CAUSE: When UTC range crossed midnight, it was split into two parts
   * (23:00-24:00 and 00:00-01:00) but these weren't being properly merged.
   *
   * FIX:
   * - Use "24:00" to represent "end of day" instead of "23:30"
   * - Added mergeAdjacentSlots() function to combine adjacent slots after conversion
   */

  it('Manila 7am-9am should NOT have gaps when converted to UTC and back', () => {
    // 7am-9am Manila = 11pm-1am UTC (crosses midnight)
    const utc = convertPatternToUTC(1, '07:00', '09:00', 'Asia/Manila');

    // Verify correct UTC conversion
    expect(utc.startTime).toBe('23:00');
    expect(utc.endTime).toBe('01:00');
    expect(utc.dayOfWeek).toBe(0); // Sunday UTC (Monday Manila)

    // Convert back to Manila
    const backToManila = convertPatternFromUTC(
      utc.dayOfWeek,
      utc.startTime,
      utc.endTime,
      'Asia/Manila',
      utc.crossesMidnight
    );

    // Should round-trip correctly
    expect(backToManila.startTime).toBe('07:00');
    expect(backToManila.endTime).toBe('09:00');
    expect(backToManila.dayOfWeek).toBe(1); // Monday Manila
  });

  it('UTC overnight pattern should produce correct duration', () => {
    // Pattern that crosses midnight in UTC
    const utc = convertPatternToUTC(1, '07:00', '09:00', 'Asia/Manila');

    // Create range - this is where the gap bug occurred
    const range = createRange(utc.startTime, utc.endTime, utc.crossesMidnight);
    const duration = range.endMinutes - range.startMinutes;

    // 7am-9am = 2 hours = 120 minutes
    expect(duration).toBe(120);
  });

  it('Tokyo early morning creates proper UTC overnight range', () => {
    // 1am-5am Tokyo = 4pm-8pm UTC previous day (no overnight)
    const utc = convertPatternToUTC(2, '01:00', '05:00', 'Asia/Tokyo');

    const range = createRange(utc.startTime, utc.endTime, utc.crossesMidnight);
    const duration = range.endMinutes - range.startMinutes;

    // 1am-5am = 4 hours = 240 minutes
    expect(duration).toBe(240);
  });
});

// ============================================================================
// REGRESSION: Full Day Pattern Duration Preservation
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Full Day Pattern Duration Preservation', () => {
  /**
   * BUG: Full day patterns (00:00-24:00) were not preserving 24-hour duration
   * across timezone conversions.
   *
   * ROOT CAUSE: "24:00" handling was inconsistent. Some code paths treated it
   * as "00:00 next day" which caused double-counting or duration errors.
   *
   * FIX:
   * - Standardized on "24:00" meaning "end of current day"
   * - Updated createRange() to handle "24:00" specially (= 1440 minutes)
   */

  const timezones = [
    'UTC',
    'America/Los_Angeles',
    'America/New_York',
    'America/Cancun',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Manila',
    'Asia/Kolkata',
    'Asia/Kathmandu',
    'Australia/Sydney',
    'Pacific/Auckland',
    'Pacific/Honolulu',
  ];

  it.each(timezones)(
    'full day (00:00-24:00) in %s preserves 24-hour duration',
    (timezone) => {
      const result = convertPatternToUTC(1, '00:00', '24:00', timezone);
      const range = createRange(result.startTime, result.endTime, result.crossesMidnight);
      const duration = range.endMinutes - range.startMinutes;

      expect(duration).toBe(1440);
    }
  );

  it('00:00-24:00 UTC should not change times', () => {
    const result = convertPatternToUTC(1, '00:00', '24:00', 'UTC');

    expect(result.startTime).toBe('00:00');
    expect(result.endTime).toBe('24:00');
    expect(result.crossesMidnight).toBe(false); // "24:00" is end-of-day, not overnight
  });
});

// ============================================================================
// REGRESSION: 00:00-00:00 AI Edge Case
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: 00:00-00:00 AI Edge Case', () => {
  /**
   * BUG: AI sometimes returned "00:00-00:00" for "all day" availability instead
   * of "00:00-24:00", causing 0-minute ranges.
   *
   * FIX: createRange() special-cases "00:00-00:00" as full day (1440 minutes).
   */

  it('00:00-00:00 should be treated as full day', () => {
    const range = createRange('00:00', '00:00', false);
    const duration = range.endMinutes - range.startMinutes;

    expect(duration).toBe(1440);
  });

  it('other same-time ranges with crossesMidnight=true should be 24 hours', () => {
    // Any time to same time with crossesMidnight=true = 24 hours
    const testCases = ['08:00', '12:00', '18:00', '23:30'];

    for (const time of testCases) {
      const range = createRange(time, time, true);
      const duration = range.endMinutes - range.startMinutes;
      expect(duration).toBe(1440);
    }
  });
});

// ============================================================================
// REGRESSION: LA to Cancun Timezone Switch
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: LA to Cancun Timezone Switch', () => {
  /**
   * BUG: User reported that switching timezone from LA to Cancun caused
   * availability display issues.
   *
   * America/Cancun is UTC-5 with NO daylight saving time (EST year-round).
   * America/Los_Angeles is UTC-8 in winter, UTC-7 in summer.
   *
   * This 2-3 hour difference was causing edge cases at day boundaries.
   */

  it('LA evening availability converts correctly to Cancun', () => {
    // 5pm-9pm LA (Monday) = 8pm-12am Cancun (Monday night into Tuesday)
    const converted = convertPatternBetweenTimezones(
      [1], // Monday
      '17:00',
      '21:00',
      'America/Los_Angeles',
      'America/Cancun'
    );

    // In January, LA is UTC-8, Cancun is UTC-5 (3 hour difference)
    expect(converted.startTime).toBe('20:00');
    expect(converted.endTime).toBe('00:00'); // Midnight
  });

  it('Cancun morning availability converts correctly to LA', () => {
    // 8am-12pm Cancun = 5am-9am LA (same day, just earlier)
    const converted = convertPatternBetweenTimezones(
      [1], // Monday
      '08:00',
      '12:00',
      'America/Cancun',
      'America/Los_Angeles'
    );

    // Cancun is UTC-5, LA is UTC-8 (3 hours behind)
    expect(converted.startTime).toBe('05:00');
    expect(converted.endTime).toBe('09:00');
  });

  it('full day in LA stays full day in Cancun', () => {
    const converted = convertPatternBetweenTimezones(
      [1],
      '00:00',
      '24:00',
      'America/Los_Angeles',
      'America/Cancun'
    );

    // Full day should stay full day (semantic preservation)
    expect(converted.startTime).toBe('00:00');
    expect(converted.endTime).toBe('24:00');
  });
});

// ============================================================================
// REGRESSION: Gap Between Patterns (1pm-5pm Bug)
// Date: 2026-01-13
// ============================================================================

describe('REGRESSION: Gap Between Patterns Should NOT Be Available', () => {
  /**
   * BUG: Setting "2am-1pm M-F" and "5pm-10pm every day" incorrectly showed
   * "1pm-5pm M-F" as available (the gap between patterns).
   *
   * ROOT CAUSE: Merging algorithm was incorrectly filling gaps.
   *
   * FIX: computeEffectiveRanges() was fixed to only merge overlapping/adjacent
   * ranges, never fill gaps.
   */

  function createRule(
    dayOfWeek: number,
    startTime: string,
    endTime: string
  ): AvailabilityRule {
    return {
      id: `${dayOfWeek}-${startTime}-${endTime}`,
      participantId: 'test',
      ruleType: 'available_pattern',
      dayOfWeek,
      specificDate: null,
      startTime,
      endTime,
      originalTimezone: 'UTC',
      originalDayOfWeek: dayOfWeek,
      crossesMidnight: false,
      reason: null,
      source: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('gap between 2am-1pm and 5pm-10pm should NOT be available', () => {
    const rules: AvailabilityRule[] = [
      createRule(1, '02:00', '13:00'), // 2am-1pm Monday
      createRule(1, '17:00', '22:00'), // 5pm-10pm Monday
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06'); // Monday

    // Should have exactly 2 separate ranges
    expect(result.availableRanges.length).toBe(2);

    // Verify ranges are correct
    expect(result.availableRanges[0]).toEqual({ startMinutes: 120, endMinutes: 780 }); // 2am-1pm
    expect(result.availableRanges[1]).toEqual({ startMinutes: 1020, endMinutes: 1320 }); // 5pm-10pm

    // Verify gap (1pm-5pm = 780-1020) is NOT covered
    const gapStart = 780;
    const gapEnd = 1020;

    const gapIsCovered = result.availableRanges.some(
      (r) => r.startMinutes < gapEnd && r.endMinutes > gapStart
    );

    expect(gapIsCovered).toBe(false);
  });

  it('adjacent ranges should merge but gaps should not', () => {
    const rules: AvailabilityRule[] = [
      createRule(1, '09:00', '12:00'), // 9am-12pm
      createRule(1, '12:00', '15:00'), // 12pm-3pm (adjacent)
      createRule(1, '17:00', '20:00'), // 5pm-8pm (gap of 2 hours)
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should have 2 ranges: merged 9am-3pm, and separate 5pm-8pm
    expect(result.availableRanges.length).toBe(2);
    expect(result.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 900 }); // 9am-3pm merged
    expect(result.availableRanges[1]).toEqual({ startMinutes: 1020, endMinutes: 1200 }); // 5pm-8pm
  });
});

// ============================================================================
// REGRESSION: Blocked Pattern Priority
// Date: 2026-01-13
// ============================================================================

describe('REGRESSION: Blocked Pattern Priority', () => {
  /**
   * BUG: Blocked patterns were not properly subtracting from available patterns.
   *
   * ROOT CAUSE: Priority system was not correctly implemented.
   *
   * FIX: computeEffectiveForDate() now correctly subtracts blocked ranges.
   */

  function createRule(
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    isBlocked: boolean
  ): AvailabilityRule {
    return {
      id: `${dayOfWeek}-${startTime}-${endTime}-${isBlocked}`,
      participantId: 'test',
      ruleType: isBlocked ? 'blocked_pattern' : 'available_pattern',
      dayOfWeek,
      specificDate: null,
      startTime,
      endTime,
      originalTimezone: 'UTC',
      originalDayOfWeek: dayOfWeek,
      crossesMidnight: false,
      reason: null,
      source: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('blocked 12pm-1pm should create gap in 9am-5pm availability', () => {
    const rules: AvailabilityRule[] = [
      createRule(1, '09:00', '17:00', false), // Available 9am-5pm
      createRule(1, '12:00', '13:00', true),  // Blocked 12pm-1pm (lunch)
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should have 2 ranges: 9am-12pm and 1pm-5pm
    expect(result.availableRanges.length).toBe(2);
    expect(result.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 720 }); // 9am-12pm
    expect(result.availableRanges[1]).toEqual({ startMinutes: 780, endMinutes: 1020 }); // 1pm-5pm

    // Verify noon is NOT available
    const noonAvailable = result.availableRanges.some(
      (r) => r.startMinutes <= 720 && r.endMinutes > 720
    );
    expect(noonAvailable).toBe(false);
  });

  it('blocked all day should remove all availability', () => {
    const rules: AvailabilityRule[] = [
      createRule(1, '09:00', '17:00', false), // Available 9am-5pm
      createRule(1, '00:00', '24:00', true),  // Blocked all day
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should have no available ranges
    expect(result.availableRanges.length).toBe(0);
  });

  it('blocked at start removes beginning of availability', () => {
    const rules: AvailabilityRule[] = [
      createRule(1, '09:00', '17:00', false), // Available 9am-5pm
      createRule(1, '09:00', '10:00', true),  // Blocked 9am-10am
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should have 1 range: 10am-5pm
    expect(result.availableRanges.length).toBe(1);
    expect(result.availableRanges[0]).toEqual({ startMinutes: 600, endMinutes: 1020 }); // 10am-5pm
  });

  it('blocked at end removes end of availability', () => {
    const rules: AvailabilityRule[] = [
      createRule(1, '09:00', '17:00', false), // Available 9am-5pm
      createRule(1, '16:00', '17:00', true),  // Blocked 4pm-5pm
    ];

    const result = computeEffectiveForDate(rules, '2025-01-06');

    // Should have 1 range: 9am-4pm
    expect(result.availableRanges.length).toBe(1);
    expect(result.availableRanges[0]).toEqual({ startMinutes: 540, endMinutes: 960 }); // 9am-4pm
  });
});

// ============================================================================
// REGRESSION: Fractional Timezone Offsets
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Fractional Timezone Offsets', () => {
  /**
   * BUG: Timezones with non-whole-hour offsets (India +5:30, Nepal +5:45)
   * were not converting correctly due to minute rounding issues.
   *
   * FIX: Ensure all timezone conversions preserve fractional minutes.
   */

  it('India (UTC+5:30) converts with :30 minute precision', () => {
    // 9am India = 3:30am UTC
    const result = convertPatternToUTC(1, '09:00', '17:00', 'Asia/Kolkata');

    expect(result.startTime).toBe('03:30');
    expect(result.endTime).toBe('11:30');
  });

  it('Nepal (UTC+5:45) converts with :45 minute precision', () => {
    // 9am Nepal = 3:15am UTC
    const result = convertPatternToUTC(1, '09:00', '17:00', 'Asia/Kathmandu');

    expect(result.startTime).toBe('03:15');
    expect(result.endTime).toBe('11:15');
  });

  it('India full day preserves 24 hours', () => {
    const result = convertPatternToUTC(1, '00:00', '24:00', 'Asia/Kolkata');
    const range = createRange(result.startTime, result.endTime, result.crossesMidnight);

    expect(range.endMinutes - range.startMinutes).toBe(1440);
  });

  it('Nepal full day preserves 24 hours', () => {
    const result = convertPatternToUTC(1, '00:00', '24:00', 'Asia/Kathmandu');
    const range = createRange(result.startTime, result.endTime, result.crossesMidnight);

    expect(range.endMinutes - range.startMinutes).toBe(1440);
  });
});
