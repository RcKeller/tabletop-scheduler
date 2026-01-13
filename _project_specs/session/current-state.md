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
**COMPLETED**: Availability system rip-and-replace refactor

## Current Status
- **Phase**: All phases complete
- **Progress**: Full implementation done, data migrated, build passing
- **Blocking Issues**: None

## What Was Completed

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

### Phase 2: API Layer (COMPLETE)
- Created `/api/availability/[participantId]/rules` endpoint
  - GET: Fetch all rules for a participant
  - PUT: Replace all rules (full sync)
  - PATCH: Incremental add/remove rules

- Updated AI parser with `convertToRules()` and `parseAvailabilityWithRules()`

### Phase 3: UI Components (COMPLETE)
- Created `components/availability/TimezoneContext.tsx` - Global timezone state
- Created `lib/hooks/useDragSelection.ts` - Drag selection hook
- Created `lib/hooks/useAvailabilityRules.ts` - Rules data fetching hook
- Created `components/availability/UnifiedGrid.tsx` - Main grid component
- Created `components/availability/AvailabilityEditor.tsx` - Unified editor component
- Created `app/[campaign]/availability/page.tsx` - Server component
- Created `app/[campaign]/availability/AvailabilityPageClient.tsx` - Client component

### Phase 4: Migration & Cleanup (COMPLETE)
- Created `scripts/migrate-availability-rules.ts` - Data migration script
- Ran migration: 778 rules created from 44 participants
  - 213 available patterns
  - 162 available overrides
  - 9 blocked patterns
  - 394 blocked overrides

## Files Created/Modified

### New Files
- `lib/types/availability.ts` - New availability types
- `lib/availability/range-math.ts` - Range math utilities
- `lib/availability/timezone.ts` - Timezone conversion utilities
- `lib/availability/compute-effective.ts` - Core algorithm
- `lib/availability/index.ts` - Module exports
- `__tests__/lib/availability/*.test.ts` - Test files (3 files, 101 tests)
- `app/api/availability/[participantId]/rules/route.ts` - New rules API
- `components/availability/TimezoneContext.tsx` - Timezone context
- `lib/hooks/useDragSelection.ts` - Drag selection hook
- `lib/hooks/useAvailabilityRules.ts` - Rules fetching hook
- `components/availability/UnifiedGrid.tsx` - Unified grid
- `components/availability/AvailabilityEditor.tsx` - Unified editor
- `app/[campaign]/availability/page.tsx` - Unified availability page
- `app/[campaign]/availability/AvailabilityPageClient.tsx` - Client component
- `scripts/migrate-availability-rules.ts` - Migration script

### Modified Files
- `prisma/schema.prisma` - Added AvailabilityRule model and enums
- `lib/ai/availability-parser.ts` - Added convertToRules, parseAvailabilityWithRules

## Verification Commands

```bash
# Run all availability tests
NODE_OPTIONS="--max-old-space-size=8192" npm test -- --runInBand

# Type check
npx tsc --noEmit

# Build
npm run build
```

## Key Architecture Decisions

1. **UTC-first storage**: All times stored in UTC, original timezone preserved for display
2. **Four rule types**: available_pattern, available_override, blocked_pattern, blocked_override
3. **Range-based computation**: O(rules × days) not O(rules × days × slots)
4. **Priority system**: blocked_override > blocked_pattern > available_override > available_pattern
5. **Unified route**: `/[campaign]/availability` with `?role=gm` or `?role=player&id=xxx`

## Remaining Work (Optional Cleanup)

If desired in future sessions:
1. Remove old files: `AvailabilityGrid.tsx`, `VirtualizedAvailabilityGrid.tsx`, old utilities
2. Remove old database tables after verifying migration
3. Update heatmap API to use new algorithm
4. Add component tests for UnifiedGrid and AvailabilityEditor
