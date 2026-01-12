/**
 * New availability system types - rule-based architecture
 *
 * Key concepts:
 * - All times/days stored in UTC in the database
 * - Original timezone preserved for cross-timezone clarity
 * - Four rule types: available_pattern, available_override, blocked_pattern, blocked_override
 * - Range-based computation, slot expansion only at render time
 */

// Rule types - discriminator for the unified availability_rules table
export type AvailabilityRuleType =
  | "available_pattern" // Recurring weekly availability (e.g., "every Tuesday 6-10pm")
  | "available_override" // One-off date availability (e.g., "available Jan 15 6-10pm")
  | "blocked_pattern" // Recurring weekly block (e.g., "busy every Wednesday")
  | "blocked_override"; // One-off date block (e.g., "busy Jan 20 all day")

// Source of how the rule was created
export type RuleSource = "manual" | "ai" | "import";

/**
 * Database record for availability rules (always stored in UTC)
 */
export interface AvailabilityRule {
  id: string;
  participantId: string;
  ruleType: AvailabilityRuleType;

  // For patterns: day of week in UTC (0=Sunday, 6=Saturday)
  // For overrides: null
  dayOfWeek: number | null;

  // For overrides: specific date in UTC (YYYY-MM-DD)
  // For patterns: null
  specificDate: string | null;

  // Time range in UTC (HH:MM format)
  startTime: string;
  endTime: string;

  // Preserve user intent for cross-timezone display
  originalTimezone: string; // IANA timezone (e.g., "Asia/Tokyo")
  originalDayOfWeek: number | null; // What day the user selected in their timezone

  // Metadata
  reason: string | null;
  source: RuleSource;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new rule (without id and audit fields)
 */
export interface CreateAvailabilityRuleInput {
  participantId: string;
  ruleType: AvailabilityRuleType;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  originalTimezone: string;
  originalDayOfWeek: number | null;
  reason?: string | null;
  source?: RuleSource;
}

/**
 * Time range representation (used in algorithm)
 */
export interface TimeRange {
  startMinutes: number; // Minutes from midnight (0-1439)
  endMinutes: number; // Minutes from midnight, can exceed 1440 for overnight
}

/**
 * Effective availability for a specific date (output of computation)
 */
export interface DayAvailability {
  date: string; // YYYY-MM-DD
  availableRanges: TimeRange[];
  blockedRanges: TimeRange[];
}

/**
 * Display slot for UI rendering (converted to user's timezone)
 */
export interface DisplaySlot {
  date: string; // YYYY-MM-DD in display timezone
  time: string; // HH:MM in display timezone
  status: "available" | "unavailable" | "pending-add" | "pending-remove";
  sourceRuleId?: string; // Reference to the rule that created this slot
}

/**
 * Grid cell state for the availability editor
 */
export interface GridCellState {
  date: string;
  time: string;
  isAvailable: boolean;
  isBlocked: boolean;
  isPendingAdd: boolean;
  isPendingRemove: boolean;
  sourceRuleIds: string[];
}

/**
 * Date range for queries
 */
export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/**
 * Heatmap cell for combined availability view
 */
export interface HeatmapCellData {
  date: string;
  time: string;
  availableCount: number;
  availableParticipantIds: string[];
  totalParticipants: number;
}

/**
 * Sparse heatmap representation (only cells with data)
 */
export type SparseHeatmap = Map<string, HeatmapCellData>; // key: "YYYY-MM-DD|HH:MM"

/**
 * API request/response types
 */

// GET /api/availability/[participantId]/rules
export interface GetRulesResponse {
  rules: AvailabilityRule[];
  participantId: string;
}

// PUT /api/availability/[participantId]/rules (full replace)
export interface ReplaceRulesRequest {
  rules: CreateAvailabilityRuleInput[];
}

// PATCH /api/availability/[participantId]/rules (incremental)
export interface PatchRulesRequest {
  add?: CreateAvailabilityRuleInput[];
  remove?: string[]; // Rule IDs to remove
}

// GET /api/events/[slug]/heatmap
export interface HeatmapResponse {
  cells: HeatmapCellData[];
  participants: {
    id: string;
    displayName: string;
    isGm: boolean;
  }[];
  dateRange: DateRange;
  timezone: string; // Event timezone for reference
}

/**
 * Helper type guards
 */
export function isPatternRule(
  rule: AvailabilityRule
): rule is AvailabilityRule & { dayOfWeek: number } {
  return (
    rule.ruleType === "available_pattern" ||
    rule.ruleType === "blocked_pattern"
  );
}

export function isOverrideRule(
  rule: AvailabilityRule
): rule is AvailabilityRule & { specificDate: string } {
  return (
    rule.ruleType === "available_override" ||
    rule.ruleType === "blocked_override"
  );
}

export function isAvailableRule(rule: AvailabilityRule): boolean {
  return (
    rule.ruleType === "available_pattern" ||
    rule.ruleType === "available_override"
  );
}

export function isBlockedRule(rule: AvailabilityRule): boolean {
  return (
    rule.ruleType === "blocked_pattern" || rule.ruleType === "blocked_override"
  );
}

/**
 * Constants
 */
export const MINUTES_PER_DAY = 24 * 60; // 1440
export const SLOT_DURATION_MINUTES = 30;
export const SLOTS_PER_DAY = MINUTES_PER_DAY / SLOT_DURATION_MINUTES; // 48

/**
 * Helper to create heatmap key
 */
export function heatmapKey(date: string, time: string): string {
  return `${date}|${time}`;
}

/**
 * Helper to parse heatmap key
 */
export function parseHeatmapKey(key: string): { date: string; time: string } {
  const [date, time] = key.split("|");
  return { date, time };
}
