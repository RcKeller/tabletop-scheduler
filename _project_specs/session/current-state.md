<!--
CHECKPOINT RULES (from session-management.md):
- Quick update: After any todo completion
- Full checkpoint: After ~20 tool calls or decisions
- Archive: End of session or major feature complete

After each task, ask: Decision made? >10 tool calls? Feature done?
-->

# Current Session State

*Last updated: 2026-01-14*

## Completed Tasks

### 1. Fixed Recurring Availability Pattern Bug (Overnight UTC)
**Problem**: When a pattern like "7am-9am Manila (UTC+8)" crosses midnight in UTC (23:00-01:00), the overnight split was creating gaps.

**Solution**:
- Use `"24:00"` to represent "end of day" instead of `"23:30"`
- Updated timezone conversion functions to handle `"24:00"` as `"00:00 of next day"`
- Added `mergeAdjacentSlots()` function to combine adjacent slots after conversion

### 2. Enhanced VirtualizedAvailabilityGrid
**New props:**
- `gmAvailability` - GM's availability for visual indication (blue border)
- `disabled` - Prevents drag interactions (view-only mode)
- `compact` - Smaller cell sizes (row: 18px, col: 32px)

**Visual:** Blue 2px inset border on cells where GM is available

### 3. Fixed Pattern Save Bug (Manual Entries Disappearing)
**Problem**: When saving recurring patterns, manual calendar entries (from drag-select) would disappear.

**Root Cause**: `savePatterns` was reading override rules from `effectiveRules`, but `effectiveRules` wasn't updated after grid saves (due to `skipRefetch=true`).

**Solution**:
- Added `localOverrideSlots` state to track grid slots locally
- When grid saves, store the slots in `localOverrideSlots`
- When patterns save, use `localOverrideSlots` instead of stale `effectiveRules`

### 4. Immediate Auto-Save for All Changes
**Problem**: User had to click "Save Schedule" after changing patterns.

**Solution**:
- Handlers call `debouncedSavePatterns()` directly when patterns change
- Removed "Save Schedule" button
- Shows "Saving..." / "Saved" status indicator instead
- Grid already had `autoSave={true}`

### 5. Fixed Auto-Save Infinite Loop Bug
**Problem**: Auto-save using useEffect caused infinite loop (page refreshing and saving repeatedly).

**Root Cause**: Initial implementation used a `useEffect` that watched `patternEntries`. When patterns saved, the server response updated `effectiveRules`, which re-extracted patterns, which triggered the effect again.

**Solution**:
- Removed the problematic `useEffect`
- Pattern handlers now call `debouncedSavePatterns()` directly
- Reordered hook definitions so `savePatterns` and `debouncedSavePatterns` are defined BEFORE handlers that use them

### 6. Fixed Pattern Save Stale Closure Bug
**Problem**: Adding patterns would flash and disappear immediately.

**Root Cause**: Debounced save used stale closure - `savePatterns` captured old `patternEntries` state. Also, useEffect was overwriting local state from server response.

**Solution**:
- Added refs (`patternEntriesRef`, `localOverrideSlotsRef`) to track latest state
- Added `isUserEditingRef` to prevent useEffect from overwriting during edits
- `savePatterns` now reads from refs instead of state closure
- `patternsInitializedRef` prevents re-initialization after first load

### 7. Added Comprehensive Pattern Tests
Added 25 new tests in `__tests__/components/availability/pattern-editor.test.ts`:
- Timezone conversion tests (Manila, LA, India, Nepal)
- Round-trip conversion verification
- Effective availability computation
- Blocked patterns priority
- Override behavior
- Timezone switching scenarios
- Regression tests for known bugs

### 8. Created Shared Navbar with Timezone Selector
**Problem**: Timezone selector was duplicated across pages, inconsistent navigation.

**Solution**:
- Created `TimezoneProvider` context (`components/layout/TimezoneProvider.tsx`)
- Created `Navbar` component (`components/layout/Navbar.tsx`)
- Created campaign layout (`app/[campaign]/layout.tsx`, `CampaignLayoutClient.tsx`)
- Added `compact` mode to `TimezoneAutocomplete`
- Updated `AvailabilityEditor` and `CampaignPage` to use shared context
- Navbar is sticky with campaign navigation links

## Files Modified This Session

- `components/availability/AvailabilityEditor.tsx`:
  - Added `localOverrideSlots` state + refs for stale closure fix
  - Added `isUserEditingRef` to prevent state overwrite during edits
  - `savePatterns` uses refs instead of state closure
  - Handlers call `debouncedSavePatterns()` directly (no useEffect)
  - Uses shared `useTimezone()` context instead of local state
  - Removed inline TimezoneAutocomplete

- `components/availability/VirtualizedAvailabilityGrid.tsx`:
  - Added `gmAvailability`, `disabled`, `compact` props
  - Added blue border for GM available times
  - Added compact mode sizing
  - Fixed overnight slot handling ("24:00")
  - Added `mergeAdjacentSlots()` function

- `components/layout/TimezoneProvider.tsx` (NEW):
  - Global timezone context with localStorage persistence

- `components/layout/Navbar.tsx` (NEW):
  - Sticky navbar with campaign navigation
  - Compact timezone selector

- `components/timezone/TimezoneAutocomplete.tsx`:
  - Added `compact` prop for smaller navbar variant

- `app/[campaign]/layout.tsx` (NEW):
  - Campaign layout with navbar

- `app/[campaign]/CampaignLayoutClient.tsx` (NEW):
  - Client wrapper for navbar

- `app/[campaign]/CampaignPage.tsx`:
  - Uses shared `useTimezone()` context
  - Removed inline TimezoneAutocomplete

- `app/layout.tsx`:
  - Wrapped with `TimezoneProvider`

- `__tests__/components/availability/pattern-editor.test.ts` (NEW):
  - 25 comprehensive pattern tests

## Test Results
- **132 tests pass** (25 new pattern tests added)
- Type checks pass (`npx tsc --noEmit`)

### 9. Fixed Timezone Conversion Causing >24hr Availability Display
**Problem**: When 24-hour availability set in Manila (UTC+8) was viewed in PST (UTC-8), it showed >24 hours spanning into the next day.

**Root Cause**: `createRange()` in `range-math.ts` used time comparison (`end < start`) to detect overnight ranges, but this heuristic failed when timezone conversion naturally produced inverted times from a same-day range.

Example: Manila Tuesday 00:00-23:30 → UTC Monday 16:00 to Tuesday 15:30
- `createRange("16:00", "15:30")` sees 15:30 < 16:00
- Incorrectly assumed overnight, added 1440 minutes
- Created ~39 hour range instead of ~24 hours

**Solution**:
1. Added `crossesMidnight` boolean field to track original user intent
2. Updated `convertPatternToUTC()` and `convertOverrideToUTC()` to return this flag
3. Updated `createRange()` to accept explicit flag:
   - `true` = overnight range (add 1440)
   - `false` = same-day range (never add 1440)
   - `undefined` = legacy inference (backward compatible)
4. Changed "all day" from "00:00-23:30" to "00:00-24:00" throughout
5. Updated all grid components to use "24:00" for full day display

**Files Modified**:
- `lib/types/availability.ts` - Added `crossesMidnight` field
- `prisma/schema.prisma` - Added `crossesMidnight` column
- `lib/availability/timezone.ts` - Return `crossesMidnight` from converters
- `lib/availability/range-math.ts` - Accept explicit flag in `createRange()`
- `lib/availability/compute-effective.ts` - Pass flag through
- `lib/ai/availability-parser.ts` - Use "24:00" for all day
- `lib/utils/time-slots.ts` - Handle "24:00" parsing
- `app/api/availability/*/route.ts` - Include field in queries
- `app/api/events/[slug]/heatmap/route.ts` - Include field in mappings
- `components/availability/*.tsx` - Use "24:00" for full day
- `__tests__/lib/availability/timezone.test.ts` - Updated for new return format

**Migration Required**:
Run `_project_specs/migrations/add-crosses-midnight.sql` in Vercel Postgres Dashboard

## Test Results
- **137 tests pass** (all passing)
- Type checks pass (`npx tsc --noEmit`)

## Next Steps
1. Run database migration in Vercel Dashboard
2. Deploy and test in production
