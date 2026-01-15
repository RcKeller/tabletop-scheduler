/**
 * REGRESSION TESTS: AI Parser Bugs
 *
 * These tests cover edge cases in the AI availability parser that have
 * caused issues in production.
 */

import { convertToRules, ParseResult } from '../../lib/ai/availability-parser';
import { createRange, timeToMinutes } from '../../lib/availability/range-math';

const PARTICIPANT_ID = 'test-participant-123';

// ============================================================================
// REGRESSION: Full Day Parsing
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Full Day Parsing', () => {
  /**
   * BUG: "All day" or "anytime" would sometimes generate incorrect ranges
   * or not cover the full 24 hours.
   *
   * FIX: Standardized full day as "00:00-24:00" (1440 minutes)
   */

  it('anytime generates full day range', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 1, startTime: '00:00', endTime: '24:00' }],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Monday all day',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].startTime).toBe('00:00');
    expect(rules[0].endTime).toBe('24:00');

    // Should be exactly 24 hours
    const duration = timeToMinutes(rules[0].endTime) - timeToMinutes(rules[0].startTime);
    expect(duration).toBe(1440);
  });

  it('00:00-23:30 is NOT treated as full day', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 1, startTime: '00:00', endTime: '23:30' }],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Monday 00:00-23:30',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].endTime).toBe('23:30');

    // Should be 23.5 hours, not 24
    const duration = timeToMinutes(rules[0].endTime) - timeToMinutes(rules[0].startTime);
    expect(duration).toBe(1410);
  });
});

// ============================================================================
// REGRESSION: Overnight Pattern Parsing
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Overnight Pattern Parsing', () => {
  /**
   * BUG: Overnight patterns like "10pm-2am" were not parsed correctly.
   * Sometimes the end time would be on the wrong day.
   */

  it('overnight pattern has correct crossesMidnight flag', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 5, startTime: '22:00', endTime: '02:00' }],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Friday 10pm-2am',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].crossesMidnight).toBe(true);
    expect(rules[0].endTime).toBe('02:00');
  });

  it('late night non-overnight is not marked as overnight', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 5, startTime: '20:00', endTime: '23:30' }],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Friday 8pm-11:30pm',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].crossesMidnight).toBe(false);
  });
});

// ============================================================================
// REGRESSION: Specific Date Additions Handling
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Specific Date Additions Handling', () => {
  /**
   * BUG: Specific date mentions were sometimes incorrectly handled.
   */

  it('specific date creates available_override rule', () => {
    const parseResult: ParseResult = {
      patterns: [],
      additions: [{ date: '2025-01-08', startTime: '14:00', endTime: '18:00' }],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Jan 8 2-6pm',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].ruleType).toBe('available_override');
    expect(rules[0].specificDate).toBe('2025-01-08');
    expect(rules[0].startTime).toBe('14:00');
    expect(rules[0].endTime).toBe('18:00');
  });

  it('recurring day creates available_pattern rule', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 3, startTime: '14:00', endTime: '18:00' }],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Wednesday 2-6pm',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].ruleType).toBe('available_pattern');
    expect(rules[0].dayOfWeek).toBe(3);
  });
});

// ============================================================================
// REGRESSION: Exclusion/Blocked Handling
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Exclusion/Blocked Handling', () => {
  /**
   * BUG: "Not available" or "busy" markers were sometimes ignored or
   * not properly converting to blocked rules.
   */

  it('exclusion creates blocked_override rule', () => {
    const parseResult: ParseResult = {
      patterns: [],
      additions: [],
      exclusions: [{ date: '2025-01-09', startTime: '09:00', endTime: '17:00' }],
      routineRemovals: [],
      interpretation: 'Busy Jan 9 9-5',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].ruleType).toBe('blocked_override');
    expect(rules[0].specificDate).toBe('2025-01-09');
  });

  it('routine removal creates blocked_pattern rule', () => {
    const parseResult: ParseResult = {
      patterns: [],
      additions: [],
      exclusions: [],
      routineRemovals: [{ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }],
      interpretation: 'Not available Tuesday 9-5',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].ruleType).toBe('blocked_pattern');
    expect(rules[0].dayOfWeek).toBe(2);
  });

  it('whole day exclusion uses 00:00-24:00', () => {
    const parseResult: ParseResult = {
      patterns: [],
      additions: [],
      exclusions: [{ date: '2025-01-09', startTime: '00:00', endTime: '24:00' }],
      routineRemovals: [],
      interpretation: 'Busy all day Jan 9',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules[0].startTime).toBe('00:00');
    expect(rules[0].endTime).toBe('24:00');
  });
});

// ============================================================================
// REGRESSION: Timezone Conversion in Parser
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Timezone Conversion in Parser', () => {
  /**
   * BUG: When user's timezone was not UTC, parsed times were stored
   * incorrectly because conversion wasn't applied.
   */

  it('pattern times are converted to UTC', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Monday 9-5 LA time',
      mode: 'replace',
    };

    // User is in LA (UTC-8)
    const rules = convertToRules(parseResult, 'America/Los_Angeles', PARTICIPANT_ID);

    expect(rules.length).toBe(1);

    // 9am LA = 5pm UTC (17:00)
    expect(rules[0].startTime).toBe('17:00');
    // 5pm LA = 1am next day UTC
    expect(rules[0].endTime).toBe('01:00');
    expect(rules[0].crossesMidnight).toBe(true);
  });

  it('addition times are converted to UTC', () => {
    const parseResult: ParseResult = {
      patterns: [],
      additions: [{ date: '2025-01-08', startTime: '18:00', endTime: '22:00' }],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Jan 8 6-10pm LA time',
      mode: 'replace',
    };

    // User is in LA (UTC-8)
    const rules = convertToRules(parseResult, 'America/Los_Angeles', PARTICIPANT_ID);

    expect(rules[0].startTime).toBe('02:00');
    expect(rules[0].endTime).toBe('06:00');
    // Date shifts to next day
    expect(rules[0].specificDate).toBe('2025-01-09');
  });
});

// ============================================================================
// REGRESSION: Multiple Slots Same Day
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Multiple Slots Same Day', () => {
  /**
   * BUG: Multiple availability windows on the same day were sometimes
   * merged incorrectly or only one was saved.
   */

  it('multiple patterns on same day all preserved', () => {
    const parseResult: ParseResult = {
      patterns: [
        { dayOfWeek: 6, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 6, startTime: '14:00', endTime: '18:00' },
        { dayOfWeek: 6, startTime: '20:00', endTime: '23:00' },
      ],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Saturday morning, afternoon, evening',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    const saturdayPatterns = rules.filter(
      r => r.ruleType === 'available_pattern' && r.dayOfWeek === 6
    );
    expect(saturdayPatterns.length).toBe(3);

    const times = saturdayPatterns.map(p => `${p.startTime}-${p.endTime}`);
    expect(times).toContain('09:00-12:00');
    expect(times).toContain('14:00-18:00');
    expect(times).toContain('20:00-23:00');
  });

  it('pattern and routine removal on same day both preserved', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 3, startTime: '00:00', endTime: '24:00' }],
      additions: [],
      exclusions: [],
      routineRemovals: [{ dayOfWeek: 3, startTime: '12:00', endTime: '13:00' }],
      interpretation: 'Wednesday all day except lunch',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    const wedPatterns = rules.filter(r => r.dayOfWeek === 3);
    expect(wedPatterns.length).toBe(2);

    const available = wedPatterns.find(p => p.ruleType === 'available_pattern');
    const blocked = wedPatterns.find(p => p.ruleType === 'blocked_pattern');

    expect(available).toBeDefined();
    expect(blocked).toBeDefined();
    expect(blocked!.startTime).toBe('12:00');
    expect(blocked!.endTime).toBe('13:00');
  });
});

// ============================================================================
// REGRESSION: Empty/Invalid Input Handling
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Empty/Invalid Input Handling', () => {
  /**
   * BUG: Empty arrays or invalid slots could cause crashes.
   */

  it('empty parse result returns empty rules', () => {
    const parseResult: ParseResult = {
      patterns: [],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Nothing',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules).toEqual([]);
  });

  it('handles only patterns', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Monday only',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].ruleType).toBe('available_pattern');
  });

  it('handles only additions', () => {
    const parseResult: ParseResult = {
      patterns: [],
      additions: [{ date: '2025-01-08', startTime: '09:00', endTime: '17:00' }],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Just Jan 8',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    expect(rules[0].ruleType).toBe('available_override');
  });
});

// ============================================================================
// REGRESSION: Duration Preservation After Conversion
// Date: 2026-01-14
// ============================================================================

describe('REGRESSION: Duration Preservation After Conversion', () => {
  /**
   * BUG: Pattern duration was sometimes incorrect after timezone conversion
   * due to incorrect crossesMidnight handling.
   */

  it('8-hour work day preserved after conversion', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Monday 9-5',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'America/New_York', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    const range = createRange(
      rules[0].startTime,
      rules[0].endTime,
      rules[0].crossesMidnight
    );
    const duration = range.endMinutes - range.startMinutes;
    expect(duration).toBe(480); // 8 hours
  });

  it('4-hour overnight preserved after conversion', () => {
    const parseResult: ParseResult = {
      patterns: [{ dayOfWeek: 5, startTime: '22:00', endTime: '02:00' }],
      additions: [],
      exclusions: [],
      routineRemovals: [],
      interpretation: 'Friday 10pm-2am',
      mode: 'replace',
    };

    const rules = convertToRules(parseResult, 'UTC', PARTICIPANT_ID);

    expect(rules.length).toBe(1);
    const range = createRange(
      rules[0].startTime,
      rules[0].endTime,
      rules[0].crossesMidnight
    );
    const duration = range.endMinutes - range.startMinutes;
    expect(duration).toBe(240); // 4 hours
  });
});
