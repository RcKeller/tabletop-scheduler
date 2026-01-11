# When2Play - Product Requirements

## Overview

When2Play is a scheduling application for tabletop RPG groups (D&D, Pathfinder, etc.) that helps coordinate availability across multiple players in different timezones.

---

## Timezone Handling

### CRITICAL: UTC-First Architecture

> **RULE: ALL times in the database are in UTC. NO EXCEPTIONS.**
>
> The ONLY place local timezone exists is in the UI display layer.
> When writing code, if you're not sure whether a time is UTC or local, it's UTC.

### The Golden Rules

1. **Database = UTC ONLY** - Every time stored is UTC
2. **API requests/responses = UTC** - All times sent to/from APIs are UTC
3. **Frontend display = Local** - Convert UTC → Local only for showing to users
4. **Frontend input = Convert immediately** - User inputs local time → convert to UTC before sending to API

### Why This Matters

Without strict UTC discipline:
- User in NYC sets "5pm" (stored as "17:00")
- User in Manila sees "5pm" but it's actually 5am their time
- Scheduling becomes impossible across timezones

With UTC:
- User in NYC sets "5pm" → converted to "22:00 UTC" (winter) → stored
- User in Manila sees "6am" (correct local equivalent)
- Everyone sees the SAME moment in time, displayed in their local timezone

### Data Flow

```
USER INPUT (local timezone)
    │
    ├─── User types "5:00 PM" in Manila (UTC+8)
    │
    ▼
┌─────────────────────────────────────────┐
│  localToUTC("17:00", "2026-01-15", tz)  │
│  Result: { date: "2026-01-15", time: "09:00" }
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  API / Database                          │
│  Stored: date=2026-01-15, time=09:00    │  ← ALWAYS UTC
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  utcToLocal("09:00", "2026-01-15", tz)  │
│  Result: { date: "2026-01-15", time: "17:00" }
└─────────────────────────────────────────┘
    │
    ▼
USER DISPLAY (local timezone)
    │
    └─── User sees "5:00 PM" in their timezone
```

### Database Storage - ALL UTC

| Table.Field | Format | Timezone | Notes |
|-------------|--------|----------|-------|
| `Availability.date` | Date | **UTC** | Specific date availability |
| `Availability.startTime` | "HH:MM" | **UTC** | |
| `Availability.endTime` | "HH:MM" | **UTC** | |
| `AvailabilityException.date` | Date | **UTC** | Blocked times |
| `AvailabilityException.startTime` | "HH:MM" | **UTC** | |
| `AvailabilityException.endTime` | "HH:MM" | **UTC** | |
| `Event.startDate` | Date | **UTC** | Campaign date range |
| `Event.endDate` | Date | **UTC** | |
| `Event.earliestTime` | "HH:MM" | **UTC** | Daily time window |
| `Event.latestTime` | "HH:MM" | **UTC** | |
| `GeneralAvailability.dayOfWeek` | 0-6 | **Local context** | See note below |
| `GeneralAvailability.startTime` | "HH:MM" | **Local context** | See note below |
| `GeneralAvailability.endTime` | "HH:MM" | **Local context** | See note below |

#### Special Case: GeneralAvailability (Recurring Patterns)

Recurring patterns are stored in the user's local timezone context because:

1. "Monday 5pm" means Monday evening in the user's life
2. Converting dayOfWeek to UTC could shift the day (Monday 1am Manila = Sunday 5pm UTC)
3. This would confuse users - they'd see "Sunday" for what they think of as "Monday"

**How it works:**
- Pattern stored: `{ dayOfWeek: 1 (Monday), startTime: "17:00", endTime: "21:00" }`
- This means "Every Monday 5-9pm in the user's timezone"
- When expanded to specific dates, the API converts to UTC:
  - Find Monday Jan 13, 2026
  - Create slot: "2026-01-13 17:00-21:00" (local)
  - Convert to UTC: "2026-01-13 09:00-13:00" (for UTC+8 user)

**IMPORTANT:** The `timezone` query parameter MUST be passed to the availability API so patterns can be correctly converted to UTC during expansion.

### API Contracts - ALL UTC

**GET /api/availability/[participantId]?timezone=X**
- Query param `timezone`: User's timezone (required for pattern expansion)
- Returns: `effectiveAvailability` - ALL times in UTC

**PUT /api/availability/[participantId]**
- Body `availability`: Array with times in **UTC**
- Body `exceptions`: Array with times in **UTC**
- Body `generalAvailability`: Array with times in **local context** (for recurring patterns)
- Body `timezone`: User's timezone (stored for heatmap calculations)

**GET /api/events/[slug]**
- Returns: `earliestTime`, `latestTime` in **UTC**

**GET /api/events/[slug]/heatmap**
- Returns: All availability data in **UTC**
- Heatmap calculations done in UTC

### Frontend Components

| Component | Receives | Displays | Sends |
|-----------|----------|----------|-------|
| VirtualizedAvailabilityGrid | UTC | Local (converted) | UTC |
| CombinedHeatmap | UTC | Local (converted) | N/A |
| GeneralAvailabilityEditor | Local patterns | Local | Local patterns |
| TimeWindowSelector | UTC | Local (converted) | UTC |

### Common Bugs to Avoid

1. **Comparing UTC times with local times** - Always convert to same timezone first
2. **Forgetting to pass timezone param** - Pattern expansion needs user's timezone
3. **Double-converting** - If data is already UTC, don't convert again
4. **Storing local times** - Never store local times in the database (except GeneralAvailability)
5. **Displaying UTC directly** - Always convert to local before showing to users

### Timezone Utility Functions (`lib/utils/timezone.ts`)

```typescript
// Convert user's local input to UTC for storage
localToUTC(time: string, date: string, fromTz: string): { date: string; time: string }

// Convert UTC to user's timezone for display
utcToLocal(time: string, date: string, toTz: string): { date: string; time: string }

// Get browser's default timezone
getBrowserTimezone(): string
```

### User Timezone Selection

1. **Default**: Browser's timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
2. **Override**: User can select different timezone via dropdown
3. **Persistence**: Stored in `localStorage` key `when2play_timezone`
4. **Scope**: Per-user, applies globally to all campaigns

### Debugging Timezone Issues

When debugging, add console logs showing:
```javascript
console.log("[Component] Data received:", {
  rawValue: time,
  timezone: userTimezone,
  isUTC: "yes/no/unknown",
  afterConversion: convertedTime
});
```

Always ask: "Is this time in UTC or local?" If you can't answer, trace it back to the source.

---

## Availability System

### Three Sources of Availability

1. **Calendar (Specific Dates)** - Exact availability for specific dates
2. **Recurring Patterns** - Weekly patterns like "every Monday 5-9pm"
3. **Exceptions** - Times when user is NOT available (overrides patterns)

### Priority Order

```
Exceptions > Calendar > Recurring Patterns
```

Exceptions always win. Calendar entries are additive with patterns.

### Effective Availability Computation

```typescript
computeEffectiveAvailability(
  patterns,      // Weekly patterns
  specificSlots, // Calendar entries
  exceptions,    // Unavailable times
  startDate,
  endDate,
  earliestTime,  // Event time window
  latestTime
): TimeSlot[]
```

---

## Campaign Configuration

### Required Fields
- Title
- Type (One-Shot or Campaign)

### Optional Fields
- Game System (searchable autocomplete)
- Description
- Session Length (60-480 minutes)
- Date Range (max 3 months)
- Time Window (earliest/latest times)
- Meeting Details (platform, URL, room)
- Player Prep (instructions, links)
- Min/Max Players

### Date/Time Constraints
- Date range cannot exceed 3 months
- Time window defines valid hours for scheduling
- Session length used for suggested time calculations

---

## Heatmap Visualization

### Color Scale (availability percentage)
- 100%: Dark green
- 75-99%: Medium-dark green
- 50-74%: Medium green
- 25-49%: Light green
- 1-24%: Very light green
- 0%: Gray

### Suggested Times
- Algorithm finds consecutive slots where 50%+ players available
- Considers session length requirement
- Sorted by availability count (descending)
- Top 5 suggestions displayed

---

## AI Availability Parsing

### Input
Natural language descriptions like:
- "I'm free weekday evenings after 6pm"
- "Can't do Tuesdays, otherwise 5-10pm works"
- "Next Monday and Wednesday afternoon"

### Output
Structured `TimeSlot[]` array with specific dates and times

### Undo Support
- AI changes can be undone via toast notification
- Undo stack maintains previous states
- Toast persists for 10 seconds

---

## Data Validation Rules

### Times
- Format: "HH:MM" (24-hour)
- Valid range: "00:00" to "23:30"
- 30-minute granularity

### Dates
- Format: "YYYY-MM-DD"
- Must be within event date range

### Session Length
- Minimum: 60 minutes
- Maximum: 480 minutes (8 hours)

### Player Counts
- Minimum players: >= 1 if set
- Maximum players: >= minimum if both set
