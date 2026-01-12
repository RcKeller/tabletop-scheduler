# Timezone Architecture

## Core Principles

### 1. Database Storage: ALL Times in UTC
- **Specific availability slots**: Stored in **UTC**
- **Recurring patterns (GeneralAvailability)**: Stored in **UTC** (converted at save time, dayOfWeek may shift)
- **Exceptions**: Stored in **UTC**
- **Event time window**: Calculated dynamically from GM availability

### 2. Frontend Display: User's Selected Timezone
All times displayed to users are converted to their selected timezone.

- Default timezone: Browser's local timezone (detected automatically)
- User can change timezone via `TimezoneAutocomplete` component
- Selected timezone persists in `localStorage` as `when2play_timezone`

### 3. Conversion Boundaries
Timezone conversion happens at clear boundaries:

```
Availability Data (specific dates):
  User Input (local) → localToUTC() → API/Database (UTC)
  Database (UTC) → utcToLocal() → Display (local)

Recurring Patterns (dayOfWeek based):
  User Input (local) → convertPatternToUTC() → API/Database (UTC)
  Database (UTC) → convertPatternFromUTC() → Display (local)
  Note: dayOfWeek may shift when converting (e.g., Monday 1am Manila = Sunday 5pm UTC)

Time Windows:
  Calculated from GM's UTC availability → utcToLocal() → Display in viewer's timezone
```

---

## Component Responsibilities

### Calendar Grid Components

**Props:**
- `availability: TimeSlot[]` - Availability data in **UTC**
- `timezone: string` - User's display timezone
- `earliestTime: string` - Y-axis start time (in `timeWindowTimezone` if provided)
- `latestTime: string` - Y-axis end time (in `timeWindowTimezone` if provided)
- `timeWindowTimezone?: string` - Source timezone of time window; if provided and different from `timezone`, converts to user's timezone

**Behavior:**
1. Convert `availability` from UTC to user's timezone for display
2. If `timeWindowTimezone` is provided:
   - Convert `earliestTime`/`latestTime` from `timeWindowTimezone` to `timezone`
3. If `timeWindowTimezone` is NOT provided:
   - Use `earliestTime`/`latestTime` as-is (already in user's local timezone)
4. When saving, convert local selections back to UTC

### Usage Patterns

#### GM Availability Page
- **Time Window:** Full 24 hours in local time
- **Props:** `earliestTime="00:00"` `latestTime="23:30"` (no `timeWindowTimezone`)
- **Why:** GM sees full day, times are already local

#### Campaign/Heatmap Page
- **Time Window:** Event's configured time window
- **Props:** `earliestTime={event.earliestTime}` `latestTime={event.latestTime}` `timeWindowTimezone={event.timezone}`
- **Why:** Event times stored in event's timezone, need conversion to viewer's timezone

#### Player Availability Page
- **Time Window:** GM's availability bounds (clamped)
- **Props:** Pre-converted `earliestTime`/`latestTime` from GM's timezone to player's timezone (no `timeWindowTimezone`)
- **Why:** Conversion happens in `convertedGmBounds` before passing to grid

---

## Data Flow Examples

### Example 1: GM Sets Availability (PST timezone)
1. GM selects 6pm-9pm on the grid (displayed in PST)
2. Grid tracks selection in local PST format
3. `onSave` is called with local times
4. Page converts to UTC: `localToUTC("18:00", "2024-01-15", "America/Los_Angeles")`
5. Result: `{ date: "2024-01-16", time: "02:00" }` (next day in UTC)
6. API saves UTC times to database

### Example 2: Player Views GM Availability (EST timezone)
1. Database has UTC: `{ date: "2024-01-16", startTime: "02:00", endTime: "05:00" }`
2. API returns UTC data with `gmTimezone: "America/Los_Angeles"`
3. VirtualizedAvailabilityGrid converts UTC → EST: 9pm-12am EST
4. Player sees availability in their local timezone

### Example 3: Event Time Window Display
1. Event created in PST with `earliestTime="09:00"`, `latestTime="21:00"`, `timezone="America/Los_Angeles"`
2. Player in EST views campaign page
3. Grid receives: `earliestTime="09:00"` `latestTime="21:00"` `timeWindowTimezone="America/Los_Angeles"` `timezone="America/New_York"`
4. Grid converts: 9am PST → 12pm EST, 9pm PST → 12am EST
5. Y-axis shows 12pm-12am EST

### Example 4: GM Bounds Clamping for Players
1. GM availability bounds calculated: `earliest="17:00"` `latest="21:00"` in GM's timezone (PST)
2. Server passes to client with `gmTimezone="America/Los_Angeles"`
3. PlayerAvailabilityPage converts to player's timezone (EST): 8pm-12am
4. Grid receives pre-converted local times, no `timeWindowTimezone` needed

---

## Utility Functions

Located in `lib/utils/timezone.ts`:

```typescript
// Convert local time to UTC (for saving specific date slots)
localToUTC(time: string, date: string, fromTz: string): { date: string; time: string }

// Convert UTC to local time (for display)
utcToLocal(time: string, date: string, toTz: string): { date: string; time: string }

// Convert between any two timezones
convertDateTime(time: string, date: string, fromTz: string, toTz: string): { date: string; time: string }

// Convert recurring pattern from local timezone to UTC (for saving patterns)
// Handles dayOfWeek shift when crossing midnight
convertPatternToUTC(dayOfWeek: number, startTime: string, endTime: string, fromTz: string):
  { dayOfWeek: number; startTime: string; endTime: string }

// Convert recurring pattern from UTC to local timezone (for display)
convertPatternFromUTC(dayOfWeek: number, startTime: string, endTime: string, toTz: string):
  { dayOfWeek: number; startTime: string; endTime: string }
```

**Important:** All functions handle date/day changes when crossing midnight.

---

## API Endpoints Summary

| Endpoint | Input Timezone | Output Timezone |
|----------|---------------|-----------------|
| `PUT /api/availability/[id]` | `availability` in UTC | - |
| `GET /api/availability/[id]` | - | `effectiveAvailability` in UTC |
| `GET /api/events/[slug]/heatmap` | - | All availability in UTC |
| `GET /api/events/[slug]` | - | `gmAvailabilityBounds` in GM's timezone |

---

## Common Mistakes to Avoid

1. **Using participant.timezone for data interpretation** - This field is deprecated. All data is stored in UTC.
2. **Assuming time window timezone** - Time bounds are calculated from GM's UTC availability
3. **Double conversion** - Don't convert times that are already in the target timezone
4. **Forgetting midnight/day crossing** - Timezone conversion can shift dates AND days of week
5. **Mixing timezones in comparisons** - Always compare times in the same timezone
6. **Forgetting to convert patterns on save** - Frontend MUST call `convertPatternToUTC()` before API calls
7. **Forgetting to convert patterns on load** - Frontend MUST call `convertPatternFromUTC()` for display

---

## Key Files

| Component | Location | Notes |
|-----------|----------|-------|
| Timezone utilities | `lib/utils/timezone.ts` | `localToUTC`, `utcToLocal`, `convertDateTime` |
| VirtualizedAvailabilityGrid | `components/availability/VirtualizedAvailabilityGrid.tsx` | Main calendar grid |
| CombinedHeatmap | `components/heatmap/CombinedHeatmap.tsx` | Group availability view |
| GM Availability Page | `app/[campaign]/gm-availability/GmAvailabilityPage.tsx` | GM sets availability |
| Player Availability Page | `app/[campaign]/[player]/[[...method]]/PlayerAvailabilityPage.tsx` | Player sets availability |
| Campaign Page | `app/[campaign]/CampaignPage.tsx` | Heatmap view |
| Heatmap API | `app/api/events/[slug]/heatmap/route.ts` | Returns UTC availability |

---

## Testing Timezone Behavior

When testing timezone features:
1. Test with timezone ahead of UTC (e.g., Tokyo +9)
2. Test with timezone behind UTC (e.g., Los Angeles -8)
3. Test timezone changes mid-session
4. Test slots that cross midnight when converted
5. Test GM in one timezone, players in different timezones
6. Test the full flow: GM sets availability → player views clamped to GM bounds
