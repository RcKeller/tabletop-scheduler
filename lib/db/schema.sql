-- TTRPG Session Scheduler Database Schema
-- Run this in Vercel Postgres Dashboard "Query" tab

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB,
  start_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants table
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  is_gm BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, display_name)
);

-- Event-specific availability (time slots for a specific event)
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  UNIQUE(participant_id, date, start_time, end_time)
);

-- General recurring availability (templates)
CREATE TABLE IF NOT EXISTS general_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  UNIQUE(participant_id, day_of_week, start_time, end_time)
);

-- Exceptions to general availability
CREATE TABLE IF NOT EXISTS availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  UNIQUE(participant_id, date, start_time, end_time)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_availability_participant ON availability(participant_id);
CREATE INDEX IF NOT EXISTS idx_general_availability_participant ON general_availability(participant_id);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_participant ON availability_exceptions(participant_id);
