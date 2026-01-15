/**
 * Comprehensive tests for heatmap and overlap computation
 *
 * Tests multi-participant availability aggregation across timezones
 * to ensure the scheduling algorithm works correctly.
 */

import {
  computeHeatmap,
  findOverlappingSlots,
  findSessionSlots,
  computeEffectiveForDate,
} from '../../../lib/availability/compute-effective';
import { prepareRuleForStorage } from '../../../lib/availability/timezone';
import type { AvailabilityRule, DateRange } from '../../../lib/types/availability';

// ============================================================================
// Test helpers
// ============================================================================

function createPatternRule(
  participantId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  timezone: string
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
    id: `${participantId}-${dayOfWeek}-${startTime}-${endTime}`,
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

// ============================================================================
// Heatmap tests
// ============================================================================

describe('computeHeatmap matrix', () => {
  describe('single participant', () => {
    it('generates correct slot counts for one participant', () => {
      const participantRules = new Map<string, AvailabilityRule[]>();
      participantRules.set('p1', [
        createPatternRule('p1', 1, '09:00', '11:00', 'UTC'), // 4 slots (9:00, 9:30, 10:00, 10:30)
      ]);

      const heatmap = computeHeatmap(participantRules, {
        startDate: '2025-01-06', // Monday
        endDate: '2025-01-06',
      });

      expect(heatmap.get('2025-01-06|09:00')?.count).toBe(1);
      expect(heatmap.get('2025-01-06|09:30')?.count).toBe(1);
      expect(heatmap.get('2025-01-06|10:00')?.count).toBe(1);
      expect(heatmap.get('2025-01-06|10:30')?.count).toBe(1);
      expect(heatmap.get('2025-01-06|11:00')).toBeUndefined(); // End time is exclusive
    });
  });

  describe('multiple participants with overlap', () => {
    const overlapCases: [string, string, number, number, string][] = [
      // [p1Timezone, p2Timezone, expectedMaxCount, expectedMinCount, description]
      ['UTC', 'UTC', 2, 1, 'same timezone full overlap'],
      ['America/Los_Angeles', 'America/New_York', 2, 1, 'different US timezones'],
      ['America/Los_Angeles', 'Asia/Manila', 2, 1, 'cross-pacific timezones'],
    ];

    it.each(overlapCases)(
      'participants in %s and %s have max count %d and min count %d (%s)',
      (p1Tz, p2Tz, expectedMax, expectedMin) => {
        const participantRules = new Map<string, AvailabilityRule[]>();

        // P1: Monday 10am-2pm in their timezone
        participantRules.set('p1', [
          createPatternRule('p1', 1, '10:00', '14:00', p1Tz),
        ]);

        // P2: Monday 12pm-4pm in their timezone
        participantRules.set('p2', [
          createPatternRule('p2', 1, '12:00', '16:00', p2Tz),
        ]);

        const heatmap = computeHeatmap(participantRules, {
          startDate: '2025-01-05',
          endDate: '2025-01-08',
        });

        // Check that we have some slots with overlap
        let maxCount = 0;
        let minCountWithData = Infinity;

        for (const [, data] of heatmap) {
          maxCount = Math.max(maxCount, data.count);
          minCountWithData = Math.min(minCountWithData, data.count);
        }

        expect(maxCount).toBe(expectedMax);
        expect(minCountWithData).toBe(expectedMin);
      }
    );
  });

  describe('heatmap with different timezones', () => {
    it('correctly aggregates slots when timezone offsets cause day shifts', () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      // P1 in LA: Monday 6pm-10pm LA = Tuesday 2am-6am UTC
      participantRules.set('p1', [
        createPatternRule('p1', 1, '18:00', '22:00', 'America/Los_Angeles'),
      ]);

      // P2 in Manila: Tuesday 10am-2pm Manila = Tuesday 2am-6am UTC
      participantRules.set('p2', [
        createPatternRule('p2', 2, '10:00', '14:00', 'Asia/Manila'),
      ]);

      // These should overlap in UTC since both convert to Tuesday 2am-6am UTC!

      const heatmap = computeHeatmap(participantRules, {
        startDate: '2025-01-06', // Monday
        endDate: '2025-01-08',   // Wednesday
      });

      // Check for overlap on Tuesday UTC morning
      const tuesday2am = heatmap.get('2025-01-07|02:00');
      const tuesday3am = heatmap.get('2025-01-07|03:00');

      // Should have count of 2 (both participants available)
      expect(tuesday2am?.count).toBe(2);
      expect(tuesday2am?.participantIds).toContain('p1');
      expect(tuesday2am?.participantIds).toContain('p2');

      expect(tuesday3am?.count).toBe(2);
    });
  });

  describe('heatmap with full day patterns', () => {
    it('full day patterns generate 48 slots per day', () => {
      const participantRules = new Map<string, AvailabilityRule[]>();
      participantRules.set('p1', [
        createPatternRule('p1', 1, '00:00', '24:00', 'UTC'), // Full day Monday
      ]);

      const heatmap = computeHeatmap(participantRules, {
        startDate: '2025-01-06', // Monday
        endDate: '2025-01-06',
      });

      // Count slots for Monday
      let mondaySlots = 0;
      for (const [key, data] of heatmap) {
        if (key.startsWith('2025-01-06')) {
          mondaySlots++;
        }
      }

      expect(mondaySlots).toBe(48); // 24 hours * 2 slots per hour
    });
  });
});

// ============================================================================
// findOverlappingSlots tests
// ============================================================================

describe('findOverlappingSlots matrix', () => {
  describe('all participants required (default)', () => {
    it('finds slots where all participants are available', () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      // P1: Monday 9am-1pm UTC
      participantRules.set('p1', [
        createPatternRule('p1', 1, '09:00', '13:00', 'UTC'),
      ]);

      // P2: Monday 10am-2pm UTC
      participantRules.set('p2', [
        createPatternRule('p2', 1, '10:00', '14:00', 'UTC'),
      ]);

      const overlapping = findOverlappingSlots(participantRules, {
        startDate: '2025-01-06',
        endDate: '2025-01-06',
      });

      // Overlap is 10am-1pm (6 slots: 10:00, 10:30, 11:00, 11:30, 12:00, 12:30)
      expect(overlapping.length).toBe(6);

      const times = overlapping.map(s => s.time);
      expect(times).toContain('10:00');
      expect(times).toContain('10:30');
      expect(times).toContain('11:00');
      expect(times).toContain('11:30');
      expect(times).toContain('12:00');
      expect(times).toContain('12:30');
      expect(times).not.toContain('09:00'); // Only P1
      expect(times).not.toContain('13:00'); // Only P2
    });
  });

  describe('minParticipants parameter', () => {
    const minPartCases: [number, number, string][] = [
      // [minParticipants, expectedSlots, description]
      [1, 10, 'minParticipants=1 gets all slots'],
      [2, 6, 'minParticipants=2 gets only overlap'],
      [3, 0, 'minParticipants=3 with 2 participants = no slots'],
    ];

    it.each(minPartCases)(
      'minParticipants=%d returns %d slots (%s)',
      (minParticipants, expectedSlots) => {
        const participantRules = new Map<string, AvailabilityRule[]>();

        // P1: Monday 9am-1pm UTC (8 slots)
        participantRules.set('p1', [
          createPatternRule('p1', 1, '09:00', '13:00', 'UTC'),
        ]);

        // P2: Monday 11am-3pm UTC (8 slots, overlap 11am-1pm = 4 slots)
        participantRules.set('p2', [
          createPatternRule('p2', 1, '11:00', '15:00', 'UTC'),
        ]);

        const overlapping = findOverlappingSlots(
          participantRules,
          { startDate: '2025-01-06', endDate: '2025-01-06' },
          minParticipants
        );

        expect(overlapping.length).toBe(expectedSlots);
      }
    );
  });

  describe('cross-timezone overlap', () => {
    it('finds overlap between LA evening and Manila morning', () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      // P1 in LA: Monday 6pm-10pm LA
      participantRules.set('p1', [
        createPatternRule('p1', 1, '18:00', '22:00', 'America/Los_Angeles'),
      ]);

      // P2 in Manila: Tuesday 10am-2pm Manila
      participantRules.set('p2', [
        createPatternRule('p2', 2, '10:00', '14:00', 'Asia/Manila'),
      ]);

      // Both convert to Tuesday 2am-6am UTC, so perfect overlap

      const overlapping = findOverlappingSlots(participantRules, {
        startDate: '2025-01-05',
        endDate: '2025-01-10',
      });

      // Should have 8 overlapping slots (4 hours * 2 slots/hour)
      expect(overlapping.length).toBe(8);

      // All should be on Tuesday UTC
      expect(overlapping.every(s => s.date === '2025-01-07')).toBe(true);

      // All should have both participants
      expect(overlapping.every(s => s.participantIds.length === 2)).toBe(true);
    });
  });
});

// ============================================================================
// findSessionSlots tests
// ============================================================================

describe('findSessionSlots matrix', () => {
  describe('session length requirements', () => {
    const sessionCases: [number, number, string][] = [
      // [sessionMinutes, expectedSessions, description]
      [30, 6, '30-min sessions (6 start positions)'],
      [60, 5, '60-min sessions (5 start positions)'],
      [120, 3, '120-min sessions (3 start positions)'],
      [180, 1, '180-min sessions (1 start position)'],
      [240, 0, '240-min sessions (not enough consecutive)'],
    ];

    it.each(sessionCases)(
      '%d-minute sessions: %d possible start times (%s)',
      (sessionMinutes, expectedSessions) => {
        const participantRules = new Map<string, AvailabilityRule[]>();

        // P1: Monday 9am-12pm UTC (3 hours = 6 slots)
        participantRules.set('p1', [
          createPatternRule('p1', 1, '09:00', '12:00', 'UTC'),
        ]);

        // P2: Monday 9am-12pm UTC (same, perfect overlap)
        participantRules.set('p2', [
          createPatternRule('p2', 1, '09:00', '12:00', 'UTC'),
        ]);

        const sessions = findSessionSlots(
          participantRules,
          { startDate: '2025-01-06', endDate: '2025-01-06' },
          sessionMinutes
        );

        expect(sessions.length).toBe(expectedSessions);
      }
    );
  });

  describe('non-consecutive slots', () => {
    it('gaps break consecutive slot chains', () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      // P1: Monday 9am-10am AND 11am-12pm (1 hour gap)
      participantRules.set('p1', [
        createPatternRule('p1', 1, '09:00', '10:00', 'UTC'),
        createPatternRule('p1', 1, '11:00', '12:00', 'UTC'),
      ]);

      // P2: Same availability
      participantRules.set('p2', [
        createPatternRule('p2', 1, '09:00', '10:00', 'UTC'),
        createPatternRule('p2', 1, '11:00', '12:00', 'UTC'),
      ]);

      // Try to find 90-minute sessions (requires 3 consecutive slots)
      const sessions = findSessionSlots(
        participantRules,
        { startDate: '2025-01-06', endDate: '2025-01-06' },
        90
      );

      // No 90-minute sessions possible due to the gap
      expect(sessions.length).toBe(0);

      // But 60-minute sessions should work in each block
      const hourSessions = findSessionSlots(
        participantRules,
        { startDate: '2025-01-06', endDate: '2025-01-06' },
        60
      );

      expect(hourSessions.length).toBe(2); // One in each 1-hour block
    });
  });

  describe('session slots across timezones', () => {
    it('finds 2-hour sessions with cross-timezone participants', () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      // P1 in LA: Monday 6pm-10pm LA (= Tuesday 2am-6am UTC)
      participantRules.set('p1', [
        createPatternRule('p1', 1, '18:00', '22:00', 'America/Los_Angeles'),
      ]);

      // P2 in Tokyo: Tuesday 11am-3pm Tokyo (= Tuesday 2am-6am UTC)
      participantRules.set('p2', [
        createPatternRule('p2', 2, '11:00', '15:00', 'Asia/Tokyo'),
      ]);

      // Perfect overlap in UTC

      const sessions = findSessionSlots(
        participantRules,
        { startDate: '2025-01-05', endDate: '2025-01-10' },
        120 // 2-hour sessions
      );

      // Should find 2-hour session slots
      expect(sessions.length).toBeGreaterThan(0);

      // All sessions should have both participants
      expect(sessions.every(s => s.participantIds.length === 2)).toBe(true);

      // Sessions should be on Tuesday UTC
      expect(sessions[0].date).toBe('2025-01-07');
    });
  });
});

// ============================================================================
// Multi-participant regression tests
// ============================================================================

describe('Multi-participant regression tests', () => {
  describe('three participants across 3 timezones', () => {
    it('finds overlap when all three have common window', () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      // P1 (LA): Monday 5pm-9pm LA = Tuesday 1am-5am UTC
      participantRules.set('p1', [
        createPatternRule('p1', 1, '17:00', '21:00', 'America/Los_Angeles'),
      ]);

      // P2 (London): Tuesday 1am-5am London = Tuesday 1am-5am UTC (winter)
      participantRules.set('p2', [
        createPatternRule('p2', 2, '01:00', '05:00', 'Europe/London'),
      ]);

      // P3 (Tokyo): Tuesday 10am-2pm Tokyo = Tuesday 1am-5am UTC
      participantRules.set('p3', [
        createPatternRule('p3', 2, '10:00', '14:00', 'Asia/Tokyo'),
      ]);

      const overlapping = findOverlappingSlots(participantRules, {
        startDate: '2025-01-05',
        endDate: '2025-01-10',
      });

      // All three should overlap on Tuesday 1am-5am UTC
      expect(overlapping.length).toBe(8); // 4 hours * 2 slots

      // Verify all have all three participants
      expect(overlapping.every(s => s.participantIds.length === 3)).toBe(true);
    });
  });

  describe('partial overlap with minParticipants', () => {
    it('finds slots where at least 2 of 3 participants are available', () => {
      const participantRules = new Map<string, AvailabilityRule[]>();

      // P1: Monday 9am-12pm UTC
      participantRules.set('p1', [
        createPatternRule('p1', 1, '09:00', '12:00', 'UTC'),
      ]);

      // P2: Monday 10am-1pm UTC (overlap with P1: 10am-12pm)
      participantRules.set('p2', [
        createPatternRule('p2', 1, '10:00', '13:00', 'UTC'),
      ]);

      // P3: Monday 11am-2pm UTC (overlap with P1: 11am-12pm, with P2: 11am-1pm)
      participantRules.set('p3', [
        createPatternRule('p3', 1, '11:00', '14:00', 'UTC'),
      ]);

      // With minParticipants=2, should get more slots than minParticipants=3
      const with2 = findOverlappingSlots(
        participantRules,
        { startDate: '2025-01-06', endDate: '2025-01-06' },
        2
      );

      const with3 = findOverlappingSlots(
        participantRules,
        { startDate: '2025-01-06', endDate: '2025-01-06' },
        3
      );

      expect(with2.length).toBeGreaterThan(with3.length);

      // 3-participant overlap should be 11am-12pm (2 slots)
      expect(with3.length).toBe(2);
      expect(with3.every(s => s.participantIds.length === 3)).toBe(true);
    });
  });
});

// ============================================================================
// Full day pattern aggregation
// ============================================================================

describe('Full day pattern aggregation', () => {
  it('full day patterns aggregate correctly in heatmap', () => {
    const participantRules = new Map<string, AvailabilityRule[]>();

    // P1: Monday all day UTC
    participantRules.set('p1', [
      createPatternRule('p1', 1, '00:00', '24:00', 'UTC'),
    ]);

    // P2: Monday 9am-5pm UTC
    participantRules.set('p2', [
      createPatternRule('p2', 1, '09:00', '17:00', 'UTC'),
    ]);

    const heatmap = computeHeatmap(participantRules, {
      startDate: '2025-01-06',
      endDate: '2025-01-06',
    });

    // During 9am-5pm: count should be 2
    expect(heatmap.get('2025-01-06|10:00')?.count).toBe(2);
    expect(heatmap.get('2025-01-06|12:00')?.count).toBe(2);

    // Outside 9am-5pm: count should be 1 (only P1)
    expect(heatmap.get('2025-01-06|08:00')?.count).toBe(1);
    expect(heatmap.get('2025-01-06|18:00')?.count).toBe(1);
  });

  it('cross-timezone full day still shows as 24 hours in heatmap', () => {
    const participantRules = new Map<string, AvailabilityRule[]>();

    // P1: Monday all day in LA
    participantRules.set('p1', [
      createPatternRule('p1', 1, '00:00', '24:00', 'America/Los_Angeles'),
    ]);

    const heatmap = computeHeatmap(participantRules, {
      startDate: '2025-01-06',
      endDate: '2025-01-08',
    });

    // Count total slots for P1
    let totalSlots = 0;
    for (const [, data] of heatmap) {
      if (data.participantIds.includes('p1')) {
        totalSlots++;
      }
    }

    // Should be exactly 48 slots (24 hours * 2 slots/hour)
    expect(totalSlots).toBe(48);
  });
});

// ============================================================================
// Overnight pattern aggregation
// ============================================================================

describe('Overnight pattern aggregation', () => {
  it('overnight patterns span dates correctly in heatmap', () => {
    const participantRules = new Map<string, AvailabilityRule[]>();

    // P1: Monday 10pm-2am UTC (overnight, spans Mon night to Tue morning)
    participantRules.set('p1', [
      createPatternRule('p1', 1, '22:00', '02:00', 'UTC'),
    ]);

    const heatmap = computeHeatmap(participantRules, {
      startDate: '2025-01-06', // Monday
      endDate: '2025-01-07',   // Tuesday
    });

    // Monday late night slots
    expect(heatmap.get('2025-01-06|22:00')?.count).toBe(1);
    expect(heatmap.get('2025-01-06|22:30')?.count).toBe(1);
    expect(heatmap.get('2025-01-06|23:00')?.count).toBe(1);
    expect(heatmap.get('2025-01-06|23:30')?.count).toBe(1);

    // Tuesday early morning slots (continuation of overnight)
    expect(heatmap.get('2025-01-07|00:00')?.count).toBe(1);
    expect(heatmap.get('2025-01-07|00:30')?.count).toBe(1);
    expect(heatmap.get('2025-01-07|01:00')?.count).toBe(1);
    expect(heatmap.get('2025-01-07|01:30')?.count).toBe(1);
  });
});
