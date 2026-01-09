# Timezone Refactor: UTC-First Architecture

**STATUS: COMPLETED** (2026-01-09)

See `/docs/REQUIREMENTS.md` for the canonical product requirements.

## Core Principle

**All times stored in the database are in UTC.** The frontend converts to/from the user's local timezone for display and input.

---

## Previous State (Fixed)

- Times stored in ambiguous timezone (assumed to be event timezone)
- No consistent conversion layer
- Components had ad-hoc, incomplete timezone handling

## Current State (Implemented)

- All database times in UTC
- API returns UTC times
- Frontend converts UTC ↔ user's local timezone
- User's timezone defaults to browser timezone, adjustable via selector
- Single source of truth, explicit conversions

---

## Architecture

```
USER INPUT (local TZ)
    │
    ▼
┌─────────────────────┐
│  Timezone Selector  │ ← User can override browser default
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  UTC Conversion     │ ← localToUTC(time, date, userTz)
│  (on save)          │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  API / Database     │ ← All times in UTC
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  UTC Conversion     │ ← utcToLocal(time, date, userTz)
│  (on display)       │
└─────────────────────┘
    │
    ▼
USER DISPLAY (local TZ)
```

---

## Implementation Phases

### Phase 1: Utility Functions

**File:** `lib/utils/timezone.ts`

Create clear, well-documented conversion functions:

```typescript
/**
 * Convert a local time to UTC
 * @param time - HH:MM format
 * @param date - YYYY-MM-DD format (needed for DST calculation)
 * @param fromTz - User's timezone
 * @returns { date, time } in UTC
 */
export function localToUTC(time: string, date: string, fromTz: string): { date: string; time: string }

/**
 * Convert UTC to a local time
 * @param time - HH:MM format in UTC
 * @param date - YYYY-MM-DD format in UTC
 * @param toTz - User's timezone
 * @returns { date, time } in user's timezone
 */
export function utcToLocal(time: string, date: string, toTz: string): { date: string; time: string }

/**
 * Get user's browser timezone
 */
export function getBrowserTimezone(): string
```

### Phase 2: Database Migration

**Decision:** Do we need to migrate existing data?

Option A: Migrate existing times to UTC
- Write migration script
- Requires knowing what timezone existing data is in

Option B: Treat new data as UTC, flag old data
- Add `isUtc` flag or `createdAt` check
- Legacy data keeps old behavior

**Recommended:** Option A with assumption that existing times are in "America/New_York" (or most common event timezone)

### Phase 3: API Layer

All API endpoints that return times must be consistent:

**Pattern for GET endpoints:**
```typescript
// Times come from DB in UTC
// Return as-is (UTC) with explicit indication
return NextResponse.json({
  availability: slots, // times are in UTC
  // Optional: add header or field
  _timezoneContext: "UTC"
});
```

**Pattern for PUT/POST endpoints:**
```typescript
// Times arrive from frontend in UTC (frontend converts before sending)
// Store directly
await prisma.availability.create({
  data: {
    startTime: body.startTime, // Already UTC from frontend
    endTime: body.endTime,     // Already UTC from frontend
    date: new Date(body.date), // Already UTC
  }
});
```

### Phase 4: Frontend Components

Each component that displays or accepts time input needs:

1. **User timezone state** (from localStorage or browser default)
2. **UTC → Local conversion** on render
3. **Local → UTC conversion** on save

**Components to update:**

| Component | Display | Input | Save |
|-----------|---------|-------|------|
| VirtualizedAvailabilityGrid | ✓ UTC→Local | ✓ Local | ✓ Local→UTC |
| GeneralAvailabilityEditor | UTC→Local | Local | Local→UTC |
| CombinedHeatmap | UTC→Local | N/A | N/A |
| OverlapPreview | UTC→Local | N/A | N/A |
| TimeWindowSelector | UTC→Local | Local | Local→UTC |

### Phase 5: Timezone Selector Behavior

**Default:** User's browser timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`)

**Storage:** localStorage key `when2play_timezone`

**On change:** All displayed times re-render in new timezone

**Remove:** The concept of "event timezone" for display purposes. Events may still store a default timezone for new users, but it doesn't affect how times are stored.

---

## Affected Files

### Must Update
- `lib/utils/timezone.ts` - Add clean UTC conversion functions
- `components/availability/VirtualizedAvailabilityGrid.tsx` - Use UTC functions
- `components/availability/GeneralAvailabilityEditor.tsx` - Add timezone handling
- `components/heatmap/CombinedHeatmap.tsx` - Fix conversion
- `app/api/availability/[participantId]/route.ts` - Ensure UTC storage

### May Need Update
- `prisma/schema.prisma` - Verify time field types
- `lib/utils/availability-expander.ts` - May need UTC awareness
- `lib/utils/availability/slot-conversion.ts` - May need UTC awareness

### Remove/Deprecate
- Concept of `eventTimezone` for conversion purposes
- Any "source timezone" logic - everything is UTC

---

## Migration Script (if needed)

```typescript
// migrate-to-utc.ts
async function migrateTimesToUTC() {
  const ASSUMED_TIMEZONE = "America/New_York"; // or configurable

  // Migrate Availability records
  const slots = await prisma.availability.findMany();
  for (const slot of slots) {
    const utcStart = localToUTC(slot.startTime, format(slot.date, "yyyy-MM-dd"), ASSUMED_TIMEZONE);
    const utcEnd = localToUTC(slot.endTime, format(slot.date, "yyyy-MM-dd"), ASSUMED_TIMEZONE);

    await prisma.availability.update({
      where: { id: slot.id },
      data: {
        startTime: utcStart.time,
        endTime: utcEnd.time,
        date: new Date(utcStart.date),
      }
    });
  }

  // Similarly for GeneralAvailability, AvailabilityException
}
```

---

## Testing Checklist

These scenarios should be manually verified:

- [ ] User in LA creates availability for 5pm - stored as UTC (1am next day in winter)
- [ ] User in NYC views same slot - sees 8pm (correct 3hr offset from LA)
- [ ] User in London views - sees 1am next day
- [ ] Changing timezone selector updates all displays immediately
- [ ] Saving after timezone change stores correct UTC time
- [ ] Heatmap aggregates correctly across timezones
- [ ] Recurring patterns work correctly with timezone
- [ ] Overnight slots (crossing midnight) handled correctly

---

## Order of Implementation

1. **Utility functions** - Clean localToUTC/utcToLocal
2. **VirtualizedAvailabilityGrid** - Already has framework, update to use UTC functions
3. **GeneralAvailabilityEditor** - Add timezone handling from scratch
4. **CombinedHeatmap** - Fix to use UTC functions
5. **API verification** - Ensure all endpoints treat times as UTC
6. **Migration** - If existing data needs conversion
7. **Testing** - Verify all scenarios
