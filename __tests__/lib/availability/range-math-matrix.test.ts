/**
 * Comprehensive matrix tests for range-math utilities
 *
 * Uses jest.each to test all edge cases and ensure the crossesMidnight fix
 * never regresses.
 */

import {
  createRange,
  timeToMinutes,
  minutesToTime,
  rangesOverlap,
  rangesAdjacent,
  mergeTwo,
  mergeRanges,
  subtractOne,
  intersectTwo,
  rangesToSlots,
} from '../../../lib/availability/range-math';
import type { TimeRange } from '../../../lib/types/availability';

describe('createRange with crossesMidnight flag - CRITICAL REGRESSION TESTS', () => {
  describe('crossesMidnight=true always adds 1440 minutes', () => {
    // These tests prevent the >24hr bug where timezone conversion
    // produces inverted times that should NOT be treated as overnight

    const overnightCases: [string, string, number][] = [
      // [startTime, endTime, expectedDuration]
      ['22:00', '02:00', 240],  // 10pm-2am = 4 hours
      ['23:00', '01:00', 120],  // 11pm-1am = 2 hours
      ['21:00', '06:00', 540],  // 9pm-6am = 9 hours
      ['20:00', '08:00', 720],  // 8pm-8am = 12 hours
      ['18:00', '06:00', 720],  // 6pm-6am = 12 hours
      ['23:30', '00:30', 60],   // 11:30pm-12:30am = 1 hour
      ['00:00', '00:00', 1440], // Midnight to midnight = 24 hours
      ['08:00', '08:00', 1440], // Any same time with crossesMidnight = 24 hours
      ['12:00', '12:00', 1440], // Noon to noon with crossesMidnight = 24 hours
      ['15:30', '15:30', 1440], // 3:30pm to 3:30pm = 24 hours
    ];

    it.each(overnightCases)(
      'createRange(%s, %s, true) = %d minutes',
      (startTime, endTime, expectedDuration) => {
        const range = createRange(startTime, endTime, true);
        expect(range.endMinutes - range.startMinutes).toBe(expectedDuration);
      }
    );
  });

  describe('crossesMidnight=false never adds 1440 minutes', () => {
    // This is the key fix: even if times look inverted (e.g., "16:00"-"15:30"
    // from timezone conversion), crossesMidnight=false means same-day range

    const sameDayCases: [string, string, number][] = [
      // [startTime, endTime, expectedDuration]
      // Normal same-day ranges
      ['09:00', '17:00', 480],   // 9am-5pm = 8 hours
      ['00:00', '12:00', 720],   // Midnight-noon = 12 hours
      ['06:00', '22:00', 960],   // 6am-10pm = 16 hours
      ['00:00', '23:30', 1410],  // Nearly full day
      ['00:00', '24:00', 1440],  // Full day with "24:00" = 24 hours

      // CRITICAL: Inverted times from timezone conversion should NOT add 1440
      // These simulate what happens when Manila 00:00-23:30 converts to UTC
      ['16:00', '15:30', -30],   // Would be 23.5hr if wrong, should be -30min (handled as 0 or clamped)
      ['20:00', '08:00', -720],  // Would be 12hr if wrong, should be negative
      ['23:00', '01:00', -1320], // Would be 2hr if wrong, should be negative
    ];

    it.each(sameDayCases)(
      'createRange(%s, %s, false) preserves same-day semantics',
      (startTime, endTime, expectedDuration) => {
        const range = createRange(startTime, endTime, false);
        const actualDuration = range.endMinutes - range.startMinutes;
        // For same-day ranges, even negative durations are possible
        // (the calling code should handle these cases)
        expect(actualDuration).toBe(expectedDuration);
      }
    );
  });

  describe('crossesMidnight=undefined (legacy inference)', () => {
    // Legacy behavior for backward compatibility

    const legacyCases: [string, string, number, string][] = [
      // [startTime, endTime, expectedDuration, description]
      ['09:00', '17:00', 480, 'normal daytime'],
      ['22:00', '02:00', 240, 'overnight inferred'],
      ['00:00', '00:00', 1440, 'midnight to midnight = full day'],
      ['12:00', '12:00', 0, 'same non-midnight time = 0'],
    ];

    it.each(legacyCases)(
      'createRange(%s, %s) with undefined crossesMidnight = %d (%s)',
      (startTime, endTime, expectedDuration) => {
        const range = createRange(startTime, endTime, undefined);
        expect(range.endMinutes - range.startMinutes).toBe(expectedDuration);
      }
    );
  });

  describe('special "24:00" handling', () => {
    const cases24: [string, string, boolean | undefined, number][] = [
      // [startTime, endTime, crossesMidnight, expectedDuration]
      ['00:00', '24:00', false, 1440],     // Full day explicit
      ['00:00', '24:00', undefined, 1440], // Full day legacy
      ['06:00', '24:00', false, 1080],     // 6am to end of day
      ['18:00', '24:00', false, 360],      // 6pm to end of day
      ['12:00', '24:00', false, 720],      // Noon to end of day
      ['23:30', '24:00', false, 30],       // Last slot
    ];

    it.each(cases24)(
      'createRange(%s, %s, %s) = %d minutes',
      (startTime, endTime, crossesMidnight, expectedDuration) => {
        const range = createRange(startTime, endTime, crossesMidnight);
        expect(range.endMinutes - range.startMinutes).toBe(expectedDuration);
      }
    );
  });
});

describe('timeToMinutes matrix', () => {
  const cases: [string, number][] = [
    ['00:00', 0],
    ['00:30', 30],
    ['01:00', 60],
    ['06:00', 360],
    ['09:00', 540],
    ['12:00', 720],
    ['12:30', 750],
    ['15:45', 945],
    ['18:00', 1080],
    ['21:00', 1260],
    ['23:00', 1380],
    ['23:30', 1410],
    ['23:59', 1439],
  ];

  it.each(cases)('timeToMinutes(%s) = %d', (time, expected) => {
    expect(timeToMinutes(time)).toBe(expected);
  });
});

describe('minutesToTime matrix', () => {
  const cases: [number, string][] = [
    [0, '00:00'],
    [30, '00:30'],
    [60, '01:00'],
    [360, '06:00'],
    [540, '09:00'],
    [720, '12:00'],
    [1080, '18:00'],
    [1380, '23:00'],
    [1410, '23:30'],
    // Wrapping cases
    [1440, '00:00'],
    [1500, '01:00'],
    [2880, '00:00'],
    // Negative wrapping
    [-60, '23:00'],
    [-1440, '00:00'],
  ];

  it.each(cases)('minutesToTime(%d) = %s', (minutes, expected) => {
    expect(minutesToTime(minutes)).toBe(expected);
  });
});

describe('rangesOverlap matrix', () => {
  const cases: [TimeRange, TimeRange, boolean, string][] = [
    // [rangeA, rangeB, expected, description]
    [{ startMinutes: 540, endMinutes: 720 }, { startMinutes: 600, endMinutes: 840 }, true, 'partial overlap'],
    [{ startMinutes: 540, endMinutes: 720 }, { startMinutes: 540, endMinutes: 720 }, true, 'identical'],
    [{ startMinutes: 540, endMinutes: 1020 }, { startMinutes: 600, endMinutes: 720 }, true, 'B contained in A'],
    [{ startMinutes: 600, endMinutes: 720 }, { startMinutes: 540, endMinutes: 1020 }, true, 'A contained in B'],
    [{ startMinutes: 540, endMinutes: 600 }, { startMinutes: 600, endMinutes: 720 }, false, 'adjacent not overlapping'],
    [{ startMinutes: 540, endMinutes: 600 }, { startMinutes: 720, endMinutes: 840 }, false, 'gap between'],
    [{ startMinutes: 0, endMinutes: 1440 }, { startMinutes: 540, endMinutes: 720 }, true, 'full day overlaps anything'],
  ];

  it.each(cases)(
    'rangesOverlap(%j, %j) = %s (%s)',
    (a, b, expected) => {
      expect(rangesOverlap(a, b)).toBe(expected);
    }
  );
});

describe('rangesAdjacent matrix', () => {
  const cases: [TimeRange, TimeRange, boolean, string][] = [
    [{ startMinutes: 540, endMinutes: 600 }, { startMinutes: 600, endMinutes: 720 }, true, 'A then B'],
    [{ startMinutes: 600, endMinutes: 720 }, { startMinutes: 540, endMinutes: 600 }, true, 'B then A'],
    [{ startMinutes: 540, endMinutes: 600 }, { startMinutes: 660, endMinutes: 720 }, false, 'gap'],
    [{ startMinutes: 540, endMinutes: 660 }, { startMinutes: 600, endMinutes: 720 }, false, 'overlapping'],
  ];

  it.each(cases)(
    'rangesAdjacent(%j, %j) = %s (%s)',
    (a, b, expected) => {
      expect(rangesAdjacent(a, b)).toBe(expected);
    }
  );
});

describe('mergeTwo matrix', () => {
  const cases: [TimeRange, TimeRange, TimeRange | null, string][] = [
    // Overlapping
    [
      { startMinutes: 540, endMinutes: 720 },
      { startMinutes: 600, endMinutes: 840 },
      { startMinutes: 540, endMinutes: 840 },
      'overlapping merge',
    ],
    // Adjacent
    [
      { startMinutes: 540, endMinutes: 600 },
      { startMinutes: 600, endMinutes: 720 },
      { startMinutes: 540, endMinutes: 720 },
      'adjacent merge',
    ],
    // Non-overlapping
    [
      { startMinutes: 540, endMinutes: 600 },
      { startMinutes: 720, endMinutes: 840 },
      null,
      'gap returns null',
    ],
    // Contained
    [
      { startMinutes: 540, endMinutes: 1020 },
      { startMinutes: 600, endMinutes: 720 },
      { startMinutes: 540, endMinutes: 1020 },
      'contained returns outer',
    ],
  ];

  it.each(cases)(
    'mergeTwo(%j, %j) = %j (%s)',
    (a, b, expected) => {
      expect(mergeTwo(a, b)).toEqual(expected);
    }
  );
});

describe('mergeRanges matrix', () => {
  const cases: [TimeRange[], TimeRange[], string][] = [
    // Empty
    [[], [], 'empty input'],
    // Single
    [[{ startMinutes: 540, endMinutes: 720 }], [{ startMinutes: 540, endMinutes: 720 }], 'single range'],
    // Overlapping pair
    [
      [{ startMinutes: 540, endMinutes: 720 }, { startMinutes: 600, endMinutes: 840 }],
      [{ startMinutes: 540, endMinutes: 840 }],
      'overlapping pair merged',
    ],
    // Non-overlapping
    [
      [{ startMinutes: 540, endMinutes: 600 }, { startMinutes: 720, endMinutes: 840 }],
      [{ startMinutes: 540, endMinutes: 600 }, { startMinutes: 720, endMinutes: 840 }],
      'non-overlapping kept separate',
    ],
    // Chain merge
    [
      [
        { startMinutes: 540, endMinutes: 600 },
        { startMinutes: 580, endMinutes: 700 },
        { startMinutes: 650, endMinutes: 800 },
      ],
      [{ startMinutes: 540, endMinutes: 800 }],
      'chain of overlapping merged',
    ],
    // Unsorted input
    [
      [
        { startMinutes: 720, endMinutes: 840 },
        { startMinutes: 540, endMinutes: 600 },
        { startMinutes: 580, endMinutes: 750 },
      ],
      [{ startMinutes: 540, endMinutes: 840 }],
      'unsorted input merged',
    ],
  ];

  it.each(cases)(
    'mergeRanges(%j) = %j (%s)',
    (input, expected) => {
      expect(mergeRanges(input)).toEqual(expected);
    }
  );
});

describe('subtractOne matrix', () => {
  const cases: [TimeRange, TimeRange, TimeRange[], string][] = [
    // No overlap
    [
      { startMinutes: 540, endMinutes: 720 },
      { startMinutes: 840, endMinutes: 960 },
      [{ startMinutes: 540, endMinutes: 720 }],
      'no overlap returns original',
    ],
    // Remove middle
    [
      { startMinutes: 540, endMinutes: 840 },
      { startMinutes: 600, endMinutes: 720 },
      [{ startMinutes: 540, endMinutes: 600 }, { startMinutes: 720, endMinutes: 840 }],
      'middle removed creates two ranges',
    ],
    // Remove start
    [
      { startMinutes: 540, endMinutes: 720 },
      { startMinutes: 500, endMinutes: 600 },
      [{ startMinutes: 600, endMinutes: 720 }],
      'start removed',
    ],
    // Remove end
    [
      { startMinutes: 540, endMinutes: 720 },
      { startMinutes: 660, endMinutes: 800 },
      [{ startMinutes: 540, endMinutes: 660 }],
      'end removed',
    ],
    // Fully contained
    [
      { startMinutes: 600, endMinutes: 720 },
      { startMinutes: 540, endMinutes: 840 },
      [],
      'fully contained returns empty',
    ],
  ];

  it.each(cases)(
    'subtractOne(%j, %j) = %j (%s)',
    (a, b, expected) => {
      expect(subtractOne(a, b)).toEqual(expected);
    }
  );
});

describe('intersectTwo matrix', () => {
  const cases: [TimeRange, TimeRange, TimeRange | null, string][] = [
    // Overlapping
    [
      { startMinutes: 540, endMinutes: 720 },
      { startMinutes: 600, endMinutes: 840 },
      { startMinutes: 600, endMinutes: 720 },
      'partial overlap',
    ],
    // Identical
    [
      { startMinutes: 540, endMinutes: 720 },
      { startMinutes: 540, endMinutes: 720 },
      { startMinutes: 540, endMinutes: 720 },
      'identical ranges',
    ],
    // Contained
    [
      { startMinutes: 540, endMinutes: 1020 },
      { startMinutes: 600, endMinutes: 720 },
      { startMinutes: 600, endMinutes: 720 },
      'inner contained',
    ],
    // No overlap
    [
      { startMinutes: 540, endMinutes: 600 },
      { startMinutes: 720, endMinutes: 840 },
      null,
      'no overlap',
    ],
    // Adjacent (no overlap)
    [
      { startMinutes: 540, endMinutes: 600 },
      { startMinutes: 600, endMinutes: 720 },
      null,
      'adjacent not overlapping',
    ],
  ];

  it.each(cases)(
    'intersectTwo(%j, %j) = %j (%s)',
    (a, b, expected) => {
      expect(intersectTwo(a, b)).toEqual(expected);
    }
  );
});

describe('rangesToSlots matrix', () => {
  const cases: [TimeRange[], string, number, string][] = [
    // [ranges, date, expectedSlotCount, description]
    [[{ startMinutes: 540, endMinutes: 660 }], '2024-01-15', 4, '2-hour range = 4 slots'],
    [[{ startMinutes: 540, endMinutes: 570 }], '2024-01-15', 1, '30-min range = 1 slot'],
    [[{ startMinutes: 0, endMinutes: 1440 }], '2024-01-15', 48, 'full day = 48 slots'],
    // Overnight
    [[{ startMinutes: 1380, endMinutes: 1500 }], '2024-01-15', 4, 'overnight range spans dates'],
  ];

  it.each(cases)(
    'rangesToSlots(%j, %s) produces %d slots (%s)',
    (ranges, date, expectedCount) => {
      const slots = rangesToSlots(ranges, date);
      expect(slots.length).toBe(expectedCount);
    }
  );

  it('overnight slots have correct dates', () => {
    const ranges: TimeRange[] = [{ startMinutes: 1410, endMinutes: 1500 }]; // 23:30 to 01:00
    const slots = rangesToSlots(ranges, '2024-01-15');

    expect(slots).toContainEqual({ date: '2024-01-15', time: '23:30' });
    expect(slots).toContainEqual({ date: '2024-01-16', time: '00:00' });
    expect(slots).toContainEqual({ date: '2024-01-16', time: '00:30' });
  });
});
