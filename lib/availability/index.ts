/**
 * Availability module - unified exports
 *
 * This module provides all the utilities needed for the availability system:
 * - Types and interfaces
 * - Range math operations
 * - Timezone conversions
 * - Core computation algorithm
 */

// Types
export type {
  AvailabilityRuleType,
  RuleSource,
  AvailabilityRule,
  CreateAvailabilityRuleInput,
  TimeRange,
  DayAvailability,
  DisplaySlot,
  GridCellState,
  DateRange,
  HeatmapCellData,
  SparseHeatmap,
  GetRulesResponse,
  ReplaceRulesRequest,
  PatchRulesRequest,
  HeatmapResponse,
} from "../types/availability";

export {
  isPatternRule,
  isOverrideRule,
  isAvailableRule,
  isBlockedRule,
  heatmapKey,
  parseHeatmapKey,
  MINUTES_PER_DAY,
  SLOT_DURATION_MINUTES,
  SLOTS_PER_DAY,
} from "../types/availability";

// Range math
export {
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
} from "./range-math";

// Timezone
export {
  localToUTC,
  utcToLocal,
  convertPatternToUTC,
  convertPatternFromUTC,
  convertPatternBetweenTimezones,
  convertOverrideToUTC,
  convertOverrideFromUTC,
  convertRuleForDisplay,
  prepareRuleForStorage,
  getUTCDayOfWeek,
  getLocalDayOfWeek,
  getDateRange,
  getBrowserTimezone,
  COMMON_TIMEZONES,
  getTimezoneAbbr,
  DAY_NAMES,
  DAY_NAMES_SHORT,
} from "./timezone";

// Core algorithm
export {
  computeEffectiveForDate,
  computeEffectiveRanges,
  isSlotAvailable,
  computeHeatmap,
  findOverlappingSlots,
  findSessionSlots,
} from "./compute-effective";
