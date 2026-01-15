/**
 * REGRESSION TESTS: GM Availability Display on Player Page
 *
 * These tests cover the bug where players saw incorrect GM availability
 * on the Edit Availability page (showing 24hrs for Manila timezone recurring slots).
 *
 * Bug: The participant page.tsx was not properly handling overnight ranges
 * when converting effectiveRanges to gmAvailability slots.
 *
 * Date: 2026-01-15
 */

import { minutesToTime } from '@/lib/availability';

/**
 * Helper function that mirrors the overnight range splitting logic
 * from app/[campaign]/[participantId]/page.tsx
 *
 * This is the FIXED version - tests verify the fix works correctly.
 */
function convertRangesToGmAvailability(
  effectiveRanges: Map<string, { availableRanges: { startMinutes: number; endMinutes: number }[] }>
): { date: string; startTime: string; endTime: string }[] {
  const gmAvailability: { date: string; startTime: string; endTime: string }[] = [];

  for (const [date, dayAvail] of effectiveRanges) {
    for (const range of dayAvail.availableRanges) {
      if (range.endMinutes > 1440) {
        // Overnight range - split into two parts
        // Part 1: startTime to midnight (24:00)
        gmAvailability.push({
          date,
          startTime: minutesToTime(range.startMinutes),
          endTime: "24:00",
        });
        // Part 2: midnight to endTime on next day
        const nextDate = new Date(date + "T12:00:00Z");
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        const nextDateStr = nextDate.toISOString().split("T")[0];
        const wrappedEnd = range.endMinutes - 1440;
        if (wrappedEnd > 0) {
          gmAvailability.push({
            date: nextDateStr,
            startTime: "00:00",
            endTime: minutesToTime(wrappedEnd),
          });
        }
      } else if (range.endMinutes === 1440) {
        // Full day ending at midnight
        gmAvailability.push({
          date,
          startTime: minutesToTime(range.startMinutes),
          endTime: "24:00",
        });
      } else {
        gmAvailability.push({
          date,
          startTime: minutesToTime(range.startMinutes),
          endTime: minutesToTime(range.endMinutes),
        });
      }
    }
  }

  return gmAvailability;
}

// ============================================================================
// REGRESSION: Manila Timezone Overnight Ranges
// Date: 2026-01-15
// ============================================================================

describe('REGRESSION: GM Availability Display - Manila Timezone', () => {
  /**
   * BUG: When GM set recurring availability in Manila timezone, players
   * saw 24 hours of availability on the Edit Availability page.
   *
   * ROOT CAUSE: computeEffectiveRanges returns ranges with endMinutes > 1440
   * for overnight slots. The participant page.tsx was calling
   * minutesToTime(range.endMinutes) directly, which produced invalid times
   * like "25:00" or "26:00" causing display issues.
   *
   * FIX: Split overnight ranges into two parts:
   * 1. Current day: startTime to "24:00"
   * 2. Next day: "00:00" to wrapped endTime
   */

  it('correctly splits overnight ranges (endMinutes > 1440)', () => {
    // Simulate effectiveRanges from computeEffectiveRanges
    // This represents a Manila 7am-9am pattern stored as UTC 23:00-01:00
    // which after timezone conversion gives endMinutes of 1500 (25:00)
    const effectiveRanges = new Map([
      ['2025-01-19', {
        availableRanges: [
          { startMinutes: 1380, endMinutes: 1500 }, // 23:00 to 25:00 (overnight)
        ]
      }]
    ]);

    const result = convertRangesToGmAvailability(effectiveRanges);

    // Should produce TWO slots, not one invalid slot
    expect(result.length).toBe(2);

    // First slot: ends at midnight on original day
    expect(result[0]).toEqual({
      date: '2025-01-19',
      startTime: '23:00',
      endTime: '24:00',
    });

    // Second slot: starts at midnight on next day
    expect(result[1]).toEqual({
      date: '2025-01-20',
      startTime: '00:00',
      endTime: '01:00', // 1500 - 1440 = 60 mins = 01:00
    });
  });

  it('handles full day ending at midnight (endMinutes === 1440)', () => {
    const effectiveRanges = new Map([
      ['2025-01-19', {
        availableRanges: [
          { startMinutes: 0, endMinutes: 1440 }, // Full day 00:00-24:00
        ]
      }]
    ]);

    const result = convertRangesToGmAvailability(effectiveRanges);

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      date: '2025-01-19',
      startTime: '00:00',
      endTime: '24:00',
    });
  });

  it('handles normal ranges (endMinutes < 1440)', () => {
    const effectiveRanges = new Map([
      ['2025-01-19', {
        availableRanges: [
          { startMinutes: 540, endMinutes: 720 }, // 09:00-12:00
        ]
      }]
    ]);

    const result = convertRangesToGmAvailability(effectiveRanges);

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      date: '2025-01-19',
      startTime: '09:00',
      endTime: '12:00',
    });
  });

  it('handles multiple ranges on same day with mixed overnight', () => {
    const effectiveRanges = new Map([
      ['2025-01-19', {
        availableRanges: [
          { startMinutes: 540, endMinutes: 720 },   // 09:00-12:00 (normal)
          { startMinutes: 1380, endMinutes: 1500 }, // 23:00-01:00 (overnight)
        ]
      }]
    ]);

    const result = convertRangesToGmAvailability(effectiveRanges);

    // 1 normal + 2 from split overnight = 3 total
    expect(result.length).toBe(3);

    // Normal range
    expect(result[0]).toEqual({
      date: '2025-01-19',
      startTime: '09:00',
      endTime: '12:00',
    });

    // Overnight part 1
    expect(result[1]).toEqual({
      date: '2025-01-19',
      startTime: '23:00',
      endTime: '24:00',
    });

    // Overnight part 2
    expect(result[2]).toEqual({
      date: '2025-01-20',
      startTime: '00:00',
      endTime: '01:00',
    });
  });

  it('handles edge case where wrappedEnd is 0 (exactly at midnight)', () => {
    // endMinutes = 1440 exactly should use the "=== 1440" case
    // but if we had endMinutes = 1440 in the > 1440 block, wrappedEnd = 0
    const effectiveRanges = new Map([
      ['2025-01-19', {
        availableRanges: [
          { startMinutes: 1380, endMinutes: 1440 }, // 23:00-24:00
        ]
      }]
    ]);

    const result = convertRangesToGmAvailability(effectiveRanges);

    // Uses the === 1440 branch
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      date: '2025-01-19',
      startTime: '23:00',
      endTime: '24:00',
    });
  });

  it('handles very late overnight (endMinutes much greater than 1440)', () => {
    // Extreme case: startMinutes at 22:00, endMinutes at 03:00 next day
    // This is 22:00 to 27:00 in extended form
    const effectiveRanges = new Map([
      ['2025-01-19', {
        availableRanges: [
          { startMinutes: 1320, endMinutes: 1620 }, // 22:00 to 03:00 (27:00)
        ]
      }]
    ]);

    const result = convertRangesToGmAvailability(effectiveRanges);

    expect(result.length).toBe(2);

    // Part 1: 22:00 to 24:00
    expect(result[0]).toEqual({
      date: '2025-01-19',
      startTime: '22:00',
      endTime: '24:00',
    });

    // Part 2: 00:00 to 03:00 (1620 - 1440 = 180 = 03:00)
    expect(result[1]).toEqual({
      date: '2025-01-20',
      startTime: '00:00',
      endTime: '03:00',
    });
  });
});

// ============================================================================
// REGRESSION: Multiple Days with Overnight Ranges
// Date: 2026-01-15
// ============================================================================

describe('REGRESSION: GM Availability Display - Multiple Days', () => {
  it('handles consecutive days with overnight ranges', () => {
    // GM available 23:00-01:00 on multiple days
    const effectiveRanges = new Map([
      ['2025-01-19', {
        availableRanges: [{ startMinutes: 1380, endMinutes: 1500 }]
      }],
      ['2025-01-20', {
        availableRanges: [{ startMinutes: 1380, endMinutes: 1500 }]
      }],
    ]);

    const result = convertRangesToGmAvailability(effectiveRanges);

    // 2 days × 2 parts each = 4 slots
    expect(result.length).toBe(4);

    // Day 1 part 1
    expect(result[0]).toEqual({
      date: '2025-01-19',
      startTime: '23:00',
      endTime: '24:00',
    });

    // Day 1 part 2
    expect(result[1]).toEqual({
      date: '2025-01-20',
      startTime: '00:00',
      endTime: '01:00',
    });

    // Day 2 part 1
    expect(result[2]).toEqual({
      date: '2025-01-20',
      startTime: '23:00',
      endTime: '24:00',
    });

    // Day 2 part 2
    expect(result[3]).toEqual({
      date: '2025-01-21',
      startTime: '00:00',
      endTime: '01:00',
    });
  });
});

// ============================================================================
// REGRESSION: Invalid Time Output Prevention
// Date: 2026-01-15
// ============================================================================

describe('REGRESSION: GM Availability Display - Invalid Time Prevention', () => {
  /**
   * The original bug produced invalid times like "25:00" or "26:00".
   * These tests verify all output times are valid HH:MM format.
   */

  it('never produces times >= 24:00 except for endTime "24:00"', () => {
    const testCases = [
      { startMinutes: 1380, endMinutes: 1500 }, // 23:00-25:00
      { startMinutes: 1320, endMinutes: 1620 }, // 22:00-27:00
      { startMinutes: 1410, endMinutes: 1470 }, // 23:30-24:30
      { startMinutes: 0, endMinutes: 1440 },    // 00:00-24:00
    ];

    for (const { startMinutes, endMinutes } of testCases) {
      const effectiveRanges = new Map([
        ['2025-01-19', { availableRanges: [{ startMinutes, endMinutes }] }]
      ]);

      const result = convertRangesToGmAvailability(effectiveRanges);

      for (const slot of result) {
        // startTime must be valid HH:MM (00:00 - 23:30)
        const [startH] = slot.startTime.split(':').map(Number);
        expect(startH).toBeLessThan(24);

        // endTime can be "24:00" or valid HH:MM
        if (slot.endTime !== '24:00') {
          const [endH] = slot.endTime.split(':').map(Number);
          expect(endH).toBeLessThan(24);
        }
      }
    }
  });
});
