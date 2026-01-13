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
**COMPLETED**: Availability system UI simplification and fixes

## Current Status
- **Phase**: Complete - unified grid system, pattern editor, AI parsing fixed
- **Progress**: 100% complete
- **Blocking Issues**: None

## What Was Completed

### New Availability System
- New `availability_rules` table with 4 rule types
- UTC-first storage with original timezone preservation
- Range-based computation algorithm (O(rules × days))
- 101 unit tests passing

### API Updates
- `/api/availability/[participantId]/rules` - new rules API (GET/PUT/PATCH)
- `/api/availability/parse` - server-side AI parsing API (fixes ANTHROPIC_API_KEY error)
- `/api/events/[slug]/heatmap` - updated to use new rules
- `/api/events/[slug]` - updated to use new rules for GM bounds

### UI Components (Simplified)
- `TimezoneContext.tsx` - global timezone state
- `useDragSelection.ts` - drag selection hook
- `useAvailabilityRules.ts` - rules data fetching hook
- `VirtualizedAvailabilityGrid.tsx` - **SINGLE grid component** (AG Grid-based, working drag selection)
- `AvailabilityEditor.tsx` - unified editor with:
  - Calendar View tab (using VirtualizedAvailabilityGrid with auto-save)
  - Recurring Schedule tab (pattern editor with day selection, time dropdowns)
  - AI natural language input
  - Timezone selector
- Unified `/[campaign]/availability` page with `?role=gm` or `?role=player&id=xxx`

### Removed (Simplification)
- `UnifiedGrid.tsx` - removed broken custom grid (had coordinate calculation bugs)
- `GeneralAvailabilityEditor.tsx` - pattern editor merged into AvailabilityEditor

### Removed (Old System)
**Database Tables Dropped:**
- `availability` (162 rows)
- `availability_exceptions` (394 rows)
- `general_availability` (229 rows)

**Files Removed:**
- `app/api/availability/[participantId]/route.ts`
- `app/api/events/[slug]/availability/route.ts`
- `app/[campaign]/gm-availability/GmAvailabilityPage.tsx`
- `app/[campaign]/[player]/[[...method]]/PlayerAvailabilityPage.tsx`
- `components/availability/AvailabilityAI.tsx`
- `components/availability/AvailabilitySection.tsx`
- `components/availability/GeneralAvailabilityEditor.tsx`
- `components/availability/AvailabilityGrid.tsx`
- `lib/utils/overlap.ts`
- `lib/utils/availability-expander.ts`
- `lib/utils/availability-priority.ts`
- `lib/utils/gm-availability.ts`
- `scripts/migrate-availability-rules.ts`

### Legacy Routes (Redirect Only)
- `/[campaign]/gm-availability` → redirects to `/[campaign]/availability?role=gm`
- `/[campaign]/[player]/[[...method]]` → redirects to `/[campaign]/availability?role=player&id=xxx`

## Files Still in Use

These utility files are still used by remaining components:
- `lib/utils/timezone.ts` - used by VirtualizedAvailabilityGrid, CampaignPage, etc.
- `lib/utils/time-slots.ts` - used by VirtualizedAvailabilityGrid, CombinedHeatmap
- `lib/utils/timezones.ts` - used by parse route

These could be consolidated with `lib/availability/` in a future cleanup.

## Key Architecture

1. **Single table**: `availability_rules` with 4 rule types
2. **UTC storage**: All times in UTC, original timezone preserved
3. **Range-based**: Computation happens on ranges, slot expansion at render time
4. **Priority**: blocked_override > blocked_pattern > available_override > available_pattern
5. **Unified page**: `/[campaign]/availability` serves both GM and players

## Verification

```bash
# All tests pass
NODE_OPTIONS="--max-old-space-size=8192" npm test -- --runInBand
# Output: 101 passed

# Type check passes
npx tsc --noEmit

# Build succeeds
npm run build
```
