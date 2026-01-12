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
Fixed bug: Weekend availability patterns not showing when they span midnight in UTC.

## Current Status
- **Phase**: Bug fix complete, build verified
- **Progress**: All timezone bugs fixed
- **Blocking Issues**: None

## Bug Fixes Applied This Session

### Bug 4 (NEW): Weekend patterns not showing - midnight spanning
**Root Cause**: When a user sets availability like "Saturday 7am-9pm" in EST (UTC-5), the UTC conversion was:
- Saturday 7am EST → Saturday 12:00 UTC
- Saturday 9pm EST → Sunday 02:00 UTC

Old code stored this as: `{ dayOfWeek: 6, startTime: "12:00", endTime: "02:00" }`

When expanding, the loop checked `currentTime < slot.endTime`:
- "12:00" < "02:00" → false (string comparison fails!)
- Result: **No slots generated for weekend!**

**Fix Applied**:
1. `convertPatternToUTC()` now returns an **array** of patterns, splitting at midnight:
   - Pattern 1: `{ dayOfWeek: 6, startTime: "12:00", endTime: "24:00" }`
   - Pattern 2: `{ dayOfWeek: 0, startTime: "00:00", endTime: "02:00" }`
2. Frontend uses `.flatMap()` instead of `.map()` to handle the array
3. Heatmap API uses numeric time comparison with midnight detection

### Previous Fixes (earlier this session)

**Bug 1**: `page.tsx` - GM patterns treated as local instead of UTC
- Fixed: Convert patterns from UTC to GM timezone before bounds calculation

**Bug 2**: `GeneralAvailabilityEditor` - double timezone conversion
- Fixed: Removed redundant `utcToLocal()` call

**Bug 3**: `events/[slug]/route.ts` - same as Bug 1
- Fixed: Added pattern/slot conversion

## Files Modified
| File | Change |
|------|--------|
| `lib/utils/timezone.ts` | `convertPatternToUTC` returns array, splits at UTC midnight |
| `app/[campaign]/gm-availability/GmAvailabilityPage.tsx` | Use `.flatMap()` for pattern conversion |
| `app/[campaign]/[player]/[[...method]]/PlayerAvailabilityPage.tsx` | Use `.flatMap()` for pattern conversion |
| `app/api/events/[slug]/heatmap/route.ts` | Numeric time comparison with midnight detection |
| `app/[campaign]/[player]/[[...method]]/page.tsx` | Convert patterns from UTC to GM timezone |
| `app/api/events/[slug]/route.ts` | Convert patterns and slots from UTC to GM timezone |
| `components/availability/GeneralAvailabilityEditor.tsx` | Remove double conversion on time window |

## Verification
- TypeScript type check: ✓ Pass
- Production build: ✓ Pass

## Testing Instructions
1. Set timezone to America/New_York (EST, UTC-5)
2. Create recurring schedule: Saturday/Sunday 7am-9pm, Weekdays 2pm-9pm
3. Save and verify **both** weekend and weekday slots appear on the heatmap
4. Check that the patterns expand correctly for all days

## Note on Display Behavior
After this fix, a pattern like "Saturday 7am-9pm local" is stored as TWO patterns in DB:
- Saturday 12:00-24:00 UTC
- Sunday 00:00-02:00 UTC

When loaded back for display, these appear as two separate entries in GeneralAvailabilityEditor. Functionally correct but visually different from original input. Future improvement could track related patterns and merge for display.
