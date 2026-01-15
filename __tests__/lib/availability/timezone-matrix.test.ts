/**
 * Comprehensive timezone conversion matrix tests
 *
 * Tests ALL timezone edge cases to ensure availability never regresses.
 * Covers:
 * - All major timezone offsets (negative, zero, positive)
 * - Fractional offsets (India +5:30, Nepal +5:45, etc.)
 * - Extreme timezones (Pago Pago UTC-11, Kiritimati UTC+14)
 * - Day-of-week transitions
 * - Pattern conversions (recurring availability)
 * - Override conversions (specific date availability)
 */

import {
  localToUTC,
  utcToLocal,
  convertPatternToUTC,
  convertPatternFromUTC,
  convertOverrideToUTC,
  convertOverrideFromUTC,
  convertPatternBetweenTimezones,
  getUTCDayOfWeek,
  getDateRange,
} from '../../../lib/availability/timezone';
import { createRange, timeToMinutes } from '../../../lib/availability/range-math';

// ============================================================================
// TEST TIMEZONES - covers all major offset types
// ============================================================================

const TIMEZONES = {
  // Negative offsets (behind UTC)
  'Pacific/Pago_Pago': -11,      // UTC-11 (most behind)
  'Pacific/Honolulu': -10,       // UTC-10 (Hawaii)
  'America/Anchorage': -9,       // UTC-9 (Alaska)
  'America/Los_Angeles': -8,     // UTC-8 (Pacific)
  'America/Denver': -7,          // UTC-7 (Mountain)
  'America/Chicago': -6,         // UTC-6 (Central)
  'America/Cancun': -5,          // UTC-5 (no DST)
  'America/New_York': -5,        // UTC-5 (Eastern, winter)
  'America/Sao_Paulo': -3,       // UTC-3 (Brazil)

  // Zero offset
  'UTC': 0,
  'Europe/London': 0,            // UTC+0 (winter)

  // Positive offsets (ahead of UTC)
  'Europe/Paris': 1,             // UTC+1 (winter)
  'Europe/Berlin': 1,            // UTC+1 (winter)
  'Africa/Cairo': 2,             // UTC+2
  'Europe/Moscow': 3,            // UTC+3
  'Asia/Dubai': 4,               // UTC+4

  // Fractional offsets
  'Asia/Kolkata': 5.5,           // UTC+5:30 (India)
  'Asia/Kathmandu': 5.75,        // UTC+5:45 (Nepal)

  // More positive offsets
  'Asia/Bangkok': 7,             // UTC+7
  'Asia/Manila': 8,              // UTC+8 (Philippines)
  'Asia/Shanghai': 8,            // UTC+8 (China)
  'Asia/Tokyo': 9,               // UTC+9 (Japan)
  'Australia/Sydney': 11,        // UTC+11 (summer)
  'Pacific/Auckland': 13,        // UTC+13 (summer)
  'Pacific/Kiritimati': 14,      // UTC+14 (most ahead)
} as const;

// ============================================================================
// localToUTC TESTS
// ============================================================================

describe('localToUTC matrix', () => {
  describe('simple conversions - no date change', () => {
    const cases: [string, string, string, string, string, string][] = [
      // [time, date, timezone, expectedTime, expectedDate, description]
      ['12:00', '2024-01-15', 'UTC', '12:00', '2024-01-15', 'UTC unchanged'],
      ['12:00', '2024-01-15', 'America/Los_Angeles', '20:00', '2024-01-15', 'LA noon = UTC 8pm same day'],
      ['08:00', '2024-01-15', 'America/New_York', '13:00', '2024-01-15', 'NYC 8am = UTC 1pm same day'],
      ['12:00', '2024-01-15', 'Europe/London', '12:00', '2024-01-15', 'London noon = UTC noon'],
      ['18:00', '2024-01-15', 'Asia/Tokyo', '09:00', '2024-01-15', 'Tokyo 6pm = UTC 9am same day'],
    ];

    it.each(cases)(
      'localToUTC(%s, %s, %s) = {time: %s, date: %s} (%s)',
      (time, date, tz, expectedTime, expectedDate) => {
        const result = localToUTC(time, date, tz);
        expect(result.time).toBe(expectedTime);
        expect(result.date).toBe(expectedDate);
      }
    );
  });

  describe('conversions with date change - forward', () => {
    // Times that push to the next day in UTC
    const cases: [string, string, string, string, string, string][] = [
      ['17:00', '2024-01-15', 'America/Los_Angeles', '01:00', '2024-01-16', 'LA 5pm = UTC 1am next day'],
      ['20:00', '2024-01-15', 'America/Los_Angeles', '04:00', '2024-01-16', 'LA 8pm = UTC 4am next day'],
      ['23:00', '2024-01-15', 'America/New_York', '04:00', '2024-01-16', 'NYC 11pm = UTC 4am next day'],
      ['21:00', '2024-01-15', 'America/Chicago', '03:00', '2024-01-16', 'Chicago 9pm = UTC 3am next day'],
    ];

    it.each(cases)(
      'localToUTC(%s, %s, %s) = {time: %s, date: %s} (%s)',
      (time, date, tz, expectedTime, expectedDate) => {
        const result = localToUTC(time, date, tz);
        expect(result.time).toBe(expectedTime);
        expect(result.date).toBe(expectedDate);
      }
    );
  });

  describe('conversions with date change - backward', () => {
    // Times that go to the previous day in UTC
    const cases: [string, string, string, string, string, string][] = [
      ['01:00', '2024-01-15', 'Asia/Tokyo', '16:00', '2024-01-14', 'Tokyo 1am = UTC 4pm prev day'],
      ['07:00', '2024-01-15', 'Asia/Manila', '23:00', '2024-01-14', 'Manila 7am = UTC 11pm prev day'],
      ['05:00', '2024-01-15', 'Asia/Shanghai', '21:00', '2024-01-14', 'Shanghai 5am = UTC 9pm prev day'],
      ['03:00', '2024-01-15', 'Europe/Paris', '02:00', '2024-01-15', 'Paris 3am = UTC 2am same day'],
    ];

    it.each(cases)(
      'localToUTC(%s, %s, %s) = {time: %s, date: %s} (%s)',
      (time, date, tz, expectedTime, expectedDate) => {
        const result = localToUTC(time, date, tz);
        expect(result.time).toBe(expectedTime);
        expect(result.date).toBe(expectedDate);
      }
    );
  });

  describe('fractional timezone conversions', () => {
    const cases: [string, string, string, string, string, string][] = [
      ['09:00', '2024-01-15', 'Asia/Kolkata', '03:30', '2024-01-15', 'India 9am = UTC 3:30am'],
      ['12:00', '2024-01-15', 'Asia/Kolkata', '06:30', '2024-01-15', 'India noon = UTC 6:30am'],
      ['03:15', '2024-01-15', 'Asia/Kolkata', '21:45', '2024-01-14', 'India 3:15am = UTC 9:45pm prev day'],
      ['09:00', '2024-01-15', 'Asia/Kathmandu', '03:15', '2024-01-15', 'Nepal 9am = UTC 3:15am'],
      ['05:45', '2024-01-15', 'Asia/Kathmandu', '00:00', '2024-01-15', 'Nepal 5:45am = UTC midnight'],
    ];

    it.each(cases)(
      'localToUTC(%s, %s, %s) = {time: %s, date: %s} (%s)',
      (time, date, tz, expectedTime, expectedDate) => {
        const result = localToUTC(time, date, tz);
        expect(result.time).toBe(expectedTime);
        expect(result.date).toBe(expectedDate);
      }
    );
  });

  describe('24:00 handling', () => {
    const cases: [string, string, string, string, string, string][] = [
      ['24:00', '2024-01-15', 'UTC', '00:00', '2024-01-16', 'UTC 24:00 = next day 00:00'],
      ['24:00', '2024-01-15', 'America/Los_Angeles', '08:00', '2024-01-16', 'LA 24:00 = UTC 8am next day'],
      ['24:00', '2024-01-15', 'Asia/Tokyo', '15:00', '2024-01-15', 'Tokyo 24:00 = UTC 3pm same day'],
    ];

    it.each(cases)(
      'localToUTC(%s, %s, %s) = {time: %s, date: %s} (%s)',
      (time, date, tz, expectedTime, expectedDate) => {
        const result = localToUTC(time, date, tz);
        expect(result.time).toBe(expectedTime);
        expect(result.date).toBe(expectedDate);
      }
    );
  });
});

// ============================================================================
// utcToLocal TESTS
// ============================================================================

describe('utcToLocal matrix', () => {
  describe('simple conversions - no date change', () => {
    const cases: [string, string, string, string, string, string][] = [
      ['12:00', '2024-01-15', 'UTC', '12:00', '2024-01-15', 'UTC unchanged'],
      ['20:00', '2024-01-15', 'America/Los_Angeles', '12:00', '2024-01-15', 'UTC 8pm = LA noon same day'],
      ['18:00', '2024-01-15', 'Europe/Paris', '19:00', '2024-01-15', 'UTC 6pm = Paris 7pm same day'],
    ];

    it.each(cases)(
      'utcToLocal(%s, %s, %s) = {time: %s, date: %s} (%s)',
      (time, date, tz, expectedTime, expectedDate) => {
        const result = utcToLocal(time, date, tz);
        expect(result.time).toBe(expectedTime);
        expect(result.date).toBe(expectedDate);
      }
    );
  });

  describe('conversions with date change - forward (Asia/Pacific)', () => {
    const cases: [string, string, string, string, string, string][] = [
      ['16:00', '2024-01-14', 'Asia/Tokyo', '01:00', '2024-01-15', 'UTC 4pm = Tokyo 1am next day'],
      ['23:00', '2024-01-14', 'Asia/Manila', '07:00', '2024-01-15', 'UTC 11pm = Manila 7am next day'],
      ['15:00', '2024-01-14', 'Pacific/Auckland', '04:00', '2024-01-15', 'UTC 3pm = Auckland 4am next day'],
    ];

    it.each(cases)(
      'utcToLocal(%s, %s, %s) = {time: %s, date: %s} (%s)',
      (time, date, tz, expectedTime, expectedDate) => {
        const result = utcToLocal(time, date, tz);
        expect(result.time).toBe(expectedTime);
        expect(result.date).toBe(expectedDate);
      }
    );
  });

  describe('conversions with date change - backward (Americas)', () => {
    const cases: [string, string, string, string, string, string][] = [
      ['01:00', '2024-01-16', 'America/Los_Angeles', '17:00', '2024-01-15', 'UTC 1am = LA 5pm prev day'],
      ['04:00', '2024-01-16', 'America/New_York', '23:00', '2024-01-15', 'UTC 4am = NYC 11pm prev day'],
      ['03:00', '2024-01-16', 'America/Chicago', '21:00', '2024-01-15', 'UTC 3am = Chicago 9pm prev day'],
    ];

    it.each(cases)(
      'utcToLocal(%s, %s, %s) = {time: %s, date: %s} (%s)',
      (time, date, tz, expectedTime, expectedDate) => {
        const result = utcToLocal(time, date, tz);
        expect(result.time).toBe(expectedTime);
        expect(result.date).toBe(expectedDate);
      }
    );
  });

  describe('fractional timezone conversions', () => {
    const cases: [string, string, string, string, string, string][] = [
      ['03:30', '2024-01-15', 'Asia/Kolkata', '09:00', '2024-01-15', 'UTC 3:30am = India 9am'],
      ['21:45', '2024-01-14', 'Asia/Kolkata', '03:15', '2024-01-15', 'UTC 9:45pm = India 3:15am next day'],
      ['03:15', '2024-01-15', 'Asia/Kathmandu', '09:00', '2024-01-15', 'UTC 3:15am = Nepal 9am'],
    ];

    it.each(cases)(
      'utcToLocal(%s, %s, %s) = {time: %s, date: %s} (%s)',
      (time, date, tz, expectedTime, expectedDate) => {
        const result = utcToLocal(time, date, tz);
        expect(result.time).toBe(expectedTime);
        expect(result.date).toBe(expectedDate);
      }
    );
  });
});

// ============================================================================
// convertPatternToUTC TESTS
// ============================================================================

describe('convertPatternToUTC matrix', () => {
  describe('same day conversions', () => {
    // Patterns that don't change day of week when converted
    const cases: [number, string, string, string, number, string, string, boolean, string][] = [
      // [localDay, startTime, endTime, timezone, expectedDay, expectedStart, expectedEnd, expectedCrossesMidnight, description]
      [1, '09:00', '17:00', 'UTC', 1, '09:00', '17:00', false, 'UTC unchanged'],
      [1, '10:00', '14:00', 'America/Los_Angeles', 1, '18:00', '22:00', false, 'LA daytime stays Monday'],
      [1, '12:00', '16:00', 'Europe/Paris', 1, '11:00', '15:00', false, 'Paris daytime stays Monday'],
      [3, '10:00', '18:00', 'Asia/Tokyo', 3, '01:00', '09:00', false, 'Tokyo daytime stays Wednesday'],
    ];

    it.each(cases)(
      'convertPatternToUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s, crossesMidnight: %s} (%s)',
      (localDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd, expectedCrossesMidnight) => {
        const result = convertPatternToUTC(localDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
        expect(result.crossesMidnight).toBe(expectedCrossesMidnight);
      }
    );
  });

  describe('day shift forward (Americas evening → UTC next day)', () => {
    const cases: [number, string, string, string, number, string, string, boolean, string][] = [
      [1, '18:00', '22:00', 'America/Los_Angeles', 2, '02:00', '06:00', false, 'LA Monday evening = UTC Tuesday morning'],
      [5, '21:00', '23:00', 'America/New_York', 6, '02:00', '04:00', false, 'NYC Friday night = UTC Saturday morning'],
      [6, '20:00', '23:00', 'America/Chicago', 0, '02:00', '05:00', false, 'Chicago Saturday night = UTC Sunday morning'],
    ];

    it.each(cases)(
      'convertPatternToUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s, crossesMidnight: %s} (%s)',
      (localDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd, expectedCrossesMidnight) => {
        const result = convertPatternToUTC(localDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
        expect(result.crossesMidnight).toBe(expectedCrossesMidnight);
      }
    );
  });

  describe('day shift backward (Asia morning → UTC previous day)', () => {
    // Note: crossesMidnight is set to true when UTC times span midnight,
    // even if the original local times didn't
    const cases: [number, string, string, string, number, string, string, boolean, string][] = [
      [1, '01:00', '05:00', 'Asia/Manila', 0, '17:00', '21:00', false, 'Manila Monday morning = UTC Sunday evening'],
      [2, '07:00', '09:00', 'Asia/Manila', 1, '23:00', '01:00', true, 'Manila Tuesday 7am = UTC Monday 11pm (spans midnight in UTC)'],
      [0, '01:00', '05:00', 'Asia/Tokyo', 6, '16:00', '20:00', false, 'Tokyo Sunday morning = UTC Saturday evening'],
      [1, '08:00', '12:00', 'Asia/Shanghai', 1, '00:00', '04:00', false, 'Shanghai Monday 8am = UTC Monday midnight'],
    ];

    it.each(cases)(
      'convertPatternToUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s, crossesMidnight: %s} (%s)',
      (localDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd, expectedCrossesMidnight) => {
        const result = convertPatternToUTC(localDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
        expect(result.crossesMidnight).toBe(expectedCrossesMidnight);
      }
    );
  });

  describe('overnight patterns in local time', () => {
    // Note: When local overnight converts to UTC and doesn't span midnight in UTC,
    // crossesMidnight is still true because original was overnight
    const cases: [number, string, string, string, number, string, string, boolean, string][] = [
      [1, '22:00', '02:00', 'UTC', 1, '22:00', '02:00', true, 'UTC overnight stays Monday'],
      [1, '22:00', '02:00', 'Asia/Tokyo', 1, '13:00', '17:00', true, 'Tokyo overnight = UTC daytime (original was overnight)'],
      [5, '23:00', '03:00', 'America/Los_Angeles', 6, '07:00', '11:00', true, 'LA Friday overnight = UTC Saturday daytime (original was overnight)'],
    ];

    it.each(cases)(
      'convertPatternToUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s, crossesMidnight: %s} (%s)',
      (localDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd, expectedCrossesMidnight) => {
        const result = convertPatternToUTC(localDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
        expect(result.crossesMidnight).toBe(expectedCrossesMidnight);
      }
    );
  });

  describe('full day patterns (00:00-24:00)', () => {
    // Full day patterns should result in crossesMidnight=true with same start/end times
    // OR be preserved as 00:00-24:00 for UTC

    const cases: [number, string, string, number, boolean, string][] = [
      // [localDay, timezone, expectedDay, expectedCrossesMidnight, description]
      [1, 'UTC', 1, false, 'UTC full day preserved'],
      [1, 'America/Los_Angeles', 1, true, 'LA full day = crossesMidnight'],
      [1, 'Asia/Manila', 0, true, 'Manila full day shifts to Sunday with crossesMidnight'],
      [1, 'Europe/Paris', 0, true, 'Paris full day shifts to Sunday with crossesMidnight'],
    ];

    it.each(cases)(
      'convertPatternToUTC(%d, 00:00, 24:00, %s) = {day: %d, crossesMidnight: %s} (%s)',
      (localDay, tz, expectedDay, expectedCrossesMidnight) => {
        const result = convertPatternToUTC(localDay, '00:00', '24:00', tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.crossesMidnight).toBe(expectedCrossesMidnight);

        // Verify 24-hour duration when creating a range
        const range = createRange(result.startTime, result.endTime, result.crossesMidnight);
        expect(range.endMinutes - range.startMinutes).toBe(1440);
      }
    );
  });

  describe('fractional timezones', () => {
    // Note: When UTC times span midnight, crossesMidnight becomes true
    const cases: [number, string, string, string, number, string, string, boolean, string][] = [
      [1, '09:00', '17:00', 'Asia/Kolkata', 1, '03:30', '11:30', false, 'India 9-5 = UTC 3:30-11:30'],
      [1, '09:00', '17:00', 'Asia/Kathmandu', 1, '03:15', '11:15', false, 'Nepal 9-5 = UTC 3:15-11:15'],
      [1, '03:00', '07:00', 'Asia/Kolkata', 0, '21:30', '01:30', true, 'India early morning = UTC prev day (spans midnight)'],
    ];

    it.each(cases)(
      'convertPatternToUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s, crossesMidnight: %s} (%s)',
      (localDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd, expectedCrossesMidnight) => {
        const result = convertPatternToUTC(localDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
        expect(result.crossesMidnight).toBe(expectedCrossesMidnight);
      }
    );
  });

  describe('extreme timezones', () => {
    // Note: When UTC times span midnight, crossesMidnight becomes true
    const cases: [number, string, string, string, number, string, string, boolean, string][] = [
      // Pago Pago UTC-11
      [1, '10:00', '14:00', 'Pacific/Pago_Pago', 1, '21:00', '01:00', true, 'Pago Pago Monday 10am = UTC Monday 9pm (spans midnight)'],
      // Kiritimati UTC+14
      [1, '10:00', '14:00', 'Pacific/Kiritimati', 0, '20:00', '00:00', true, 'Kiritimati Monday 10am = UTC Sunday 8pm (spans midnight)'],
    ];

    it.each(cases)(
      'convertPatternToUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s, crossesMidnight: %s} (%s)',
      (localDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd, expectedCrossesMidnight) => {
        const result = convertPatternToUTC(localDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
        expect(result.crossesMidnight).toBe(expectedCrossesMidnight);
      }
    );
  });
});

// ============================================================================
// convertPatternFromUTC TESTS
// ============================================================================

describe('convertPatternFromUTC matrix', () => {
  describe('same day conversions', () => {
    const cases: [number, string, string, string, number, string, string, string][] = [
      // [utcDay, startTime, endTime, timezone, expectedDay, expectedStart, expectedEnd, description]
      [1, '09:00', '17:00', 'UTC', 1, '09:00', '17:00', 'UTC unchanged'],
      [1, '18:00', '22:00', 'America/Los_Angeles', 1, '10:00', '14:00', 'UTC evening = LA daytime'],
      [1, '01:00', '09:00', 'Asia/Tokyo', 1, '10:00', '18:00', 'UTC morning = Tokyo daytime'],
    ];

    it.each(cases)(
      'convertPatternFromUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s} (%s)',
      (utcDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd) => {
        const result = convertPatternFromUTC(utcDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
      }
    );
  });

  describe('day shift forward (UTC → Asia/Pacific next day)', () => {
    const cases: [number, string, string, string, number, string, string, string][] = [
      [0, '17:00', '21:00', 'Asia/Manila', 1, '01:00', '05:00', 'UTC Sunday evening = Manila Monday morning'],
      [1, '16:00', '20:00', 'Asia/Tokyo', 2, '01:00', '05:00', 'UTC Monday evening = Tokyo Tuesday morning'],
      [6, '23:00', '03:00', 'Asia/Manila', 0, '07:00', '11:00', 'UTC Saturday overnight = Manila Sunday morning'],
    ];

    it.each(cases)(
      'convertPatternFromUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s} (%s)',
      (utcDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd) => {
        const result = convertPatternFromUTC(utcDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
      }
    );
  });

  describe('day shift backward (UTC → Americas previous day)', () => {
    const cases: [number, string, string, string, number, string, string, string][] = [
      [2, '02:00', '06:00', 'America/Los_Angeles', 1, '18:00', '22:00', 'UTC Tuesday morning = LA Monday evening'],
      [6, '02:00', '04:00', 'America/New_York', 5, '21:00', '23:00', 'UTC Saturday morning = NYC Friday night'],
      [0, '05:00', '07:00', 'America/Los_Angeles', 6, '21:00', '23:00', 'UTC Sunday morning = LA Saturday night'],
    ];

    it.each(cases)(
      'convertPatternFromUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s} (%s)',
      (utcDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd) => {
        const result = convertPatternFromUTC(utcDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
      }
    );
  });

  describe('overnight patterns from UTC', () => {
    const cases: [number, string, string, string, number, string, string, string][] = [
      [1, '23:00', '01:00', 'Asia/Manila', 2, '07:00', '09:00', 'UTC overnight = Manila morning'],
      [1, '22:00', '02:00', 'UTC', 1, '22:00', '02:00', 'UTC overnight unchanged'],
    ];

    it.each(cases)(
      'convertPatternFromUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s} (%s)',
      (utcDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd) => {
        const result = convertPatternFromUTC(utcDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
      }
    );
  });

  describe('extreme timezones', () => {
    const cases: [number, string, string, string, number, string, string, string][] = [
      // Pago Pago UTC-11
      [2, '10:00', '14:00', 'Pacific/Pago_Pago', 1, '23:00', '03:00', 'UTC Tuesday = Pago Pago Monday night/overnight'],
      // Kiritimati UTC+14
      [1, '10:00', '14:00', 'Pacific/Kiritimati', 2, '00:00', '04:00', 'UTC Monday = Kiritimati Tuesday midnight'],
    ];

    it.each(cases)(
      'convertPatternFromUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s} (%s)',
      (utcDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd) => {
        const result = convertPatternFromUTC(utcDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
      }
    );
  });

  describe('fractional timezones', () => {
    const cases: [number, string, string, string, number, string, string, string][] = [
      [1, '10:00', '14:00', 'Asia/Kolkata', 1, '15:30', '19:30', 'UTC to India = +5:30'],
      [1, '10:00', '14:00', 'Asia/Kathmandu', 1, '15:45', '19:45', 'UTC to Nepal = +5:45'],
    ];

    it.each(cases)(
      'convertPatternFromUTC(%d, %s, %s, %s) = {day: %d, start: %s, end: %s} (%s)',
      (utcDay, startTime, endTime, tz, expectedDay, expectedStart, expectedEnd) => {
        const result = convertPatternFromUTC(utcDay, startTime, endTime, tz);
        expect(result.dayOfWeek).toBe(expectedDay);
        expect(result.startTime).toBe(expectedStart);
        expect(result.endTime).toBe(expectedEnd);
      }
    );
  });
});

// ============================================================================
// ROUND-TRIP CONVERSION TESTS - CRITICAL FOR REGRESSION
// ============================================================================

describe('round-trip conversion matrix', () => {
  // Test that local → UTC → local preserves the original values

  const roundTripCases: [number, string, string, string, string][] = [
    // [dayOfWeek, startTime, endTime, timezone, description]
    // Americas
    [1, '09:00', '17:00', 'America/Los_Angeles', 'LA business hours'],
    [5, '18:00', '23:00', 'America/Los_Angeles', 'LA Friday evening'],
    [1, '09:00', '17:00', 'America/New_York', 'NYC business hours'],
    [1, '09:00', '17:00', 'America/Chicago', 'Chicago business hours'],
    [1, '09:00', '17:00', 'America/Denver', 'Denver business hours'],
    [1, '09:00', '17:00', 'America/Sao_Paulo', 'Sao Paulo business hours'],

    // Europe
    [1, '09:00', '17:00', 'Europe/London', 'London business hours'],
    [1, '09:00', '17:00', 'Europe/Paris', 'Paris business hours'],
    [1, '09:00', '17:00', 'Europe/Berlin', 'Berlin business hours'],
    [1, '09:00', '17:00', 'Europe/Moscow', 'Moscow business hours'],

    // Asia
    [1, '09:00', '17:00', 'Asia/Tokyo', 'Tokyo business hours'],
    [1, '07:00', '09:00', 'Asia/Manila', 'Manila morning (UTC overnight)'],
    [2, '19:00', '23:00', 'Asia/Manila', 'Manila Tuesday evening'],
    [1, '09:00', '17:00', 'Asia/Shanghai', 'Shanghai business hours'],
    [1, '09:00', '17:00', 'Asia/Dubai', 'Dubai business hours'],

    // Fractional
    [1, '09:00', '17:00', 'Asia/Kolkata', 'India business hours'],
    [1, '09:00', '17:00', 'Asia/Kathmandu', 'Nepal business hours'],

    // Pacific
    [1, '09:00', '17:00', 'Pacific/Auckland', 'Auckland business hours'],
    [1, '10:00', '14:00', 'Pacific/Honolulu', 'Hawaii midday'],

    // Extreme
    [1, '10:00', '14:00', 'Pacific/Pago_Pago', 'Pago Pago (UTC-11)'],
    [1, '10:00', '14:00', 'Pacific/Kiritimati', 'Kiritimati (UTC+14)'],

    // UTC
    [1, '09:00', '17:00', 'UTC', 'UTC reference'],

    // Overnight
    [1, '22:00', '02:00', 'America/Los_Angeles', 'LA overnight'],
    [5, '23:00', '03:00', 'Asia/Tokyo', 'Tokyo Friday overnight'],
  ];

  it.each(roundTripCases)(
    'round-trip: %d %s-%s in %s preserves original (%s)',
    (dayOfWeek, startTime, endTime, timezone) => {
      const utc = convertPatternToUTC(dayOfWeek, startTime, endTime, timezone);
      const backToLocal = convertPatternFromUTC(utc.dayOfWeek, utc.startTime, utc.endTime, timezone, utc.crossesMidnight);

      expect(backToLocal.dayOfWeek).toBe(dayOfWeek);
      expect(backToLocal.startTime).toBe(startTime);
      expect(backToLocal.endTime).toBe(endTime);
    }
  );

  describe('duration preservation across all timezones', () => {
    // Verify that the duration is preserved through conversion
    // NOTE: Standard same-day and full-day patterns preserve duration correctly.
    // Overnight patterns that convert to non-overnight UTC times have complex
    // behavior due to how crossesMidnight is tracked.

    const durationCases: [number, string, string, string, number][] = [
      // [dayOfWeek, startTime, endTime, timezone, expectedDurationMinutes]
      // Standard daytime patterns
      [1, '09:00', '17:00', 'America/Los_Angeles', 480],
      [1, '09:00', '17:00', 'Asia/Manila', 480],
      [1, '09:00', '17:00', 'Asia/Kolkata', 480],
      [1, '09:00', '17:00', 'Asia/Kathmandu', 480],
      // Full day patterns
      [1, '00:00', '24:00', 'America/Los_Angeles', 1440],
      [1, '00:00', '24:00', 'Asia/Manila', 1440],
      // Evening patterns
      [1, '17:00', '22:00', 'America/Los_Angeles', 300],
      [1, '18:00', '22:00', 'Europe/London', 240],
    ];

    it.each(durationCases)(
      '%d %s-%s in %s preserves duration of %d minutes',
      (dayOfWeek, startTime, endTime, timezone, expectedDuration) => {
        const utc = convertPatternToUTC(dayOfWeek, startTime, endTime, timezone);

        // Create range with the crossesMidnight flag
        const range = createRange(utc.startTime, utc.endTime, utc.crossesMidnight);
        const actualDuration = range.endMinutes - range.startMinutes;

        expect(actualDuration).toBe(expectedDuration);
      }
    );
  });
});

// ============================================================================
// convertPatternBetweenTimezones TESTS
// ============================================================================

describe('convertPatternBetweenTimezones matrix', () => {
  const cases: [number[], string, string, string, string, number[], string, string, string][] = [
    // [days, startTime, endTime, fromTz, toTz, expectedDays, expectedStart, expectedEnd, description]
    [[1], '15:00', '21:00', 'America/Los_Angeles', 'America/Los_Angeles', [1], '15:00', '21:00', 'same tz unchanged'],
    [[1, 2, 3], '15:00', '21:00', 'America/Los_Angeles', 'Asia/Manila', [2, 3, 4], '07:00', '13:00', 'LA to Manila shifts +16h'],
    [[2, 3, 4], '07:00', '13:00', 'Asia/Manila', 'America/Los_Angeles', [1, 2, 3], '15:00', '21:00', 'Manila to LA shifts -16h'],
    [[0], '23:00', '23:30', 'Asia/Tokyo', 'America/Los_Angeles', [0], '06:00', '06:30', 'Tokyo Sunday late = LA Sunday morning'],
  ];

  it.each(cases)(
    'convertPatternBetweenTimezones(%j, %s, %s, %s, %s) = {days: %j, start: %s, end: %s} (%s)',
    (days, startTime, endTime, fromTz, toTz, expectedDays, expectedStart, expectedEnd) => {
      const result = convertPatternBetweenTimezones(days, startTime, endTime, fromTz, toTz);
      expect(result.days).toEqual(expectedDays);
      expect(result.startTime).toBe(expectedStart);
      expect(result.endTime).toBe(expectedEnd);
    }
  );

  describe('full day patterns stay semantic', () => {
    // "All day Monday" should stay "All day Monday" in any timezone

    const fullDayCases: [string, string, string][] = [
      ['America/Los_Angeles', 'Asia/Manila', 'LA to Manila'],
      ['Asia/Manila', 'America/Los_Angeles', 'Manila to LA'],
      ['UTC', 'America/New_York', 'UTC to NYC'],
      ['Europe/London', 'Asia/Tokyo', 'London to Tokyo'],
      ['Pacific/Auckland', 'Pacific/Pago_Pago', 'Auckland to Pago Pago'],
    ];

    it.each(fullDayCases)(
      'full day 00:00-24:00 from %s to %s stays 00:00-24:00 (%s)',
      (fromTz, toTz) => {
        const result = convertPatternBetweenTimezones([1], '00:00', '24:00', fromTz, toTz);
        expect(result.startTime).toBe('00:00');
        expect(result.endTime).toBe('24:00');
        expect(result.days).toEqual([1]); // Same day preserved
      }
    );
  });
});

// ============================================================================
// Override conversion tests
// ============================================================================

describe('convertOverrideToUTC matrix', () => {
  const cases: [string, string, string, string, string, string, string, boolean, string][] = [
    // [date, startTime, endTime, timezone, expectedDate, expectedStart, expectedEnd, expectedCrossesMidnight, description]
    ['2024-01-15', '17:00', '21:00', 'America/Los_Angeles', '2024-01-16', '01:00', '05:00', false, 'LA evening = next day UTC'],
    ['2024-01-15', '10:00', '14:00', 'America/Los_Angeles', '2024-01-15', '18:00', '22:00', false, 'LA daytime = same day UTC'],
    ['2024-01-15', '07:00', '09:00', 'Asia/Manila', '2024-01-14', '23:00', '01:00', false, 'Manila morning = prev day UTC'],
  ];

  it.each(cases)(
    'convertOverrideToUTC(%s, %s, %s, %s) = {date: %s, start: %s, end: %s, crossesMidnight: %s} (%s)',
    (date, startTime, endTime, tz, expectedDate, expectedStart, expectedEnd, expectedCrossesMidnight) => {
      const result = convertOverrideToUTC(date, startTime, endTime, tz);
      expect(result.date).toBe(expectedDate);
      expect(result.startTime).toBe(expectedStart);
      expect(result.endTime).toBe(expectedEnd);
      expect(result.crossesMidnight).toBe(expectedCrossesMidnight);
    }
  );
});

describe('convertOverrideFromUTC matrix', () => {
  const cases: [string, string, string, string, string, string, string, string][] = [
    // [date, startTime, endTime, timezone, expectedDate, expectedStart, expectedEnd, description]
    ['2024-01-16', '01:00', '05:00', 'America/Los_Angeles', '2024-01-15', '17:00', '21:00', 'UTC morning = LA prev evening'],
    ['2024-01-15', '18:00', '22:00', 'America/Los_Angeles', '2024-01-15', '10:00', '14:00', 'UTC evening = LA daytime'],
    ['2024-01-14', '23:00', '01:00', 'Asia/Manila', '2024-01-15', '07:00', '09:00', 'UTC overnight = Manila next morning'],
  ];

  it.each(cases)(
    'convertOverrideFromUTC(%s, %s, %s, %s) = {date: %s, start: %s, end: %s} (%s)',
    (date, startTime, endTime, tz, expectedDate, expectedStart, expectedEnd) => {
      const result = convertOverrideFromUTC(date, startTime, endTime, tz);
      expect(result.date).toBe(expectedDate);
      expect(result.startTime).toBe(expectedStart);
      expect(result.endTime).toBe(expectedEnd);
    }
  );
});

// ============================================================================
// Helper function tests
// ============================================================================

describe('getUTCDayOfWeek matrix', () => {
  const cases: [string, number, string][] = [
    // [date, expectedDayOfWeek, description]
    ['2024-01-07', 0, 'Jan 7, 2024 is Sunday'],
    ['2024-01-08', 1, 'Jan 8, 2024 is Monday'],
    ['2024-01-09', 2, 'Jan 9, 2024 is Tuesday'],
    ['2024-01-10', 3, 'Jan 10, 2024 is Wednesday'],
    ['2024-01-11', 4, 'Jan 11, 2024 is Thursday'],
    ['2024-01-12', 5, 'Jan 12, 2024 is Friday'],
    ['2024-01-13', 6, 'Jan 13, 2024 is Saturday'],
    ['2024-01-14', 0, 'Jan 14, 2024 is Sunday'],
  ];

  it.each(cases)(
    'getUTCDayOfWeek(%s) = %d (%s)',
    (date, expected) => {
      expect(getUTCDayOfWeek(date)).toBe(expected);
    }
  );
});

describe('getDateRange matrix', () => {
  const cases: [string, string, string[], string][] = [
    ['2024-01-15', '2024-01-15', ['2024-01-15'], 'single day'],
    ['2024-01-15', '2024-01-17', ['2024-01-15', '2024-01-16', '2024-01-17'], 'three days'],
    ['2024-01-01', '2024-01-07', ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06', '2024-01-07'], 'full week'],
  ];

  it.each(cases)(
    'getDateRange(%s, %s) = %j (%s)',
    (start, end, expected) => {
      expect(getDateRange(start, end)).toEqual(expected);
    }
  );
});
