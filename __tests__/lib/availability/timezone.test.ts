import {
  localToUTC,
  utcToLocal,
  convertPatternToUTC,
  convertPatternFromUTC,
  convertOverrideToUTC,
  convertOverrideFromUTC,
  getUTCDayOfWeek,
  getDateRange,
} from "../../../lib/availability/timezone";

describe("timezone utilities", () => {
  describe("localToUTC", () => {
    it("returns unchanged for UTC timezone", () => {
      const result = localToUTC("17:00", "2024-01-15", "UTC");
      expect(result).toEqual({ date: "2024-01-15", time: "17:00" });
    });

    it("converts LA time to UTC (PST -8)", () => {
      // 5pm LA = 1am next day UTC (during standard time)
      const result = localToUTC("17:00", "2024-01-15", "America/Los_Angeles");
      expect(result).toEqual({ date: "2024-01-16", time: "01:00" });
    });

    it("converts Tokyo time to UTC (JST +9)", () => {
      // 1am Tokyo = 4pm previous day UTC
      const result = localToUTC("01:00", "2024-01-15", "Asia/Tokyo");
      expect(result).toEqual({ date: "2024-01-14", time: "16:00" });
    });

    it("handles noon correctly", () => {
      // 12pm LA = 8pm UTC
      const result = localToUTC("12:00", "2024-01-15", "America/Los_Angeles");
      expect(result).toEqual({ date: "2024-01-15", time: "20:00" });
    });
  });

  describe("utcToLocal", () => {
    it("returns unchanged for UTC timezone", () => {
      const result = utcToLocal("17:00", "2024-01-15", "UTC");
      expect(result).toEqual({ date: "2024-01-15", time: "17:00" });
    });

    it("converts UTC to LA time (PST -8)", () => {
      // 1am UTC = 5pm previous day LA (during standard time)
      const result = utcToLocal("01:00", "2024-01-16", "America/Los_Angeles");
      expect(result).toEqual({ date: "2024-01-15", time: "17:00" });
    });

    it("converts UTC to Tokyo time (JST +9)", () => {
      // 4pm UTC = 1am next day Tokyo
      const result = utcToLocal("16:00", "2024-01-14", "Asia/Tokyo");
      expect(result).toEqual({ date: "2024-01-15", time: "01:00" });
    });
  });

  describe("convertPatternToUTC", () => {
    it("returns unchanged for UTC timezone", () => {
      const result = convertPatternToUTC(1, "09:00", "17:00", "UTC");
      expect(result).toEqual({ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" });
    });

    it("converts Monday in Manila to UTC (shifts day back)", () => {
      // Monday 1am-5am in Manila (UTC+8) = Sunday 5pm-9pm UTC
      const result = convertPatternToUTC(1, "01:00", "05:00", "Asia/Manila");
      expect(result).toEqual({
        dayOfWeek: 0, // Sunday in UTC
        startTime: "17:00",
        endTime: "21:00",
      });
    });

    it("converts Tuesday in Tokyo to UTC (shifts day back)", () => {
      // Tuesday 1am-5am in Tokyo (UTC+9) = Monday 4pm-8pm UTC
      const result = convertPatternToUTC(2, "01:00", "05:00", "Asia/Tokyo");
      expect(result).toEqual({
        dayOfWeek: 1, // Monday in UTC
        startTime: "16:00",
        endTime: "20:00",
      });
    });

    it("converts Saturday evening in LA to UTC (shifts day forward)", () => {
      // Saturday 9pm in LA (PST -8) = Sunday 5am UTC
      const result = convertPatternToUTC(6, "21:00", "23:00", "America/Los_Angeles");
      expect(result).toEqual({
        dayOfWeek: 0, // Sunday in UTC
        startTime: "05:00",
        endTime: "07:00",
      });
    });

    it("handles Sunday wrapping to Saturday", () => {
      // Sunday 1am-5am in Manila = Saturday 5pm-9pm UTC
      const result = convertPatternToUTC(0, "01:00", "05:00", "Asia/Manila");
      expect(result).toEqual({
        dayOfWeek: 6, // Saturday in UTC
        startTime: "17:00",
        endTime: "21:00",
      });
    });

    it("handles daytime that stays same day", () => {
      // Tuesday 2pm-6pm in New York (EST -5) = Tuesday 7pm-11pm UTC
      const result = convertPatternToUTC(2, "14:00", "18:00", "America/New_York");
      expect(result).toEqual({
        dayOfWeek: 2, // Still Tuesday
        startTime: "19:00",
        endTime: "23:00",
      });
    });
  });

  describe("convertPatternFromUTC", () => {
    it("returns unchanged for UTC timezone", () => {
      const result = convertPatternFromUTC(1, "09:00", "17:00", "UTC");
      expect(result).toEqual({ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" });
    });

    it("converts UTC Sunday to Monday in Manila", () => {
      // Sunday 5pm-9pm UTC = Monday 1am-5am Manila (UTC+8)
      const result = convertPatternFromUTC(0, "17:00", "21:00", "Asia/Manila");
      expect(result).toEqual({
        dayOfWeek: 1, // Monday in Manila
        startTime: "01:00",
        endTime: "05:00",
      });
    });

    it("converts UTC Monday to Tuesday in Tokyo", () => {
      // Monday 4pm-8pm UTC = Tuesday 1am-5am Tokyo (UTC+9)
      const result = convertPatternFromUTC(1, "16:00", "20:00", "Asia/Tokyo");
      expect(result).toEqual({
        dayOfWeek: 2, // Tuesday in Tokyo
        startTime: "01:00",
        endTime: "05:00",
      });
    });

    it("converts UTC Sunday to Saturday in LA", () => {
      // Sunday 5am-7am UTC = Saturday 9pm-11pm LA (PST -8)
      const result = convertPatternFromUTC(0, "05:00", "07:00", "America/Los_Angeles");
      expect(result).toEqual({
        dayOfWeek: 6, // Saturday in LA
        startTime: "21:00",
        endTime: "23:00",
      });
    });

    it("handles overnight patterns in UTC", () => {
      // UTC Monday 23:00 to Tuesday 02:00 (overnight in UTC)
      // In Manila: Tuesday 7am to 10am
      const result = convertPatternFromUTC(1, "23:00", "02:00", "Asia/Manila");
      expect(result).toEqual({
        dayOfWeek: 2, // Tuesday
        startTime: "07:00",
        endTime: "10:00",
      });
    });
  });

  describe("convertOverrideToUTC", () => {
    it("converts specific date from LA to UTC", () => {
      // Jan 15 5pm LA = Jan 16 1am UTC
      const result = convertOverrideToUTC(
        "2024-01-15",
        "17:00",
        "21:00",
        "America/Los_Angeles"
      );
      expect(result).toEqual({
        date: "2024-01-16",
        startTime: "01:00",
        endTime: "05:00",
      });
    });

    it("keeps date same when time doesn't cross midnight", () => {
      // Jan 15 10am-2pm LA = Jan 15 6pm-10pm UTC
      const result = convertOverrideToUTC(
        "2024-01-15",
        "10:00",
        "14:00",
        "America/Los_Angeles"
      );
      expect(result).toEqual({
        date: "2024-01-15",
        startTime: "18:00",
        endTime: "22:00",
      });
    });
  });

  describe("convertOverrideFromUTC", () => {
    it("converts UTC to LA specific date", () => {
      // Jan 16 1am UTC = Jan 15 5pm LA
      const result = convertOverrideFromUTC(
        "2024-01-16",
        "01:00",
        "05:00",
        "America/Los_Angeles"
      );
      expect(result).toEqual({
        date: "2024-01-15",
        startTime: "17:00",
        endTime: "21:00",
      });
    });
  });

  describe("extreme timezones", () => {
    it("handles Pago Pago (UTC-11)", () => {
      // Tuesday 10am UTC = Monday 11pm Pago Pago (UTC-11)
      const result = convertPatternFromUTC(2, "10:00", "14:00", "Pacific/Pago_Pago");
      expect(result).toEqual({
        dayOfWeek: 1, // Monday
        startTime: "23:00",
        endTime: "03:00", // Overnight in local
      });
    });

    it("handles Kiritimati (UTC+14)", () => {
      // Monday 10am UTC = Tuesday 12am (midnight) Kiritimati (UTC+14)
      const result = convertPatternFromUTC(1, "10:00", "14:00", "Pacific/Kiritimati");
      expect(result).toEqual({
        dayOfWeek: 2, // Tuesday
        startTime: "00:00",
        endTime: "04:00",
      });
    });

    it("handles India (UTC+5:30)", () => {
      // Monday 10:00 UTC = Monday 15:30 India
      const result = convertPatternFromUTC(1, "10:00", "14:00", "Asia/Kolkata");
      expect(result).toEqual({
        dayOfWeek: 1, // Still Monday
        startTime: "15:30",
        endTime: "19:30",
      });
    });

    it("handles Nepal (UTC+5:45)", () => {
      // Monday 10:00 UTC = Monday 15:45 Nepal
      const result = convertPatternFromUTC(1, "10:00", "14:00", "Asia/Kathmandu");
      expect(result).toEqual({
        dayOfWeek: 1, // Still Monday
        startTime: "15:45",
        endTime: "19:45",
      });
    });
  });

  describe("getUTCDayOfWeek", () => {
    it("returns correct day of week for dates", () => {
      // Jan 7, 2024 is a Sunday
      expect(getUTCDayOfWeek("2024-01-07")).toBe(0);
      expect(getUTCDayOfWeek("2024-01-08")).toBe(1); // Monday
      expect(getUTCDayOfWeek("2024-01-13")).toBe(6); // Saturday
    });
  });

  describe("getDateRange", () => {
    it("generates array of dates between start and end", () => {
      const dates = getDateRange("2024-01-15", "2024-01-18");
      expect(dates).toEqual([
        "2024-01-15",
        "2024-01-16",
        "2024-01-17",
        "2024-01-18",
      ]);
    });

    it("returns single date when start equals end", () => {
      const dates = getDateRange("2024-01-15", "2024-01-15");
      expect(dates).toEqual(["2024-01-15"]);
    });
  });

  describe("round-trip conversions", () => {
    it("pattern: local -> UTC -> local returns original", () => {
      const original = { dayOfWeek: 2, startTime: "14:00", endTime: "18:00" };
      const utc = convertPatternToUTC(
        original.dayOfWeek,
        original.startTime,
        original.endTime,
        "America/New_York"
      );
      const backToLocal = convertPatternFromUTC(
        utc.dayOfWeek,
        utc.startTime,
        utc.endTime,
        "America/New_York"
      );
      expect(backToLocal).toEqual(original);
    });

    it("pattern: UTC -> local -> UTC returns original", () => {
      const original = { dayOfWeek: 1, startTime: "16:00", endTime: "20:00" };
      const local = convertPatternFromUTC(
        original.dayOfWeek,
        original.startTime,
        original.endTime,
        "Asia/Tokyo"
      );
      const backToUTC = convertPatternToUTC(
        local.dayOfWeek,
        local.startTime,
        local.endTime,
        "Asia/Tokyo"
      );
      expect(backToUTC).toEqual(original);
    });

    it("roundtrip with extreme timezone (Pago Pago)", () => {
      const original = { dayOfWeek: 3, startTime: "10:00", endTime: "14:00" };
      const local = convertPatternFromUTC(
        original.dayOfWeek,
        original.startTime,
        original.endTime,
        "Pacific/Pago_Pago"
      );
      const backToUTC = convertPatternToUTC(
        local.dayOfWeek,
        local.startTime,
        local.endTime,
        "Pacific/Pago_Pago"
      );
      expect(backToUTC).toEqual(original);
    });
  });
});
