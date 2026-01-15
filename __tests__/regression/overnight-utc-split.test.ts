/**
 * REGRESSION TESTS: Overnight UTC Split Bugs
 *
 * These tests cover the specific bug where local patterns that cross midnight
 * in UTC would create gaps or incorrect slots.
 */

import {
  convertPatternToUTC,
  convertPatternFromUTC,
} from '../../lib/availability/timezone';
import {
  createRange,
  rangesToSlots,
} from '../../lib/availability/range-math';

// ============================================================================
// REGRESSION: Manila 7am-9am Crossing Midnight in UTC
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Manila 7am-9am Crossing Midnight in UTC', () => {
  /**
   * BUG: When a Manila pattern (UTC+8) like "7am-9am" was converted to UTC,
   * it became "23:00-01:00" which crosses midnight. The overnight split
   * created gaps when displayed back in Manila time.
   *
   * FIX:
   * 1. Use "24:00" to represent "end of day" instead of "23:30"
   * 2. mergeAdjacentSlots() combines adjacent slots after conversion
   * 3. crossesMidnight flag tracks original user intent
   */

  it('Manila 7am-9am converts to UTC 23:00-01:00 overnight', () => {
    const utcPattern = convertPatternToUTC(
      1, // Monday
      '07:00',
      '09:00',
      'Asia/Manila'
    );

    // Manila is UTC+8, so 7am Manila = 23:00 previous day UTC
    // 9am Manila = 01:00 same day UTC
    expect(utcPattern.startTime).toBe('23:00');
    expect(utcPattern.endTime).toBe('01:00');

    // Should be marked as overnight since it crosses midnight in UTC
    expect(utcPattern.crossesMidnight).toBe(true);

    // Day shifts back one day (Monday Manila -> Sunday UTC)
    expect(utcPattern.dayOfWeek).toBe(0);
  });

  it('overnight UTC pattern round-trips back to original Manila time', () => {
    const utc = convertPatternToUTC(1, '07:00', '09:00', 'Asia/Manila');
    const back = convertPatternFromUTC(
      utc.dayOfWeek,
      utc.startTime,
      utc.endTime,
      'Asia/Manila',
      utc.crossesMidnight
    );

    expect(back.startTime).toBe('07:00');
    expect(back.endTime).toBe('09:00');
    expect(back.dayOfWeek).toBe(1); // Back to Monday
  });

  it('overnight UTC slots merge correctly when converted to local', () => {
    // UTC pattern: Sunday 23:00-01:00 (crosses midnight)
    // This represents Manila Monday 7am-9am
    const range = createRange('23:00', '01:00', true);

    expect(range.startMinutes).toBe(1380); // 23:00
    expect(range.endMinutes).toBe(1500); // 01:00 = 1440 + 60

    const slots = rangesToSlots([range], '2025-01-05'); // Sunday

    // Should have 4 slots total
    expect(slots.length).toBe(4);

    // 2 slots on Sunday (23:00, 23:30)
    const sundaySlots = slots.filter(s => s.date === '2025-01-05');
    expect(sundaySlots.map(s => s.time).sort()).toEqual(['23:00', '23:30']);

    // 2 slots on Monday (00:00, 00:30)
    const mondaySlots = slots.filter(s => s.date === '2025-01-06');
    expect(mondaySlots.map(s => s.time).sort()).toEqual(['00:00', '00:30']);
  });
});

// ============================================================================
// REGRESSION: Early Morning Patterns in Eastern Timezones
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Early Morning Patterns in Eastern Timezones', () => {
  /**
   * Similar issue: Any pattern in a timezone significantly ahead of UTC
   * that starts before the offset amount will cross midnight in UTC.
   *
   * Examples:
   * - Tokyo (UTC+9): 8am -> 23:00 previous day
   * - Singapore (UTC+8): 7am -> 23:00 previous day
   * - Sydney (UTC+10/11): 9am -> 23:00 previous day
   */

  const testCases = [
    {
      timezone: 'Asia/Tokyo',
      localTime: '08:00',
      endTime: '10:00',
    },
    {
      timezone: 'Asia/Singapore',
      localTime: '07:00',
      endTime: '09:00',
    },
  ];

  it.each(testCases)(
    '$timezone $localTime-$endTime round-trips correctly',
    ({ timezone, localTime, endTime }) => {
      const utc = convertPatternToUTC(1, localTime, endTime, timezone);

      // Should shift to Sunday (day - 1) for early morning in UTC+8/+9
      expect(utc.dayOfWeek).toBe(0);

      // Round-trip should preserve original
      const back = convertPatternFromUTC(
        utc.dayOfWeek,
        utc.startTime,
        utc.endTime,
        timezone,
        utc.crossesMidnight
      );
      expect(back.startTime).toBe(localTime);
      expect(back.dayOfWeek).toBe(1);
    }
  );
});

// ============================================================================
// REGRESSION: Late Night Patterns in Western Timezones
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Late Night Patterns in Western Timezones', () => {
  /**
   * Inverse issue: Late night patterns in western timezones push into next day UTC.
   *
   * Examples:
   * - LA (UTC-8): 10pm -> 06:00 next day
   * - Denver (UTC-7): 11pm -> 06:00 next day
   * - Hawaii (UTC-10): 8pm -> 06:00 next day
   */

  const testCases = [
    {
      timezone: 'America/Los_Angeles',
      localStart: '22:00',
      localEnd: '23:30',
    },
    {
      timezone: 'America/Denver',
      localStart: '23:00',
      localEnd: '23:30',
    },
  ];

  it.each(testCases)(
    '$timezone late night round-trips correctly',
    ({ timezone, localStart, localEnd }) => {
      const utc = convertPatternToUTC(0, localStart, localEnd, timezone);

      // Should shift to next day in UTC
      expect(utc.dayOfWeek).toBe(1); // Monday

      // Round-trip should preserve original
      const back = convertPatternFromUTC(
        utc.dayOfWeek,
        utc.startTime,
        utc.endTime,
        timezone,
        utc.crossesMidnight
      );
      expect(back.startTime).toBe(localStart);
      expect(back.dayOfWeek).toBe(0);
    }
  );
});

// ============================================================================
// REGRESSION: Multi-Day Pattern Generation
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Multi-Day Pattern Generation', () => {
  /**
   * BUG: When generating slots for a week, patterns that crossed midnight
   * would either duplicate slots or miss slots on boundary days.
   */

  it('weekly pattern generates correct slots on all days', () => {
    // Manila 7am-9am every Monday
    // In UTC: Sunday 23:00 - Monday 01:00
    const utcRange = createRange('23:00', '01:00', true);

    // Generate for a full week starting Sunday Jan 5
    const dates = [
      '2025-01-05', // Sunday (has slots from Monday Manila)
      '2025-01-06', // Monday (has slots from Monday Manila)
      '2025-01-12', // Sunday (has slots from next Monday Manila)
      '2025-01-13', // Monday (has slots from next Monday Manila)
    ];

    for (const date of dates) {
      const slots = rangesToSlots([utcRange], date);

      // Each should generate 4 slots (2 hours = 4 x 30min)
      expect(slots.length).toBe(4);
    }
  });

  it('adjacent overnight slots do not create gaps', () => {
    // Two ranges that should be contiguous
    // Sunday 23:00-24:00 and Monday 00:00-01:00
    const range1 = createRange('23:00', '24:00', false);
    const range2 = createRange('00:00', '01:00', false);

    const slots1 = rangesToSlots([range1], '2025-01-05');
    const slots2 = rangesToSlots([range2], '2025-01-06');

    // Range 1: Sunday 23:00, 23:30
    expect(slots1.map(s => `${s.date}T${s.time}`)).toEqual([
      '2025-01-05T23:00',
      '2025-01-05T23:30',
    ]);

    // Range 2: Monday 00:00, 00:30
    expect(slots2.map(s => `${s.date}T${s.time}`)).toEqual([
      '2025-01-06T00:00',
      '2025-01-06T00:30',
    ]);

    // Combined should form continuous 2-hour block
    const allSlots = [...slots1, ...slots2];
    expect(allSlots.length).toBe(4);
  });
});

// ============================================================================
// REGRESSION: Timezone Offset Boundary Edge Cases
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Timezone Offset Boundary Edge Cases', () => {
  /**
   * Edge cases at timezone boundaries where small time differences
   * cross midnight.
   */

  it('UTC+12 midnight round-trips correctly', () => {
    // Auckland (UTC+12/+13): Midnight -> 11:00/12:00 previous day UTC
    const utc = convertPatternToUTC(1, '00:00', '01:00', 'Pacific/Auckland');

    // Should be on Sunday (day shift back)
    expect(utc.dayOfWeek).toBe(0);

    // Round-trip
    const back = convertPatternFromUTC(
      utc.dayOfWeek,
      utc.startTime,
      utc.endTime,
      'Pacific/Auckland',
      utc.crossesMidnight
    );
    expect(back.startTime).toBe('00:00');
    expect(back.dayOfWeek).toBe(1);
  });

  it('fractional offset that crosses midnight', () => {
    // Nepal (UTC+5:45): 5:15am -> 23:30 previous day
    const utc = convertPatternToUTC(1, '05:15', '06:00', 'Asia/Kathmandu');

    // Should be on Sunday
    expect(utc.dayOfWeek).toBe(0);

    // Start time should be 23:30
    expect(utc.startTime).toBe('23:30');

    // Round-trip
    const back = convertPatternFromUTC(
      utc.dayOfWeek,
      utc.startTime,
      utc.endTime,
      'Asia/Kathmandu',
      utc.crossesMidnight
    );
    expect(back.startTime).toBe('05:15');
    expect(back.dayOfWeek).toBe(1);
  });
});
