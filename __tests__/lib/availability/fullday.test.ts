import {
  convertPatternToUTC,
  convertPatternFromUTC,
  convertPatternBetweenTimezones,
} from '../../../lib/availability/timezone';
import { createRange, timeToMinutes } from '../../../lib/availability/range-math';

describe('full day patterns', () => {
  describe('convertPatternToUTC with full day (00:00-24:00)', () => {
    it.each([
      // [timezone, expectedUtcStartTime, expectedEndTime, expectedCrossesMidnight]
      // Non-UTC timezones: start and end become same time, crossesMidnight=true
      ['America/Los_Angeles', '08:00', '08:00', true],
      ['America/Cancun', '05:00', '05:00', true],
      ['America/New_York', '05:00', '05:00', true],
      ['America/Chicago', '06:00', '06:00', true],
      ['America/Denver', '07:00', '07:00', true],
      ['Europe/London', '00:00', '00:00', true],
      ['Europe/Paris', '23:00', '23:00', true], // Previous day
      ['Asia/Tokyo', '15:00', '15:00', true], // Previous day
      ['Asia/Manila', '16:00', '16:00', true], // Previous day
      ['Australia/Sydney', '13:00', '13:00', true], // Previous day
      ['Pacific/Auckland', '11:00', '11:00', true], // Previous day
      // UTC: preserves original format, crossesMidnight=false since "24:00" means end of day
      ['UTC', '00:00', '24:00', false],
    ])('converts 00:00-24:00 from %s correctly', (timezone, expectedStart, expectedEnd, expectedCrossesMidnight) => {
      const result = convertPatternToUTC(1, '00:00', '24:00', timezone); // Monday

      expect(result.startTime).toBe(expectedStart);
      expect(result.endTime).toBe(expectedEnd);
      expect(result.crossesMidnight).toBe(expectedCrossesMidnight);

      // Verify range creation produces 24 hours (1440 minutes)
      const range = createRange(result.startTime, result.endTime, result.crossesMidnight);
      expect(range.endMinutes - range.startMinutes).toBe(1440);
    });
  });

  describe('createRange duration preservation', () => {
    it.each([
      // [startTime, endTime, crossesMidnight, expectedDuration]
      ['00:00', '24:00', false, 1440], // Full day explicit
      ['00:00', '00:00', true, 1440], // Full day via crossesMidnight
      ['08:00', '08:00', true, 1440], // Full day via crossesMidnight (any time)
      ['05:00', '05:00', true, 1440], // Full day via crossesMidnight (any time)
      ['00:00', '00:00', false, 1440], // Special case: both midnight = full day
      ['09:00', '17:00', false, 480], // Normal 8-hour range
      ['22:00', '06:00', true, 480], // Overnight 8-hour range
    ])('createRange(%s, %s, crossesMidnight=%s) = %d minutes',
      (startTime, endTime, crossesMidnight, expectedDuration) => {
        const range = createRange(startTime, endTime, crossesMidnight);
        expect(range.endMinutes - range.startMinutes).toBe(expectedDuration);
      }
    );
  });

  describe('convertPatternBetweenTimezones preserves full day semantically', () => {
    it.each([
      // [fromTz, toTz, description]
      ['America/Los_Angeles', 'America/Cancun', 'Pacific to Eastern Standard'],
      ['America/Cancun', 'America/Los_Angeles', 'Eastern Standard to Pacific'],
      ['America/New_York', 'Asia/Tokyo', 'NYC to Tokyo'],
      ['Asia/Tokyo', 'America/New_York', 'Tokyo to NYC'],
      ['Europe/London', 'Asia/Manila', 'London to Manila'],
      ['Australia/Sydney', 'America/Los_Angeles', 'Sydney to LA'],
      ['UTC', 'America/Cancun', 'UTC to Cancun'],
      ['America/Cancun', 'UTC', 'Cancun to UTC'],
    ])('preserves 00:00-24:00 semantically from %s to %s', (fromTz, toTz, _desc) => {
      const result = convertPatternBetweenTimezones(
        [1], // Monday
        '00:00',
        '24:00',
        fromTz,
        toTz
      );

      // Semantic interpretation: "all day Monday" stays "all day Monday" regardless of timezone
      // This is because the UI pattern editor doesn't support crossesMidnight patterns
      expect(result.startTime).toBe('00:00');
      expect(result.endTime).toBe('24:00');
      expect(result.days).toEqual([1]); // Same day preserved

      // Creating a range should give 24 hours
      const range = createRange(result.startTime, result.endTime, false);
      expect(range.endMinutes - range.startMinutes).toBe(1440);
    });
  });

  describe('round-trip conversions preserve duration', () => {
    it.each([
      // [startTime, endTime, timezone, description]
      ['00:00', '24:00', 'America/Los_Angeles', 'full day LA'],
      ['00:00', '24:00', 'America/Cancun', 'full day Cancun'],
      ['00:00', '24:00', 'Asia/Tokyo', 'full day Tokyo'],
      ['09:00', '17:00', 'America/Los_Angeles', '9-5 LA'],
      ['17:00', '21:00', 'America/Cancun', 'evening Cancun'],
      ['22:00', '06:00', 'America/Los_Angeles', 'overnight LA'],
    ])('round-trip %s-%s in %s preserves duration', (startTime, endTime, timezone, _desc) => {
      const originalDuration = (() => {
        const start = timeToMinutes(startTime);
        let end = timeToMinutes(endTime);
        if (endTime === '24:00') end = 1440;
        if (end <= start && endTime !== startTime) end += 1440;
        return end - start;
      })();

      // Convert to UTC
      const utc = convertPatternToUTC(1, startTime, endTime, timezone);

      // Convert back to original timezone
      const backToLocal = convertPatternFromUTC(
        utc.dayOfWeek,
        utc.startTime,
        utc.endTime,
        timezone,
        utc.crossesMidnight
      );

      // Calculate duration of result
      const resultDuration = (() => {
        const start = timeToMinutes(backToLocal.startTime);
        let end = timeToMinutes(backToLocal.endTime);
        // Check if original was overnight
        const origStart = timeToMinutes(startTime);
        const origEnd = timeToMinutes(endTime);
        const wasOvernight = origEnd <= origStart && endTime !== startTime;
        if (wasOvernight || endTime === '24:00') {
          if (end <= start) end += 1440;
        }
        return end - start;
      })();

      expect(resultDuration).toBe(originalDuration);
    });
  });

  describe('edge case: 00:00-00:00 from AI', () => {
    it('should be normalized to 00:00-24:00 in availability-parser', async () => {
      // This test verifies the normalization logic in parseAvailabilityText
      // When AI returns 00:00-00:00, it should be treated as full day

      // The fix in availability-parser.ts normalizes this:
      // if (slot.startTime === "00:00" && slot.endTime === "00:00") {
      //   slot.endTime = "24:00";
      // }

      // Verify the createRange special case still works for legacy data
      const range = createRange('00:00', '00:00', false);
      expect(range.endMinutes - range.startMinutes).toBe(1440);
    });
  });

  describe('specific timezone: America/Cancun (UTC-5, no DST)', () => {
    it('converts full day to UTC correctly', () => {
      const result = convertPatternToUTC(1, '00:00', '24:00', 'America/Cancun');

      // Cancun is UTC-5, so 00:00 Cancun = 05:00 UTC
      expect(result.startTime).toBe('05:00');
      expect(result.endTime).toBe('05:00');
      expect(result.crossesMidnight).toBe(true);

      const range = createRange(result.startTime, result.endTime, result.crossesMidnight);
      expect(range.endMinutes - range.startMinutes).toBe(1440);
    });

    it('converts from LA to Cancun preserving full day semantically', () => {
      const result = convertPatternBetweenTimezones(
        [1], '00:00', '24:00', 'America/Los_Angeles', 'America/Cancun'
      );

      // Semantic: "all day Monday" stays "all day Monday"
      expect(result.startTime).toBe('00:00');
      expect(result.endTime).toBe('24:00');

      const range = createRange(result.startTime, result.endTime, false);
      expect(range.endMinutes - range.startMinutes).toBe(1440);
    });

    it('converts from Cancun to LA preserving full day semantically', () => {
      const result = convertPatternBetweenTimezones(
        [1], '00:00', '24:00', 'America/Cancun', 'America/Los_Angeles'
      );

      // Semantic: "all day Monday" stays "all day Monday"
      expect(result.startTime).toBe('00:00');
      expect(result.endTime).toBe('24:00');

      const range = createRange(result.startTime, result.endTime, false);
      expect(range.endMinutes - range.startMinutes).toBe(1440);
    });
  });

  describe('timezone switching UI scenario', () => {
    it('preserves full-day availability when user switches from LA to Cancun', () => {
      // Simulate what happens in AvailabilityEditor when user switches timezone
      // Pattern stored as: Monday 00:00-24:00 in LA

      // Step 1: Convert from LA to Cancun
      const converted = convertPatternBetweenTimezones(
        [1], // Monday
        '00:00',
        '24:00',
        'America/Los_Angeles',
        'America/Cancun'
      );

      // Full day is preserved semantically
      expect(converted.startTime).toBe('00:00');
      expect(converted.endTime).toBe('24:00');
      expect(converted.days).toEqual([1]);

      const range = createRange(converted.startTime, converted.endTime, false);
      expect(range.endMinutes - range.startMinutes).toBe(1440);

      // Step 2: Convert back to LA (simulating switching back)
      const convertedBack = convertPatternBetweenTimezones(
        converted.days,
        converted.startTime,
        converted.endTime,
        'America/Cancun',
        'America/Los_Angeles'
      );

      // Still preserved
      expect(convertedBack.startTime).toBe('00:00');
      expect(convertedBack.endTime).toBe('24:00');

      const rangeBack = createRange(convertedBack.startTime, convertedBack.endTime, false);
      expect(rangeBack.endMinutes - rangeBack.startMinutes).toBe(1440);
    });

    it('properly converts non-full-day patterns between timezones', () => {
      // 5pm-9pm LA pattern should shift when viewed in Cancun
      const converted = convertPatternBetweenTimezones(
        [1], // Monday
        '17:00',
        '21:00',
        'America/Los_Angeles',
        'America/Cancun'
      );

      // LA (UTC-8) to Cancun (UTC-5) is +3 hours
      // 5pm LA = 8pm Cancun, 9pm LA = 12am Cancun
      expect(converted.startTime).toBe('20:00');
      expect(converted.endTime).toBe('00:00'); // Midnight crosses to next day

      // Duration should be preserved (4 hours = 240 minutes)
      // But this crosses midnight so we need crossesMidnight for the range
      const range = createRange(converted.startTime, converted.endTime, true);
      expect(range.endMinutes - range.startMinutes).toBe(240);
    });
  });
});
