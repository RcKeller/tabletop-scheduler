import {
  timeToMinutes,
  minutesToTime,
  createRange,
  rangesOverlap,
  rangesAdjacent,
  mergeTwo,
  mergeRanges,
  subtractOne,
  subtractRanges,
  addRanges,
  intersectTwo,
  intersectRanges,
  rangesToSlots,
  slotsToRanges,
  totalMinutes,
  minuteInRanges,
  clampToWindow,
} from "../../../lib/availability/range-math";
import type { TimeRange } from "../../../lib/types/availability";

describe("range-math", () => {
  describe("timeToMinutes", () => {
    it("converts midnight to 0", () => {
      expect(timeToMinutes("00:00")).toBe(0);
    });

    it("converts 1am to 60", () => {
      expect(timeToMinutes("01:00")).toBe(60);
    });

    it("converts noon to 720", () => {
      expect(timeToMinutes("12:00")).toBe(720);
    });

    it("converts 11:30pm to 1410", () => {
      expect(timeToMinutes("23:30")).toBe(1410);
    });

    it("handles times with leading zeros", () => {
      expect(timeToMinutes("09:05")).toBe(545);
    });
  });

  describe("minutesToTime", () => {
    it("converts 0 to 00:00", () => {
      expect(minutesToTime(0)).toBe("00:00");
    });

    it("converts 60 to 01:00", () => {
      expect(minutesToTime(60)).toBe("01:00");
    });

    it("converts 720 to 12:00", () => {
      expect(minutesToTime(720)).toBe("12:00");
    });

    it("wraps values >= 1440", () => {
      expect(minutesToTime(1440)).toBe("00:00");
      expect(minutesToTime(1500)).toBe("01:00");
    });

    it("handles negative values by wrapping", () => {
      expect(minutesToTime(-60)).toBe("23:00");
    });
  });

  describe("createRange", () => {
    it("creates normal range", () => {
      const range = createRange("09:00", "17:00");
      expect(range).toEqual({ startMinutes: 540, endMinutes: 1020 });
    });

    it("handles overnight range (22:00 to 02:00)", () => {
      const range = createRange("22:00", "02:00");
      expect(range).toEqual({ startMinutes: 1320, endMinutes: 1440 + 120 });
    });

    it("handles same start and end (24-hour range)", () => {
      const range = createRange("09:00", "09:00");
      // Same times means 0-minute range, not 24 hours
      expect(range).toEqual({ startMinutes: 540, endMinutes: 540 });
    });
  });

  describe("rangesOverlap", () => {
    it("detects overlapping ranges", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 720 };
      const b: TimeRange = { startMinutes: 600, endMinutes: 840 };
      expect(rangesOverlap(a, b)).toBe(true);
    });

    it("detects non-overlapping ranges", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 600 };
      const b: TimeRange = { startMinutes: 720, endMinutes: 840 };
      expect(rangesOverlap(a, b)).toBe(false);
    });

    it("adjacent ranges do not overlap", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 600 };
      const b: TimeRange = { startMinutes: 600, endMinutes: 720 };
      expect(rangesOverlap(a, b)).toBe(false);
    });

    it("contained ranges overlap", () => {
      const outer: TimeRange = { startMinutes: 540, endMinutes: 1020 };
      const inner: TimeRange = { startMinutes: 600, endMinutes: 720 };
      expect(rangesOverlap(outer, inner)).toBe(true);
    });
  });

  describe("rangesAdjacent", () => {
    it("detects adjacent ranges", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 600 };
      const b: TimeRange = { startMinutes: 600, endMinutes: 720 };
      expect(rangesAdjacent(a, b)).toBe(true);
    });

    it("non-adjacent ranges return false", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 600 };
      const b: TimeRange = { startMinutes: 660, endMinutes: 720 };
      expect(rangesAdjacent(a, b)).toBe(false);
    });
  });

  describe("mergeTwo", () => {
    it("merges overlapping ranges", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 720 };
      const b: TimeRange = { startMinutes: 600, endMinutes: 840 };
      expect(mergeTwo(a, b)).toEqual({ startMinutes: 540, endMinutes: 840 });
    });

    it("merges adjacent ranges", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 600 };
      const b: TimeRange = { startMinutes: 600, endMinutes: 720 };
      expect(mergeTwo(a, b)).toEqual({ startMinutes: 540, endMinutes: 720 });
    });

    it("returns null for non-overlapping, non-adjacent ranges", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 600 };
      const b: TimeRange = { startMinutes: 720, endMinutes: 840 };
      expect(mergeTwo(a, b)).toBeNull();
    });
  });

  describe("mergeRanges", () => {
    it("returns empty array for empty input", () => {
      expect(mergeRanges([])).toEqual([]);
    });

    it("returns single range unchanged", () => {
      const ranges: TimeRange[] = [{ startMinutes: 540, endMinutes: 720 }];
      expect(mergeRanges(ranges)).toEqual(ranges);
    });

    it("merges overlapping ranges", () => {
      const ranges: TimeRange[] = [
        { startMinutes: 540, endMinutes: 720 },
        { startMinutes: 600, endMinutes: 840 },
      ];
      expect(mergeRanges(ranges)).toEqual([{ startMinutes: 540, endMinutes: 840 }]);
    });

    it("keeps non-overlapping ranges separate", () => {
      const ranges: TimeRange[] = [
        { startMinutes: 540, endMinutes: 600 },
        { startMinutes: 720, endMinutes: 840 },
      ];
      expect(mergeRanges(ranges)).toEqual([
        { startMinutes: 540, endMinutes: 600 },
        { startMinutes: 720, endMinutes: 840 },
      ]);
    });

    it("handles multiple overlapping ranges", () => {
      const ranges: TimeRange[] = [
        { startMinutes: 540, endMinutes: 600 },
        { startMinutes: 580, endMinutes: 700 },
        { startMinutes: 650, endMinutes: 800 },
      ];
      expect(mergeRanges(ranges)).toEqual([{ startMinutes: 540, endMinutes: 800 }]);
    });

    it("handles unsorted input", () => {
      const ranges: TimeRange[] = [
        { startMinutes: 720, endMinutes: 840 },
        { startMinutes: 540, endMinutes: 600 },
        { startMinutes: 580, endMinutes: 750 },
      ];
      expect(mergeRanges(ranges)).toEqual([{ startMinutes: 540, endMinutes: 840 }]);
    });
  });

  describe("subtractOne", () => {
    it("returns original when no overlap", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 720 };
      const b: TimeRange = { startMinutes: 840, endMinutes: 960 };
      expect(subtractOne(a, b)).toEqual([a]);
    });

    it("removes middle portion", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 840 };
      const b: TimeRange = { startMinutes: 600, endMinutes: 720 };
      expect(subtractOne(a, b)).toEqual([
        { startMinutes: 540, endMinutes: 600 },
        { startMinutes: 720, endMinutes: 840 },
      ]);
    });

    it("removes beginning", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 720 };
      const b: TimeRange = { startMinutes: 500, endMinutes: 600 };
      expect(subtractOne(a, b)).toEqual([{ startMinutes: 600, endMinutes: 720 }]);
    });

    it("removes end", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 720 };
      const b: TimeRange = { startMinutes: 660, endMinutes: 800 };
      expect(subtractOne(a, b)).toEqual([{ startMinutes: 540, endMinutes: 660 }]);
    });

    it("returns empty when fully contained", () => {
      const a: TimeRange = { startMinutes: 600, endMinutes: 720 };
      const b: TimeRange = { startMinutes: 540, endMinutes: 840 };
      expect(subtractOne(a, b)).toEqual([]);
    });
  });

  describe("subtractRanges", () => {
    it("subtracts multiple ranges", () => {
      const base: TimeRange[] = [{ startMinutes: 540, endMinutes: 1020 }];
      const toSubtract: TimeRange[] = [
        { startMinutes: 600, endMinutes: 660 },
        { startMinutes: 780, endMinutes: 840 },
      ];
      expect(subtractRanges(base, toSubtract)).toEqual([
        { startMinutes: 540, endMinutes: 600 },
        { startMinutes: 660, endMinutes: 780 },
        { startMinutes: 840, endMinutes: 1020 },
      ]);
    });

    it("returns base when subtracting empty", () => {
      const base: TimeRange[] = [{ startMinutes: 540, endMinutes: 720 }];
      expect(subtractRanges(base, [])).toEqual(base);
    });

    it("returns empty when base is empty", () => {
      const toSubtract: TimeRange[] = [{ startMinutes: 540, endMinutes: 720 }];
      expect(subtractRanges([], toSubtract)).toEqual([]);
    });
  });

  describe("addRanges", () => {
    it("combines and merges ranges", () => {
      const a: TimeRange[] = [{ startMinutes: 540, endMinutes: 720 }];
      const b: TimeRange[] = [{ startMinutes: 660, endMinutes: 840 }];
      expect(addRanges(a, b)).toEqual([{ startMinutes: 540, endMinutes: 840 }]);
    });
  });

  describe("intersectTwo", () => {
    it("finds intersection of overlapping ranges", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 720 };
      const b: TimeRange = { startMinutes: 600, endMinutes: 840 };
      expect(intersectTwo(a, b)).toEqual({ startMinutes: 600, endMinutes: 720 });
    });

    it("returns null for non-overlapping ranges", () => {
      const a: TimeRange = { startMinutes: 540, endMinutes: 600 };
      const b: TimeRange = { startMinutes: 720, endMinutes: 840 };
      expect(intersectTwo(a, b)).toBeNull();
    });
  });

  describe("intersectRanges", () => {
    it("finds all intersections", () => {
      const a: TimeRange[] = [
        { startMinutes: 540, endMinutes: 720 },
        { startMinutes: 840, endMinutes: 1020 },
      ];
      const b: TimeRange[] = [{ startMinutes: 600, endMinutes: 900 }];
      expect(intersectRanges(a, b)).toEqual([
        { startMinutes: 600, endMinutes: 720 },
        { startMinutes: 840, endMinutes: 900 },
      ]);
    });
  });

  describe("rangesToSlots", () => {
    it("expands range to 30-min slots", () => {
      const ranges: TimeRange[] = [{ startMinutes: 540, endMinutes: 660 }];
      const slots = rangesToSlots(ranges, "2024-01-15");
      expect(slots).toEqual([
        { date: "2024-01-15", time: "09:00" },
        { date: "2024-01-15", time: "09:30" },
        { date: "2024-01-15", time: "10:00" },
        { date: "2024-01-15", time: "10:30" },
      ]);
    });

    it("handles overnight ranges", () => {
      const ranges: TimeRange[] = [{ startMinutes: 1410, endMinutes: 1500 }];
      const slots = rangesToSlots(ranges, "2024-01-15");
      expect(slots).toEqual([
        { date: "2024-01-15", time: "23:30" },
        { date: "2024-01-16", time: "00:00" },
        { date: "2024-01-16", time: "00:30" },
      ]);
    });
  });

  describe("slotsToRanges", () => {
    it("groups consecutive slots into ranges", () => {
      // Each slot represents a 30-minute block
      // 09:00 = 09:00-09:30, 09:30 = 09:30-10:00, 10:00 = 10:00-10:30
      // So 3 consecutive slots from 09:00 end at 10:30 (630 minutes)
      const slots = [
        { date: "2024-01-15", time: "09:00" },
        { date: "2024-01-15", time: "09:30" },
        { date: "2024-01-15", time: "10:00" },
        { date: "2024-01-15", time: "14:00" },
        { date: "2024-01-15", time: "14:30" },
      ];
      const result = slotsToRanges(slots);
      expect(result.get("2024-01-15")).toEqual([
        { startMinutes: 540, endMinutes: 630 }, // 09:00-10:30 (3 slots)
        { startMinutes: 840, endMinutes: 900 }, // 14:00-15:00 (2 slots)
      ]);
    });
  });

  describe("totalMinutes", () => {
    it("calculates total minutes", () => {
      const ranges: TimeRange[] = [
        { startMinutes: 540, endMinutes: 720 },
        { startMinutes: 840, endMinutes: 960 },
      ];
      expect(totalMinutes(ranges)).toBe(300);
    });
  });

  describe("minuteInRanges", () => {
    it("returns true when minute is in range", () => {
      const ranges: TimeRange[] = [{ startMinutes: 540, endMinutes: 720 }];
      expect(minuteInRanges(600, ranges)).toBe(true);
    });

    it("returns false when minute is outside range", () => {
      const ranges: TimeRange[] = [{ startMinutes: 540, endMinutes: 720 }];
      expect(minuteInRanges(800, ranges)).toBe(false);
    });

    it("returns false at range end (exclusive)", () => {
      const ranges: TimeRange[] = [{ startMinutes: 540, endMinutes: 720 }];
      expect(minuteInRanges(720, ranges)).toBe(false);
    });
  });

  describe("clampToWindow", () => {
    it("clamps ranges to window", () => {
      const ranges: TimeRange[] = [{ startMinutes: 480, endMinutes: 1080 }];
      const result = clampToWindow(ranges, 540, 1020);
      expect(result).toEqual([{ startMinutes: 540, endMinutes: 1020 }]);
    });

    it("removes ranges outside window", () => {
      const ranges: TimeRange[] = [
        { startMinutes: 300, endMinutes: 480 },
        { startMinutes: 540, endMinutes: 720 },
      ];
      const result = clampToWindow(ranges, 540, 1020);
      expect(result).toEqual([{ startMinutes: 540, endMinutes: 720 }]);
    });
  });
});
