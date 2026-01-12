<!--
CHECKPOINT RULES (from session-management.md):
- Quick update: After any todo completion
- Full checkpoint: After ~20 tool calls or decisions
- Archive: End of session or major feature complete

After each task, ask: Decision made? >10 tool calls? Feature done?
-->

# Current Session State

*Last updated: 2026-01-13*

## Active Task
Availability system rip-and-replace refactor - implementing new rules-based architecture.

## Current Status
- **Phase**: Phase 2 (API Layer) - partial
- **Progress**: Phase 1 complete, new rules API ready, working on heatmap integration
- **Blocking Issues**: None

## What Was Completed This Session

### Phase 1: Foundation (COMPLETE)
- Created new availability types in `lib/types/availability.ts`
  - 4 rule types: `available_pattern`, `available_override`, `blocked_pattern`, `blocked_override`
  - TimeRange, DayAvailability, DisplaySlot, GridCellState types
  - API request/response types
  - Type guards for rule types

- Implemented `lib/availability/range-math.ts`
  - Time/minutes conversion utilities
  - Range operations: merge, subtract, add, intersect
  - Slot expansion: rangesToSlots, slotsToRanges
  - Window clamping for time bounds

- Implemented `lib/availability/timezone.ts`
  - localToUTC / utcToLocal conversions
  - convertPatternToUTC / convertPatternFromUTC (handles day-of-week shifts)
  - convertOverrideToUTC / convertOverrideFromUTC
  - Day of week and date range utilities

- Implemented `lib/availability/compute-effective.ts`
  - Core algorithm: computeEffectiveForDate, computeEffectiveRanges
  - Priority: blocked > available, override > pattern
  - Heatmap computation: computeHeatmap
  - Session finding: findOverlappingSlots, findSessionSlots

- Created comprehensive test suite (101 tests passing)
  - `__tests__/lib/availability/range-math.test.ts` (49 tests)
  - `__tests__/lib/availability/timezone.test.ts` (31 tests)
  - `__tests__/lib/availability/compute-effective.test.ts` (21 tests)

- Updated Prisma schema with new AvailabilityRule model
  - Added AvailabilityRuleType and RuleSource enums
  - Added AvailabilityRule model with all fields
  - Kept old tables for backward compatibility

### Phase 2: API Layer (PARTIAL)
- Created `/api/availability/[participantId]/rules` endpoint
  - GET: Fetch all rules for a participant
  - PUT: Replace all rules (full sync)
  - PATCH: Incremental add/remove rules

- Added new imports to heatmap API (for future use)

## Files Created/Modified

### New Files
- `lib/types/availability.ts` - New availability types
- `lib/availability/range-math.ts` - Range math utilities
- `lib/availability/timezone.ts` - Timezone conversion utilities
- `lib/availability/compute-effective.ts` - Core algorithm
- `lib/availability/index.ts` - Module exports
- `__tests__/lib/availability/*.test.ts` - Test files (3 files)
- `app/api/availability/[participantId]/rules/route.ts` - New rules API

### Modified Files
- `prisma/schema.prisma` - Added AvailabilityRule model
- `app/api/events/[slug]/heatmap/route.ts` - Added new imports

## Immediate Next Steps

1. **AI Parser Update**: Update `lib/ai/availability-parser.ts` to return new rule format
2. **TimezoneContext**: Create React context for global timezone state
3. **useDragSelection hook**: Implement drag selection logic
4. **UnifiedGrid component**: Build single grid implementation
5. **AvailabilityEditor**: Build unified GM/player editor

## Verification Commands

```bash
# Run all availability tests
NODE_OPTIONS="--max-old-space-size=8192" npm test -- __tests__/lib/availability --runInBand --no-coverage

# Type check
npx tsc --noEmit

# Validate Prisma schema
npx prisma validate
```

## Files to Review First When Resuming

1. `/Users/dev/.claude/plans/spicy-waddling-engelbart.md` - Full refactor plan
2. `lib/availability/index.ts` - Module exports
3. `lib/types/availability.ts` - Type definitions
4. `app/api/availability/[participantId]/rules/route.ts` - New API
