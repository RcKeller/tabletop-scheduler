// Event types
export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | null;
  startTime: string | null; // ISO8601
  durationMinutes: number | null;
  timezone: string;
  createdAt: string;
}

export interface RecurrencePattern {
  type: "daily" | "weekly" | "biweekly" | "monthly";
  interval: number;
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, etc.
  endDate?: string; // ISO8601 date
}

// Database row types (snake_case from Postgres)
export interface EventRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  start_time: string | null;
  duration_minutes: number | null;
  timezone: string;
  created_at: string;
}

// Participant types
export interface Participant {
  id: string;
  eventId: string;
  displayName: string;
  isGm: boolean;
  createdAt: string;
}

export interface ParticipantRow {
  id: string;
  event_id: string;
  display_name: string;
  is_gm: boolean;
  created_at: string;
}

// Availability types
export interface TimeSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface Availability {
  id: string;
  participantId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface AvailabilityRow {
  id: string;
  participant_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

// General availability (recurring patterns)
export interface GeneralAvailability {
  id: string;
  participantId: string;
  dayOfWeek: number; // 0=Sun, 1=Mon, etc.
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface GeneralAvailabilityRow {
  id: string;
  participant_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

// Availability exceptions (blocked times)
export interface AvailabilityException {
  id: string;
  participantId: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

export interface AvailabilityExceptionRow {
  id: string;
  participant_id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

// Overlap calculation types
export interface OverlapSlot {
  date: string;
  startTime: string;
  endTime: string;
  availableCount: number;
  availableParticipants: string[]; // participant IDs
  totalParticipants: number;
}

export interface OverlapResult {
  perfectSlots: OverlapSlot[]; // Everyone available
  bestSlots: OverlapSlot[]; // Most people available
}

// API request/response types
export interface CreateEventRequest {
  title: string;
  description?: string;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  startTime?: string;
  durationMinutes?: number;
  timezone?: string;
}

export interface JoinEventRequest {
  displayName: string;
  isGm?: boolean;
}

export interface SetAvailabilityRequest {
  slots: TimeSlot[];
}

export interface SetGeneralAvailabilityRequest {
  patterns: Omit<GeneralAvailability, "id" | "participantId">[];
}

export interface SetExceptionsRequest {
  exceptions: Omit<AvailabilityException, "id" | "participantId">[];
}

export interface ParseAvailabilityRequest {
  text: string;
  timezone: string;
}

export interface ParseAvailabilityResponse {
  slots: Omit<GeneralAvailability, "id" | "participantId">[];
  interpretation: string; // Human-readable interpretation
}

// Row to model converters
export function eventFromRow(row: EventRow): Event {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    isRecurring: row.is_recurring,
    recurrencePattern: row.recurrence_pattern,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    createdAt: row.created_at,
  };
}

export function participantFromRow(row: ParticipantRow): Participant {
  return {
    id: row.id,
    eventId: row.event_id,
    displayName: row.display_name,
    isGm: row.is_gm,
    createdAt: row.created_at,
  };
}

export function availabilityFromRow(row: AvailabilityRow): Availability {
  return {
    id: row.id,
    participantId: row.participant_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

export function generalAvailabilityFromRow(
  row: GeneralAvailabilityRow
): GeneralAvailability {
  return {
    id: row.id,
    participantId: row.participant_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

export function exceptionFromRow(
  row: AvailabilityExceptionRow
): AvailabilityException {
  return {
    id: row.id,
    participantId: row.participant_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
  };
}
