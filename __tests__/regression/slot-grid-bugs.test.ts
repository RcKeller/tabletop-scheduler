/**
 * REGRESSION TESTS: Slot & Grid Display Bugs
 *
 * These tests cover slot generation and grid display issues that have broken.
 * Each test documents the bug, root cause, and fix.
 */

import {
  createRange,
  timeToMinutes,
  minutesToTime,
  rangesToSlots,
  slotsToRanges,
  mergeRanges,
  totalMinutes,
} from '../../lib/availability/range-math';
import type { TimeRange } from '../../lib/types/availability';

// ============================================================================
// REGRESSION: Slot Generation for Overnight Ranges
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Slot Generation for Overnight Ranges', () => {
  /**
   * BUG: Overnight ranges (crossing midnight) were not generating correct slots.
   * Slots on the second day were missing or duplicated.
   *
   * FIX: rangesToSlots() now correctly handles endMinutes > 1440 by tracking
   * day offset and advancing the date appropriately.
   */

  it('overnight range generates slots on both days', () => {
    // 10pm-2am = 1320 to 1560 (120 minutes past midnight)
    const ranges: TimeRange[] = [{ startMinutes: 1320, endMinutes: 1560 }];
    const slots = rangesToSlots(ranges, '2025-01-06');

    // Should have 8 slots (4 hours * 2 slots/hour)
    expect(slots.length).toBe(8);

    // First 4 slots on original date (22:00, 22:30, 23:00, 23:30)
    const firstDaySlots = slots.filter(s => s.date === '2025-01-06');
    expect(firstDaySlots.length).toBe(4);
    expect(firstDaySlots.map(s => s.time).sort()).toEqual(['22:00', '22:30', '23:00', '23:30']);

    // Last 4 slots on next date (00:00, 00:30, 01:00, 01:30)
    const nextDaySlots = slots.filter(s => s.date === '2025-01-07');
    expect(nextDaySlots.length).toBe(4);
    expect(nextDaySlots.map(s => s.time).sort()).toEqual(['00:00', '00:30', '01:00', '01:30']);
  });

  it('midnight boundary slot is on correct day', () => {
    // Range ending exactly at midnight
    const ranges: TimeRange[] = [{ startMinutes: 1380, endMinutes: 1440 }]; // 23:00-24:00
    const slots = rangesToSlots(ranges, '2025-01-06');

    // Should have 2 slots, both on original date
    expect(slots.length).toBe(2);
    expect(slots.every(s => s.date === '2025-01-06')).toBe(true);
    expect(slots.map(s => s.time).sort()).toEqual(['23:00', '23:30']);
  });

  it('slot at midnight starts next day', () => {
    // Range starting at midnight
    const ranges: TimeRange[] = [{ startMinutes: 1440, endMinutes: 1500 }]; // 00:00-01:00 (next day)
    const slots = rangesToSlots(ranges, '2025-01-06');

    // All slots should be on next day
    expect(slots.length).toBe(2);
    expect(slots.every(s => s.date === '2025-01-07')).toBe(true);
    expect(slots.map(s => s.time).sort()).toEqual(['00:00', '00:30']);
  });
});

// ============================================================================
// REGRESSION: Full Day Slot Count
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Full Day Slot Count', () => {
  /**
   * BUG: Full day ranges were generating wrong number of slots due to
   * off-by-one errors or midnight handling issues.
   *
   * FIX: Full day (0-1440) should generate exactly 48 slots.
   */

  it('full day generates exactly 48 slots', () => {
    const ranges: TimeRange[] = [{ startMinutes: 0, endMinutes: 1440 }];
    const slots = rangesToSlots(ranges, '2025-01-06');

    expect(slots.length).toBe(48);

    // All should be on same date
    expect(slots.every(s => s.date === '2025-01-06')).toBe(true);

    // Should cover every 30-minute interval
    for (let hour = 0; hour < 24; hour++) {
      const hourStr = hour.toString().padStart(2, '0');
      expect(slots.some(s => s.time === `${hourStr}:00`)).toBe(true);
      expect(slots.some(s => s.time === `${hourStr}:30`)).toBe(true);
    }
  });

  it('nearly full day (00:00-23:30) generates 47 slots', () => {
    const ranges: TimeRange[] = [{ startMinutes: 0, endMinutes: 1410 }];
    const slots = rangesToSlots(ranges, '2025-01-06');

    // 23.5 hours * 2 slots/hour = 47 slots
    expect(slots.length).toBe(47);
  });
});

// ============================================================================
// REGRESSION: Slots to Ranges Round-Trip
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Slots to Ranges Round-Trip', () => {
  /**
   * BUG: Converting slots back to ranges was creating incorrect ranges
   * when slots weren't contiguous.
   *
   * FIX: slotsToRanges correctly groups consecutive slots into ranges.
   */

  it('contiguous slots merge into single range', () => {
    const slots = [
      { date: '2025-01-06', time: '09:00' },
      { date: '2025-01-06', time: '09:30' },
      { date: '2025-01-06', time: '10:00' },
      { date: '2025-01-06', time: '10:30' },
    ];

    const ranges = slotsToRanges(slots);
    const mondayRanges = ranges.get('2025-01-06');

    expect(mondayRanges?.length).toBe(1);
    expect(mondayRanges?.[0]).toEqual({ startMinutes: 540, endMinutes: 660 }); // 9am-11am
  });

  it('non-contiguous slots create separate ranges', () => {
    const slots = [
      { date: '2025-01-06', time: '09:00' },
      { date: '2025-01-06', time: '09:30' },
      // Gap here
      { date: '2025-01-06', time: '14:00' },
      { date: '2025-01-06', time: '14:30' },
    ];

    const ranges = slotsToRanges(slots);
    const mondayRanges = ranges.get('2025-01-06');

    expect(mondayRanges?.length).toBe(2);
    expect(mondayRanges?.[0]).toEqual({ startMinutes: 540, endMinutes: 600 }); // 9am-10am
    expect(mondayRanges?.[1]).toEqual({ startMinutes: 840, endMinutes: 900 }); // 2pm-3pm
  });

  it('single slot creates 30-minute range', () => {
    const slots = [{ date: '2025-01-06', time: '12:00' }];

    const ranges = slotsToRanges(slots);
    const mondayRanges = ranges.get('2025-01-06');

    expect(mondayRanges?.length).toBe(1);
    expect(mondayRanges?.[0]).toEqual({ startMinutes: 720, endMinutes: 750 }); // 12pm-12:30pm
  });
});

// ============================================================================
// REGRESSION: 24:00 End Time Handling
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: 24:00 End Time Handling', () => {
  /**
   * BUG: "24:00" as end time was not consistently handled across the codebase.
   * Some functions treated it as "00:00 next day", others as "end of current day".
   *
   * FIX: Standardized "24:00" to mean "end of current day" (= 1440 minutes).
   */

  it('createRange("00:00", "24:00") creates full day range', () => {
    const range = createRange('00:00', '24:00', false);
    expect(range.startMinutes).toBe(0);
    expect(range.endMinutes).toBe(1440);
  });

  it('createRange with 24:00 does not add extra day', () => {
    // This was the bug - 24:00 was sometimes treated as overnight
    const range = createRange('12:00', '24:00', false);

    // Should be 12 hours, not 36 hours
    const duration = range.endMinutes - range.startMinutes;
    expect(duration).toBe(720); // 12 hours
  });

  it('24:00 in timeToMinutes should not cause issues', () => {
    // 24:00 is technically 00:00 of next day, but we use it as end-of-day marker
    // timeToMinutes("24:00") = 24*60 + 0 = 1440
    const minutes = timeToMinutes('24:00');
    expect(minutes).toBe(1440);
  });

  it('minutesToTime(1440) wraps to 00:00', () => {
    // This is expected - display wraps but internal calculations use 1440
    const time = minutesToTime(1440);
    expect(time).toBe('00:00');
  });
});

// ============================================================================
// REGRESSION: Range Merging Edge Cases
// Date: 2026-01-13
// ============================================================================

describe('REGRESSION: Range Merging Edge Cases', () => {
  /**
   * BUG: mergeRanges was not correctly handling adjacent ranges or
   * ranges that barely overlap.
   */

  it('adjacent ranges should merge', () => {
    const ranges: TimeRange[] = [
      { startMinutes: 540, endMinutes: 720 },  // 9am-12pm
      { startMinutes: 720, endMinutes: 900 },  // 12pm-3pm
    ];

    const merged = mergeRanges(ranges);
    expect(merged.length).toBe(1);
    expect(merged[0]).toEqual({ startMinutes: 540, endMinutes: 900 }); // 9am-3pm
  });

  it('overlapping ranges should merge', () => {
    const ranges: TimeRange[] = [
      { startMinutes: 540, endMinutes: 780 },  // 9am-1pm
      { startMinutes: 720, endMinutes: 900 },  // 12pm-3pm (overlaps by 1 hour)
    ];

    const merged = mergeRanges(ranges);
    expect(merged.length).toBe(1);
    expect(merged[0]).toEqual({ startMinutes: 540, endMinutes: 900 }); // 9am-3pm
  });

  it('non-overlapping ranges stay separate', () => {
    const ranges: TimeRange[] = [
      { startMinutes: 540, endMinutes: 720 },   // 9am-12pm
      { startMinutes: 780, endMinutes: 900 },   // 1pm-3pm (gap of 1 hour)
    ];

    const merged = mergeRanges(ranges);
    expect(merged.length).toBe(2);
    expect(merged[0]).toEqual({ startMinutes: 540, endMinutes: 720 });
    expect(merged[1]).toEqual({ startMinutes: 780, endMinutes: 900 });
  });

  it('contained range is absorbed', () => {
    const ranges: TimeRange[] = [
      { startMinutes: 540, endMinutes: 900 },   // 9am-3pm
      { startMinutes: 600, endMinutes: 780 },   // 10am-1pm (fully contained)
    ];

    const merged = mergeRanges(ranges);
    expect(merged.length).toBe(1);
    expect(merged[0]).toEqual({ startMinutes: 540, endMinutes: 900 }); // 9am-3pm
  });

  it('multiple overlapping ranges merge into one', () => {
    const ranges: TimeRange[] = [
      { startMinutes: 540, endMinutes: 660 },   // 9am-11am
      { startMinutes: 600, endMinutes: 720 },   // 10am-12pm
      { startMinutes: 660, endMinutes: 780 },   // 11am-1pm
      { startMinutes: 720, endMinutes: 840 },   // 12pm-2pm
    ];

    const merged = mergeRanges(ranges);
    expect(merged.length).toBe(1);
    expect(merged[0]).toEqual({ startMinutes: 540, endMinutes: 840 }); // 9am-2pm
  });
});

// ============================================================================
// REGRESSION: Total Minutes Calculation
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Total Minutes Calculation', () => {
  /**
   * BUG: totalMinutes was sometimes double-counting overlapping ranges.
   *
   * FIX: totalMinutes now merges ranges first, then sums.
   */

  it('overlapping ranges are not double-counted', () => {
    const ranges: TimeRange[] = [
      { startMinutes: 540, endMinutes: 780 },   // 9am-1pm (4 hours)
      { startMinutes: 720, endMinutes: 900 },   // 12pm-3pm (3 hours, 1 hour overlap)
    ];

    // Actual coverage: 9am-3pm = 6 hours = 360 minutes
    // NOT 4 + 3 = 7 hours = 420 minutes
    const total = totalMinutes(ranges);
    expect(total).toBe(360);
  });

  it('non-overlapping ranges sum correctly', () => {
    const ranges: TimeRange[] = [
      { startMinutes: 540, endMinutes: 720 },   // 9am-12pm (3 hours)
      { startMinutes: 780, endMinutes: 900 },   // 1pm-3pm (2 hours)
    ];

    // Total: 3 + 2 = 5 hours = 300 minutes
    const total = totalMinutes(ranges);
    expect(total).toBe(300);
  });

  it('empty ranges return 0', () => {
    const total = totalMinutes([]);
    expect(total).toBe(0);
  });
});

// ============================================================================
// REGRESSION: Slot Time Boundary Edge Cases
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Slot Time Boundary Edge Cases', () => {
  /**
   * Tests for slots at day boundaries and unusual times.
   */

  it('last slot of day (23:30) is included', () => {
    const ranges: TimeRange[] = [{ startMinutes: 1380, endMinutes: 1440 }]; // 23:00-24:00
    const slots = rangesToSlots(ranges, '2025-01-06');

    expect(slots.length).toBe(2);
    expect(slots.some(s => s.time === '23:30')).toBe(true);
  });

  it('first slot of day (00:00) is included', () => {
    const ranges: TimeRange[] = [{ startMinutes: 0, endMinutes: 60 }]; // 00:00-01:00
    const slots = rangesToSlots(ranges, '2025-01-06');

    expect(slots.length).toBe(2);
    expect(slots.some(s => s.time === '00:00')).toBe(true);
  });

  it('range ending at 00:00 does not create next-day slot', () => {
    const ranges: TimeRange[] = [{ startMinutes: 1380, endMinutes: 1440 }]; // 23:00-24:00
    const slots = rangesToSlots(ranges, '2025-01-06');

    // All slots should be on the same day
    expect(slots.every(s => s.date === '2025-01-06')).toBe(true);
    expect(slots.some(s => s.date === '2025-01-07')).toBe(false);
  });

  it('30-minute slot at noon', () => {
    const ranges: TimeRange[] = [{ startMinutes: 720, endMinutes: 750 }]; // 12:00-12:30
    const slots = rangesToSlots(ranges, '2025-01-06');

    expect(slots.length).toBe(1);
    expect(slots[0]).toEqual({ date: '2025-01-06', time: '12:00' });
  });
});
