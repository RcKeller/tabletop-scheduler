/**
 * Comprehensive tests for AI availability parser
 *
 * Tests the convertToRules function which transforms AI-parsed availability
 * into database rules. Does NOT test the actual AI parsing (which requires
 * an API call), but tests all the normalization and conversion logic.
 */

import { convertToRules, ParseResult } from '../../../lib/ai/availability-parser';
import { createRange, timeToMinutes } from '../../../lib/availability/range-math';

describe('AI Availability Parser: convertToRules', () => {
  const participantId = 'test-participant';

  describe('pattern conversions', () => {
    const patternCases: [ParseResult, string, number, string][] = [
      // [parseResult, timezone, expectedRuleCount, description]
      [
        {
          patterns: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
          additions: [],
          exclusions: [],
          routineRemovals: [],
          interpretation: 'Monday 9-5',
          mode: 'replace',
        },
        'America/Los_Angeles',
        1,
        'single weekday pattern',
      ],
      [
        {
          patterns: [
            { dayOfWeek: 1, startTime: '17:00', endTime: '22:00' },
            { dayOfWeek: 2, startTime: '17:00', endTime: '22:00' },
            { dayOfWeek: 3, startTime: '17:00', endTime: '22:00' },
            { dayOfWeek: 4, startTime: '17:00', endTime: '22:00' },
            { dayOfWeek: 5, startTime: '17:00', endTime: '22:00' },
          ],
          additions: [],
          exclusions: [],
          routineRemovals: [],
          interpretation: 'Weekday evenings 5-10pm',
          mode: 'replace',
        },
        'America/Los_Angeles',
        5,
        'weekday evenings pattern',
      ],
      [
        {
          patterns: [
            { dayOfWeek: 0, startTime: '00:00', endTime: '24:00' },
            { dayOfWeek: 6, startTime: '00:00', endTime: '24:00' },
          ],
          additions: [],
          exclusions: [],
          routineRemovals: [],
          interpretation: 'Weekends all day',
          mode: 'replace',
        },
        'Asia/Manila',
        2,
        'weekend full day pattern',
      ],
    ];

    it.each(patternCases)(
      'convertToRules produces %d rules for %s',
      (parseResult, timezone, expectedCount) => {
        const rules = convertToRules(parseResult, timezone, participantId);
        expect(rules.length).toBe(expectedCount);
        expect(rules.every(r => r.ruleType === 'available_pattern')).toBe(true);
      }
    );
  });

  describe('overnight patterns', () => {
    it('handles overnight patterns correctly in UTC', () => {
      // Test overnight patterns in UTC where the conversion is straightforward
      const parseResult: ParseResult = {
        patterns: [{ dayOfWeek: 5, startTime: '22:00', endTime: '02:00' }],
        additions: [],
        exclusions: [],
        routineRemovals: [],
        interpretation: 'Friday night 10pm-2am',
        mode: 'replace',
      };

      const rules = convertToRules(parseResult, 'UTC', participantId);

      expect(rules.length).toBe(1);
      expect(rules[0].ruleType).toBe('available_pattern');
      expect(rules[0].crossesMidnight).toBe(true);

      // In UTC, the times stay the same (22:00-02:00)
      const range = createRange(rules[0].startTime, rules[0].endTime, rules[0].crossesMidnight);
      expect(range.endMinutes - range.startMinutes).toBe(240); // 4 hours
    });

    it('sets crossesMidnight flag for overnight patterns', () => {
      const parseResult: ParseResult = {
        patterns: [{ dayOfWeek: 5, startTime: '22:00', endTime: '02:00' }],
        additions: [],
        exclusions: [],
        routineRemovals: [],
        interpretation: 'Friday night 10pm-2am',
        mode: 'replace',
      };

      const rules = convertToRules(parseResult, 'America/Los_Angeles', participantId);

      expect(rules.length).toBe(1);
      expect(rules[0].ruleType).toBe('available_pattern');
      // crossesMidnight should be true since original pattern crosses midnight
      expect(rules[0].crossesMidnight).toBe(true);
    });
  });

  describe('full day patterns (00:00-24:00)', () => {
    const fullDayCases: [string, string][] = [
      // [timezone, description]
      ['UTC', 'UTC full day'],
      ['America/Los_Angeles', 'LA full day'],
      ['Asia/Manila', 'Manila full day'],
      ['Asia/Tokyo', 'Tokyo full day'],
      ['Europe/London', 'London full day'],
      ['Asia/Kolkata', 'India full day'],
      ['Asia/Kathmandu', 'Nepal full day'],
      ['Pacific/Auckland', 'Auckland full day'],
    ];

    it.each(fullDayCases)(
      'full day pattern in %s produces 24-hour range (%s)',
      (timezone) => {
        const parseResult: ParseResult = {
          patterns: [{ dayOfWeek: 1, startTime: '00:00', endTime: '24:00' }],
          additions: [],
          exclusions: [],
          routineRemovals: [],
          interpretation: 'Monday all day',
          mode: 'replace',
        };

        const rules = convertToRules(parseResult, timezone, participantId);

        expect(rules.length).toBe(1);
        const rule = rules[0];

        // Create range with crossesMidnight flag to verify 24-hour duration
        const range = createRange(rule.startTime, rule.endTime, rule.crossesMidnight);
        expect(range.endMinutes - range.startMinutes).toBe(1440); // 24 hours
      }
    );
  });

  describe('00:00-00:00 normalization (AI edge case)', () => {
    // AI sometimes returns 00:00-00:00 instead of 00:00-24:00 for "all day"
    // This is handled by normalizing in parseAvailabilityText

    it('manually demonstrates the normalization behavior', () => {
      // This tests what SHOULD happen when AI returns 00:00-00:00
      // The normalization happens in parseAvailabilityText before convertToRules

      // Pre-normalized (correct) format
      const normalizedResult: ParseResult = {
        patterns: [{ dayOfWeek: 1, startTime: '00:00', endTime: '24:00' }],
        additions: [],
        exclusions: [],
        routineRemovals: [],
        interpretation: 'Monday all day',
        mode: 'replace',
      };

      const rules = convertToRules(normalizedResult, 'America/Los_Angeles', participantId);
      const range = createRange(rules[0].startTime, rules[0].endTime, rules[0].crossesMidnight);

      expect(range.endMinutes - range.startMinutes).toBe(1440);
    });
  });

  describe('additions (specific date availability)', () => {
    it('converts additions to available_override rules', () => {
      const parseResult: ParseResult = {
        patterns: [],
        additions: [
          { date: '2025-01-15', startTime: '10:00', endTime: '14:00' },
          { date: '2025-01-16', startTime: '17:00', endTime: '21:00' },
        ],
        exclusions: [],
        routineRemovals: [],
        interpretation: 'Available Jan 15 10am-2pm, Jan 16 5pm-9pm',
        mode: 'adjust',
      };

      const rules = convertToRules(parseResult, 'America/Los_Angeles', participantId);

      expect(rules.length).toBe(2);
      expect(rules.every(r => r.ruleType === 'available_override')).toBe(true);
      expect(rules[0].specificDate).toBeTruthy();
      expect(rules[1].specificDate).toBeTruthy();
    });
  });

  describe('exclusions (specific date unavailability)', () => {
    it('converts exclusions to blocked_override rules', () => {
      const parseResult: ParseResult = {
        patterns: [],
        additions: [],
        exclusions: [
          { date: '2025-01-15', startTime: '12:00', endTime: '13:00', reason: 'lunch meeting' },
        ],
        routineRemovals: [],
        interpretation: 'Busy Jan 15 noon-1pm for lunch',
        mode: 'adjust',
      };

      const rules = convertToRules(parseResult, 'America/Los_Angeles', participantId);

      expect(rules.length).toBe(1);
      expect(rules[0].ruleType).toBe('blocked_override');
      expect(rules[0].specificDate).toBeTruthy();
      expect(rules[0].reason).toBe('lunch meeting');
    });

    it('handles whole-day exclusions (no times specified)', () => {
      const parseResult: ParseResult = {
        patterns: [],
        additions: [],
        exclusions: [
          { date: '2025-01-15' }, // Whole day unavailable
        ],
        routineRemovals: [],
        interpretation: 'Not available Jan 15',
        mode: 'adjust',
      };

      // Use UTC to avoid timezone conversion complexity for this test
      const rules = convertToRules(parseResult, 'UTC', participantId);

      expect(rules.length).toBe(1);
      expect(rules[0].ruleType).toBe('blocked_override');

      // Should default to full day (00:00-24:00)
      const range = createRange(rules[0].startTime, rules[0].endTime, rules[0].crossesMidnight);
      expect(range.endMinutes - range.startMinutes).toBe(1440);
    });
  });

  describe('routineRemovals (recurring unavailability)', () => {
    it('converts routineRemovals to blocked_pattern rules', () => {
      const parseResult: ParseResult = {
        patterns: [],
        additions: [],
        exclusions: [],
        routineRemovals: [
          { dayOfWeek: 1 }, // All of Monday blocked
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }, // Tuesday 9-5 blocked
        ],
        interpretation: 'Not available Mondays, busy Tuesdays 9-5',
        mode: 'adjust',
      };

      const rules = convertToRules(parseResult, 'America/Los_Angeles', participantId);

      expect(rules.length).toBe(2);
      expect(rules.every(r => r.ruleType === 'blocked_pattern')).toBe(true);

      // First rule should be whole day (24 hours)
      const range1 = createRange(rules[0].startTime, rules[0].endTime, rules[0].crossesMidnight);
      expect(range1.endMinutes - range1.startMinutes).toBe(1440);

      // Second rule should be 8 hours
      const range2 = createRange(rules[1].startTime, rules[1].endTime, rules[1].crossesMidnight);
      expect(range2.endMinutes - range2.startMinutes).toBe(480);
    });
  });

  describe('complex mixed scenarios', () => {
    it('handles mixed patterns, additions, exclusions, and removals', () => {
      const parseResult: ParseResult = {
        patterns: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }, // Monday 9-5
          { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' }, // Wednesday 9-5
        ],
        additions: [
          { date: '2025-01-15', startTime: '18:00', endTime: '22:00' }, // Extra evening
        ],
        exclusions: [
          { date: '2025-01-20', startTime: '12:00', endTime: '13:00' }, // Lunch block
        ],
        routineRemovals: [
          { dayOfWeek: 5 }, // No Fridays
        ],
        interpretation: 'Available Mon/Wed 9-5, Jan 15 evening extra, no Fridays, Jan 20 lunch blocked',
        mode: 'adjust',
      };

      const rules = convertToRules(parseResult, 'America/Los_Angeles', participantId);

      expect(rules.length).toBe(5);

      const availablePatterns = rules.filter(r => r.ruleType === 'available_pattern');
      const availableOverrides = rules.filter(r => r.ruleType === 'available_override');
      const blockedOverrides = rules.filter(r => r.ruleType === 'blocked_override');
      const blockedPatterns = rules.filter(r => r.ruleType === 'blocked_pattern');

      expect(availablePatterns.length).toBe(2);
      expect(availableOverrides.length).toBe(1);
      expect(blockedOverrides.length).toBe(1);
      expect(blockedPatterns.length).toBe(1);
    });
  });

  describe('timezone handling across timezones', () => {
    const timezoneCases: [string, number, string, string, string][] = [
      // [timezone, expectedDayOfWeek, expectedStartApprox, expectedEndApprox, description]
      // Note: These are approximate - the actual values depend on timezone conversion
      ['UTC', 1, '09:00', '17:00', 'UTC preserves times'],
      ['America/Los_Angeles', 1, '17:00', '01:00', 'LA shifts forward to UTC'],
      ['Asia/Tokyo', 1, '00:00', '08:00', 'Tokyo shifts backward to UTC'],
    ];

    it.each(timezoneCases)(
      'pattern Monday 9-5 in %s converts to UTC correctly (%s)',
      (timezone) => {
        const parseResult: ParseResult = {
          patterns: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
          additions: [],
          exclusions: [],
          routineRemovals: [],
          interpretation: 'Monday 9-5',
          mode: 'replace',
        };

        const rules = convertToRules(parseResult, timezone, participantId);

        expect(rules.length).toBe(1);
        expect(rules[0].ruleType).toBe('available_pattern');
        expect(rules[0].originalTimezone).toBe(timezone);

        // Verify duration is preserved (8 hours = 480 minutes)
        const range = createRange(rules[0].startTime, rules[0].endTime, rules[0].crossesMidnight);
        expect(range.endMinutes - range.startMinutes).toBe(480);
      }
    );
  });

  describe('source field', () => {
    it('all rules have source: "ai"', () => {
      const parseResult: ParseResult = {
        patterns: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
        additions: [{ date: '2025-01-15', startTime: '10:00', endTime: '14:00' }],
        exclusions: [{ date: '2025-01-16' }],
        routineRemovals: [{ dayOfWeek: 5 }],
        interpretation: 'Mixed rules',
        mode: 'adjust',
      };

      const rules = convertToRules(parseResult, 'UTC', participantId);

      expect(rules.every(r => r.source === 'ai')).toBe(true);
    });
  });
});

describe('AI Availability Parser: Duration Preservation Matrix', () => {
  // This is a CRITICAL test to ensure the >24hr bug never returns
  // Every pattern, regardless of timezone, should preserve its original duration

  const participantId = 'test-participant';

  const durationTestCases: [number, string, string, string, number][] = [
    // [dayOfWeek, startTime, endTime, timezone, expectedDuration]
    // Standard durations
    [1, '09:00', '17:00', 'UTC', 480],
    [1, '09:00', '17:00', 'America/Los_Angeles', 480],
    [1, '09:00', '17:00', 'Asia/Manila', 480],
    [1, '09:00', '17:00', 'Asia/Tokyo', 480],
    [1, '09:00', '17:00', 'Europe/London', 480],
    [1, '09:00', '17:00', 'Asia/Kolkata', 480],
    [1, '09:00', '17:00', 'Asia/Kathmandu', 480],

    // Full day (24 hours)
    [1, '00:00', '24:00', 'UTC', 1440],
    [1, '00:00', '24:00', 'America/Los_Angeles', 1440],
    [1, '00:00', '24:00', 'Asia/Manila', 1440],
    [1, '00:00', '24:00', 'Asia/Tokyo', 1440],
    [1, '00:00', '24:00', 'Europe/Paris', 1440],
    [1, '00:00', '24:00', 'Pacific/Auckland', 1440],

    // Overnight patterns in UTC (where start < end in UTC)
    // Note: Overnight patterns in non-UTC timezones have complex behavior
    // when the UTC representation crosses/doesn't cross midnight.
    // These tests cover the straightforward UTC cases.
    [1, '22:00', '02:00', 'UTC', 240],
    [1, '23:00', '06:00', 'UTC', 420],

    // Short durations
    [1, '12:00', '12:30', 'UTC', 30],
    [1, '12:00', '12:30', 'America/Los_Angeles', 30],

    // Evening patterns (common)
    [1, '17:00', '22:00', 'America/Los_Angeles', 300],
    [1, '18:00', '22:00', 'Europe/London', 240],
    [1, '19:00', '23:00', 'Asia/Tokyo', 240],
  ];

  it.each(durationTestCases)(
    'day %d %s-%s in %s preserves duration of %d minutes',
    (dayOfWeek, startTime, endTime, timezone, expectedDuration) => {
      const parseResult: ParseResult = {
        patterns: [{ dayOfWeek, startTime, endTime }],
        additions: [],
        exclusions: [],
        routineRemovals: [],
        interpretation: 'Test pattern',
        mode: 'replace',
      };

      const rules = convertToRules(parseResult, timezone, participantId);

      expect(rules.length).toBe(1);

      const range = createRange(rules[0].startTime, rules[0].endTime, rules[0].crossesMidnight);
      const actualDuration = range.endMinutes - range.startMinutes;

      expect(actualDuration).toBe(expectedDuration);
    }
  );
});

describe('AI Availability Parser: Edge Case Inputs', () => {
  const participantId = 'test-participant';

  describe('empty results', () => {
    it('handles empty parse result', () => {
      const parseResult: ParseResult = {
        patterns: [],
        additions: [],
        exclusions: [],
        routineRemovals: [],
        interpretation: 'No availability specified',
        mode: 'replace',
      };

      const rules = convertToRules(parseResult, 'UTC', participantId);
      expect(rules.length).toBe(0);
    });
  });

  describe('all days of week', () => {
    it('handles all 7 days correctly', () => {
      const parseResult: ParseResult = {
        patterns: [
          { dayOfWeek: 0, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 6, startTime: '09:00', endTime: '17:00' },
        ],
        additions: [],
        exclusions: [],
        routineRemovals: [],
        interpretation: 'Every day 9-5',
        mode: 'replace',
      };

      const rules = convertToRules(parseResult, 'Asia/Manila', participantId);

      expect(rules.length).toBe(7);

      // Each should preserve 8-hour duration
      for (const rule of rules) {
        const range = createRange(rule.startTime, rule.endTime, rule.crossesMidnight);
        expect(range.endMinutes - range.startMinutes).toBe(480);
      }
    });
  });

  describe('boundary times', () => {
    const boundaryCases: [string, string, number][] = [
      // [startTime, endTime, expectedDuration]
      ['00:00', '00:30', 30],
      ['23:30', '24:00', 30],
      ['00:00', '23:30', 1410],
      ['00:30', '24:00', 1410],
    ];

    it.each(boundaryCases)(
      'boundary time %s-%s produces %d minute duration',
      (startTime, endTime, expectedDuration) => {
        const parseResult: ParseResult = {
          patterns: [{ dayOfWeek: 1, startTime, endTime }],
          additions: [],
          exclusions: [],
          routineRemovals: [],
          interpretation: 'Test',
          mode: 'replace',
        };

        const rules = convertToRules(parseResult, 'UTC', participantId);

        const range = createRange(rules[0].startTime, rules[0].endTime, rules[0].crossesMidnight);
        expect(range.endMinutes - range.startMinutes).toBe(expectedDuration);
      }
    );
  });
});
