# When2Play - Product Requirements

## Overview

When2Play is a scheduling application for tabletop RPG groups (D&D, Pathfinder, etc.) that helps coordinate availability across multiple players in different timezones.

---

## Timezone Handling

### Core Principle: UTC-First Architecture

**All times stored in the database are in UTC.** The frontend converts to/from the user's local timezone for display and input.

### Why UTC-First?

1. **Single source of truth** - No ambiguity about what timezone a stored time represents
2. **Consistency** - All components use the same data format
3. **Simplicity** - Conversion logic is centralized in utility functions
4. **Multi-timezone support** - Users in different timezones see correct local times

### Data Flow

```
USER INPUT (local timezone)
    │
    ▼
┌─────────────────────┐
│  localToUTC()       │ ← Convert before saving to API
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  API / Database     │ ← All times stored in UTC
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  utcToLocal()       │ ← Convert when displaying to user
└─────────────────────┘
    │
    ▼
USER DISPLAY (local timezone)
```

### Implementation Details

#### Utility Functions (`lib/utils/timezone.ts`)

```typescript
// Convert user input to UTC for storage
localToUTC(time: string, date: string, fromTz: string): { date: string; time: string }

// Convert UTC to user's timezone for display
utcToLocal(time: string, date: string, toTz: string): { date: string; time: string }

// Get browser's default timezone
getBrowserTimezone(): string
```

#### Database Storage

| Field | Format | Timezone |
|-------|--------|----------|
| `Availability.date` | Date | UTC |
| `Availability.startTime` | "HH:MM" | UTC |
| `Availability.endTime` | "HH:MM" | UTC |
| `Event.earliestTime` | "HH:MM" | UTC |
| `Event.latestTime` | "HH:MM" | UTC |
| `Event.startDate` | Date | UTC |
| `Event.endDate` | Date | UTC |

#### API Contracts

All API endpoints that accept or return time data work with UTC:

**GET /api/availability/[participantId]**
- Returns: `availability`, `effectiveAvailability` - all times in UTC

**PUT /api/availability/[participantId]**
- Expects: `availability` array with times in UTC

**GET /api/events/[slug]**
- Returns: `earliestTime`, `latestTime` in UTC

#### Frontend Components

| Component | On Load | On Save |
|-----------|---------|---------|
| VirtualizedAvailabilityGrid | UTC → Local | Local → UTC |
| CombinedHeatmap | UTC → Local | N/A (read-only) |
| GeneralAvailabilityEditor | Local (patterns) | Local (patterns)* |

*Note: GeneralAvailability patterns (recurring weekly times) are stored in the user's local timezone because they represent "every Monday at 6pm in my timezone". When patterns are expanded to specific dates, the API converts them to UTC using the user's timezone passed as a query parameter.

### User Timezone Selection

1. **Default**: Browser's timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
2. **Override**: User can select different timezone via dropdown
3. **Persistence**: Stored in `localStorage` key `when2play_timezone`
4. **Scope**: Per-user, applies globally to all campaigns

### Timezone Selector Behavior

- Changing timezone immediately updates all displayed times
- Grid re-renders with new timezone context (via React key)
- No data migration needed - just display conversion changes

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
