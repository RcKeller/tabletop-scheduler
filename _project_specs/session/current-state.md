<!--
CHECKPOINT RULES (from session-management.md):
- Quick update: After any todo completion
- Full checkpoint: After ~20 tool calls or decisions
- Archive: End of session or major feature complete

After each task, ask: Decision made? >10 tool calls? Feature done?
-->

# Current Session State

*Last updated: 2026-01-12*

## Active Task
Fixed timezone display bug where availability showed in UTC instead of user's local timezone.

## Current Status
- **Phase**: Bug fix complete
- **Progress**: All pages now default to browser timezone when localStorage is empty
- **Blocking Issues**: None

## Context Summary
Fixed bug where GM in Manila set availability 5pm-9pm but saw 9am-1pm (UTC times) on campaign page. Root cause: pages were defaulting to `event.timezone` when localStorage was empty, but if `event.timezone` was "UTC" or different from user's browser timezone, availability wouldn't be converted properly.

## Bug Analysis

### Symptoms
- GM sets 5pm-9pm Manila availability
- On campaign page, sees 9am-1pm displayed
- Calendar appears blank (cells don't match visible time window)

### Root Cause
When localStorage doesn't have a timezone preference:
- **Before**: Pages used `event.timezone` as default
- **Problem**: If `event.timezone` was "UTC" or different from browser timezone, `displayParticipants` conversion was skipped or wrong
- **Fix**: Default to `getBrowserTimezone()` when localStorage is empty

### The Fix
Changed timezone initialization in all three pages from:
```typescript
useEffect(() => {
  const stored = localStorage.getItem("when2play_timezone");
  if (stored) {
    setTimezoneState(stored);
  }
}, []);
```

To:
```typescript
useEffect(() => {
  const stored = localStorage.getItem("when2play_timezone");
  if (stored) {
    setTimezoneState(stored);
  } else {
    // Default to browser timezone, not event timezone
    const browserTz = getBrowserTimezone();
    setTimezoneState(browserTz);
    localStorage.setItem("when2play_timezone", browserTz);
  }
}, []);
```

## Files Modified
| File | Change |
|------|--------|
| `app/[campaign]/CampaignPage.tsx` | Default to browser timezone when localStorage empty |
| `app/[campaign]/gm-availability/GmAvailabilityPage.tsx` | Default to browser timezone when localStorage empty |
| `app/[campaign]/[player]/[[...method]]/PlayerAvailabilityPage.tsx` | Default to browser timezone when localStorage empty |

## Key Architecture Understanding

### Timezone Defaults (CORRECTED)
- **Initial state (SSR)**: `event.timezone` (for hydration consistency)
- **After hydration**:
  - If localStorage has value → use it
  - If localStorage empty → use `getBrowserTimezone()` and save to localStorage
- **User can override**: Via timezone selector on any page

### Why This Matters
Users expect to see times in THEIR local timezone by default, not the event creator's timezone. The previous behavior meant:
- Event created with `event.timezone = "UTC"`
- User in Manila opens page → timezone defaults to "UTC"
- `displayParticipants` skips conversion (since `timezone === "UTC"`)
- User sees UTC times, not their local times

## Next Steps
1. Test GM in Manila sets 5pm-9pm availability
2. Navigate to campaign page and verify 5pm-9pm is displayed (not 9am-1pm)
3. Test timezone switching works correctly
4. Verify localStorage persists timezone choice across pages

## Resume Instructions
To continue this work:
1. Run `npm run dev` and test the timezone fix
2. Key test: GM in Manila sets 5pm-9pm, should see 5pm-9pm on campaign page
3. Test switching timezones updates the display
