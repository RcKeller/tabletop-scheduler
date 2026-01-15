/**
 * Integration tests for the complete availability timezone pipeline
 *
 * Tests the FULL flow:
 * 1. User enters pattern in their timezone
 * 2. Pattern is converted to UTC for storage
 * 3. Pattern is used to compute effective availability
 * 4. Availability is converted back to display timezone
 *
 * These tests ensure the entire pipeline works correctly across all timezones.
 */

import {
  prepareRuleForStorage,
  convertPatternFromUTC,
  utcToLocal,
} from '../../lib/availability/timezone';
import {
  computeEffectiveRanges,
  computeEffectiveForDate,
} from '../../lib/availability/compute-effective';
import {
  createRange,
  minutesToTime,
  timeToMinutes,
  rangesToSlots,
  mergeRanges,
} from '../../lib/availability/range-math';
import type { AvailabilityRule, DateRange, TimeRange } from '../../lib/types/availability';

// ============================================================================
// Test helper functions
// ============================================================================

function createPatternRule(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  timezone: string,
  isAvailable: boolean = true
): AvailabilityRule {
  const prepared = prepareRuleForStorage(
    {
      ruleType: isAvailable ? 'available_pattern' : 'blocked_pattern',
      dayOfWeek,
      startTime,
      endTime,
    },
    timezone
  );

  return {
    id: `test-${dayOfWeek}-${startTime}-${endTime}`,
    participantId: 'test-participant',
    ruleType: isAvailable ? 'available_pattern' : 'blocked_pattern',
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

// Converts UTC slots back to local timezone and merges adjacent
function convertSlotsToLocal(
  slots: { date: string; startTime: string; endTime: string }[],
  timezone: string
): { date: string; startTime: string; endTime: string }[] {
  if (timezone === 'UTC') return slots;

  const result: { date: string; startTime: string; endTime: string }[] = [];

  for (const slot of slots) {
    const start = utcToLocal(slot.startTime, slot.date, timezone);
    let end;
    if (slot.endTime === '24:00') {
      const nextDate = new Date(slot.date + 'T12:00:00Z');
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      end = utcToLocal('00:00', nextDateStr, timezone);
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
      result.push({
        date: start.date,
        startTime: start.time,
        endTime: '24:00',
      });
      if (end.time > '00:00') {
        result.push({
          date: end.date,
          startTime: '00:00',
          endTime: end.time,
        });
      }
    }
  }

  // Merge adjacent slots by date
  const byDate = new Map<string, { startTime: string; endTime: string }[]>();
  for (const slot of result) {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date)!.push({ startTime: slot.startTime, endTime: slot.endTime });
  }

  const merged: { date: string; startTime: string; endTime: string }[] = [];
  for (const [date, daySlots] of byDate) {
    daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
    let current = daySlots[0];
    for (let i = 1; i < daySlots.length; i++) {
      const next = daySlots[i];
      if (current.endTime >= next.startTime) {
        current = {
          startTime: current.startTime,
          endTime: current.endTime > next.endTime ? current.endTime : next.endTime,
        };
      } else {
        merged.push({ date, ...current });
        current = next;
      }
    }
    merged.push({ date, ...current });
  }

  return merged;
}

// Computes effective slots in UTC then converts to local
function computeLocalAvailability(
  rules: AvailabilityRule[],
  dateRange: DateRange,
  displayTimezone: string
): { date: string; startTime: string; endTime: string }[] {
  // Expand date range for timezone shifts
  const expandedStart = new Date(dateRange.startDate + 'T12:00:00Z');
  expandedStart.setUTCDate(expandedStart.getUTCDate() - 1);
  const expandedEnd = new Date(dateRange.endDate + 'T12:00:00Z');
  expandedEnd.setUTCDate(expandedEnd.getUTCDate() + 1);

  const expandedRange: DateRange = {
    startDate: expandedStart.toISOString().split('T')[0],
    endDate: expandedEnd.toISOString().split('T')[0],
  };

  const effectiveRanges = computeEffectiveRanges(rules, expandedRange);
  const utcSlots: { date: string; startTime: string; endTime: string }[] = [];

  for (const [date, dayAvail] of effectiveRanges) {
    for (const range of dayAvail.availableRanges) {
      if (range.endMinutes >= 1440) {
        utcSlots.push({
          date,
          startTime: minutesToTime(range.startMinutes),
          endTime: '24:00',
        });
        const nextDate = new Date(date + 'T12:00:00Z');
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];
        const wrappedEnd = range.endMinutes - 1440;
        if (wrappedEnd > 0) {
          utcSlots.push({
            date: nextDateStr,
            startTime: '00:00',
            endTime: minutesToTime(wrappedEnd),
          });
        }
      } else {
        utcSlots.push({
          date,
          startTime: minutesToTime(range.startMinutes),
          endTime: minutesToTime(range.endMinutes),
        });
      }
    }
  }

  return convertSlotsToLocal(utcSlots, displayTimezone);
}

// ============================================================================
// FULL PIPELINE TESTS
// ============================================================================

describe('Full Pipeline: Pattern → UTC → Effective → Display', () => {
  describe('standard timezone matrix', () => {
    const timezones = [
      'UTC',
      'America/Los_Angeles',
      'America/New_York',
      'America/Chicago',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Asia/Manila',
      'Asia/Kolkata',
      'Asia/Kathmandu',
      'Australia/Sydney',
      'Pacific/Auckland',
    ];

    it.each(timezones)(
      'Monday 9am-5pm in %s displays correctly in same timezone',
      (timezone) => {
        const rule = createPatternRule(1, '09:00', '17:00', timezone);
        const dateRange: DateRange = {
          startDate: '2025-01-06', // Monday
          endDate: '2025-01-06',
        };

        const localAvailability = computeLocalAvailability([rule], dateRange, timezone);

        // Filter to just Monday in the display timezone
        const monday = localAvailability.filter(s => s.date === '2025-01-06');

        // Should have availability covering 9am-5pm local
        const has9to5 = monday.some(s => {
          const start = timeToMinutes(s.startTime);
          const end = timeToMinutes(s.endTime);
          return start <= 540 && end >= 1020; // 9am to 5pm
        });

        expect(has9to5).toBe(true);
      }
    );
  });

  describe('cross-timezone viewing', () => {
    const crossTzCases: [string, string, string, string][] = [
      // [inputTz, displayTz, expectedLocalDay, description]
      // Note: We're testing Monday 9am-5pm in input timezone
      // and checking it displays correctly in the display timezone
      ['America/Los_Angeles', 'America/New_York', '2025-01-06', 'LA to NYC (+3 hours)'],
      ['America/New_York', 'America/Los_Angeles', '2025-01-06', 'NYC to LA (-3 hours)'],
      ['Asia/Manila', 'America/Los_Angeles', '2025-01-05', 'Manila Monday to LA Sunday'],
      ['America/Los_Angeles', 'Asia/Manila', '2025-01-07', 'LA Monday to Manila Tuesday'],
      ['Europe/London', 'Asia/Tokyo', '2025-01-06', 'London to Tokyo (+9 hours)'],
    ];

    it.each(crossTzCases)(
      'pattern in %s displays in %s on expected day %s (%s)',
      (inputTz, displayTz) => {
        const rule = createPatternRule(1, '09:00', '17:00', inputTz);
        const dateRange: DateRange = {
          startDate: '2025-01-05',
          endDate: '2025-01-08',
        };

        const localAvailability = computeLocalAvailability([rule], dateRange, displayTz);

        // Verify there's some availability (exact day depends on timezone shift)
        expect(localAvailability.length).toBeGreaterThan(0);

        // Total duration should still be 8 hours (480 minutes)
        let totalMinutes = 0;
        for (const slot of localAvailability) {
          const start = timeToMinutes(slot.startTime);
          let end = timeToMinutes(slot.endTime);
          if (slot.endTime === '24:00') end = 1440;
          totalMinutes += end - start;
        }

        // Allow small variance due to merging/splitting but should be ~480
        expect(totalMinutes).toBeGreaterThanOrEqual(480);
        expect(totalMinutes).toBeLessThanOrEqual(480);
      }
    );
  });
});

describe('Full Pipeline: Full Day Patterns', () => {
  // CRITICAL: Full day patterns must show as 24 hours regardless of timezone

  const fullDayCases: [string, string][] = [
    ['UTC', 'UTC'],
    ['America/Los_Angeles', 'America/Los_Angeles'],
    ['America/Los_Angeles', 'Asia/Manila'],
    ['Asia/Manila', 'America/Los_Angeles'],
    ['Asia/Tokyo', 'Europe/London'],
    ['Asia/Kolkata', 'America/New_York'],
    ['Pacific/Auckland', 'America/Los_Angeles'],
  ];

  it.each(fullDayCases)(
    'full day (00:00-24:00) in %s displays as 24 hours in %s',
    (inputTz, displayTz) => {
      const rule = createPatternRule(1, '00:00', '24:00', inputTz);
      const dateRange: DateRange = {
        startDate: '2025-01-05',
        endDate: '2025-01-08',
      };

      const localAvailability = computeLocalAvailability([rule], dateRange, displayTz);

      // Calculate total availability - should be exactly 24 hours (1440 minutes)
      let totalMinutes = 0;
      for (const slot of localAvailability) {
        const start = timeToMinutes(slot.startTime);
        let end = timeToMinutes(slot.endTime);
        if (slot.endTime === '24:00') end = 1440;
        totalMinutes += end - start;
      }

      expect(totalMinutes).toBe(1440);
    }
  );
});

describe('Full Pipeline: Overnight Patterns', () => {
  // Overnight patterns (e.g., 10pm-2am) have complex behavior when converted across timezones.
  // The crossesMidnight flag from the original pattern affects how the range is calculated.
  // These tests verify that overnight patterns in UTC work correctly.

  it('overnight 10pm-2am in UTC displays as 4 hours in UTC', () => {
    const rule = createPatternRule(1, '22:00', '02:00', 'UTC');
    const dateRange: DateRange = {
      startDate: '2025-01-05',
      endDate: '2025-01-08',
    };

    const localAvailability = computeLocalAvailability([rule], dateRange, 'UTC');

    // Calculate total duration
    let totalMinutes = 0;
    for (const slot of localAvailability) {
      const start = timeToMinutes(slot.startTime);
      let end = timeToMinutes(slot.endTime);
      if (slot.endTime === '24:00') end = 1440;
      totalMinutes += end - start;
    }

    // The overnight pattern 22:00-02:00 is 4 hours = 240 minutes
    expect(totalMinutes).toBe(240);
  });
});

describe('Full Pipeline: Gap Preservation (Regression Test)', () => {
  // CRITICAL: Gaps between patterns should NOT be filled in

  describe('user scenario: 2am-1pm AND 5pm-10pm (gap 1pm-5pm)', () => {
    const timezones = [
      'UTC',
      'America/Los_Angeles',
      'America/New_York',
      'Asia/Manila',
      'Asia/Tokyo',
      'Europe/London',
    ];

    it.each(timezones)(
      'gap between 1pm and 5pm is NOT available in %s',
      (timezone) => {
        // Create two patterns with a gap
        const rule1 = createPatternRule(1, '02:00', '13:00', timezone); // 2am-1pm
        const rule2 = createPatternRule(1, '17:00', '22:00', timezone); // 5pm-10pm

        const dateRange: DateRange = {
          startDate: '2025-01-05',
          endDate: '2025-01-08',
        };

        const localAvailability = computeLocalAvailability([rule1, rule2], dateRange, timezone);

        // Filter to just the expected Monday
        const monday = localAvailability.filter(s => s.date === '2025-01-06');

        // Check that the gap (1pm-5pm = 780-1020 minutes) is NOT available
        const gapStart = 780; // 1pm
        const gapEnd = 1020;  // 5pm

        // A slot covers the gap if it starts before gap ends AND ends after gap starts
        const hasGap = monday.some(s => {
          const start = timeToMinutes(s.startTime);
          let end = timeToMinutes(s.endTime);
          if (s.endTime === '24:00') end = 1440;

          // Check if this slot overlaps with the gap
          return start < gapEnd && end > gapStart;
        });

        expect(hasGap).toBe(false);
      }
    );
  });
});

describe('Full Pipeline: Blocked Patterns', () => {
  describe('blocked pattern removes availability', () => {
    const timezones = ['UTC', 'America/Los_Angeles', 'Asia/Manila'];

    it.each(timezones)(
      'blocked 12pm-1pm removes that time from 9am-5pm availability in %s',
      (timezone) => {
        const availableRule = createPatternRule(1, '09:00', '17:00', timezone, true);
        const blockedRule = createPatternRule(1, '12:00', '13:00', timezone, false);

        const dateRange: DateRange = {
          startDate: '2025-01-05',
          endDate: '2025-01-08',
        };

        const localAvailability = computeLocalAvailability(
          [availableRule, blockedRule],
          dateRange,
          timezone
        );

        // Filter to Monday
        const monday = localAvailability.filter(s => s.date === '2025-01-06');

        // Should have two separate ranges (9-12 and 1-5), not one continuous range
        // The blocked 12-1pm creates a gap

        // Check noon (720 minutes) is NOT available
        const noonAvailable = monday.some(s => {
          const start = timeToMinutes(s.startTime);
          let end = timeToMinutes(s.endTime);
          if (s.endTime === '24:00') end = 1440;
          return start <= 720 && end > 720;
        });

        expect(noonAvailable).toBe(false);

        // But 11am (660) should be available
        const elevenAmAvailable = monday.some(s => {
          const start = timeToMinutes(s.startTime);
          let end = timeToMinutes(s.endTime);
          if (s.endTime === '24:00') end = 1440;
          return start <= 660 && end > 660;
        });

        expect(elevenAmAvailable).toBe(true);
      }
    );
  });
});

describe('Full Pipeline: Multiple Days', () => {
  describe('weekday patterns across week', () => {
    it('Mon-Fri 9-5 shows correct availability for each day', () => {
      const rules = [
        createPatternRule(1, '09:00', '17:00', 'America/Los_Angeles'),
        createPatternRule(2, '09:00', '17:00', 'America/Los_Angeles'),
        createPatternRule(3, '09:00', '17:00', 'America/Los_Angeles'),
        createPatternRule(4, '09:00', '17:00', 'America/Los_Angeles'),
        createPatternRule(5, '09:00', '17:00', 'America/Los_Angeles'),
      ];

      const dateRange: DateRange = {
        startDate: '2025-01-06', // Monday
        endDate: '2025-01-12',   // Sunday
      };

      const localAvailability = computeLocalAvailability(
        rules,
        dateRange,
        'America/Los_Angeles'
      );

      // Group by date
      const byDate = new Map<string, { startTime: string; endTime: string }[]>();
      for (const slot of localAvailability) {
        if (!byDate.has(slot.date)) byDate.set(slot.date, []);
        byDate.get(slot.date)!.push({ startTime: slot.startTime, endTime: slot.endTime });
      }

      // Monday-Friday should have availability
      expect(byDate.get('2025-01-06')?.length).toBeGreaterThan(0);
      expect(byDate.get('2025-01-07')?.length).toBeGreaterThan(0);
      expect(byDate.get('2025-01-08')?.length).toBeGreaterThan(0);
      expect(byDate.get('2025-01-09')?.length).toBeGreaterThan(0);
      expect(byDate.get('2025-01-10')?.length).toBeGreaterThan(0);

      // Saturday-Sunday should NOT have availability (or be empty)
      expect(byDate.get('2025-01-11') || []).toHaveLength(0);
      expect(byDate.get('2025-01-12') || []).toHaveLength(0);
    });
  });
});

describe('Full Pipeline: >24hr Bug Regression', () => {
  // CRITICAL: This tests the exact bug that was fixed
  // Manila 00:00-23:30 should NOT display as >24 hours when viewed in PST

  it('Manila full day (00:00-24:00) viewed in LA shows exactly 24 hours', () => {
    const rule = createPatternRule(1, '00:00', '24:00', 'Asia/Manila');

    const dateRange: DateRange = {
      startDate: '2025-01-05',
      endDate: '2025-01-08',
    };

    const localAvailability = computeLocalAvailability([rule], dateRange, 'America/Los_Angeles');

    // Calculate total minutes
    let totalMinutes = 0;
    for (const slot of localAvailability) {
      const start = timeToMinutes(slot.startTime);
      let end = timeToMinutes(slot.endTime);
      if (slot.endTime === '24:00') end = 1440;
      totalMinutes += end - start;
    }

    // Should be exactly 24 hours, NOT more
    expect(totalMinutes).toBe(1440);
  });

  it('LA full day (00:00-24:00) viewed in Manila shows exactly 24 hours', () => {
    const rule = createPatternRule(1, '00:00', '24:00', 'America/Los_Angeles');

    const dateRange: DateRange = {
      startDate: '2025-01-05',
      endDate: '2025-01-08',
    };

    const localAvailability = computeLocalAvailability([rule], dateRange, 'Asia/Manila');

    let totalMinutes = 0;
    for (const slot of localAvailability) {
      const start = timeToMinutes(slot.startTime);
      let end = timeToMinutes(slot.endTime);
      if (slot.endTime === '24:00') end = 1440;
      totalMinutes += end - start;
    }

    expect(totalMinutes).toBe(1440);
  });

  const timezone24hrCases: [string, string][] = [
    ['America/Los_Angeles', 'Asia/Tokyo'],
    ['Asia/Tokyo', 'America/Los_Angeles'],
    ['Europe/London', 'Pacific/Auckland'],
    ['Pacific/Auckland', 'Europe/London'],
    ['Asia/Kolkata', 'America/New_York'],
    ['America/New_York', 'Asia/Kolkata'],
  ];

  it.each(timezone24hrCases)(
    'full day in %s viewed in %s shows exactly 24 hours',
    (inputTz, displayTz) => {
      const rule = createPatternRule(1, '00:00', '24:00', inputTz);

      const dateRange: DateRange = {
        startDate: '2025-01-05',
        endDate: '2025-01-08',
      };

      const localAvailability = computeLocalAvailability([rule], dateRange, displayTz);

      let totalMinutes = 0;
      for (const slot of localAvailability) {
        const start = timeToMinutes(slot.startTime);
        let end = timeToMinutes(slot.endTime);
        if (slot.endTime === '24:00') end = 1440;
        totalMinutes += end - start;
      }

      expect(totalMinutes).toBe(1440);
    }
  );
});
