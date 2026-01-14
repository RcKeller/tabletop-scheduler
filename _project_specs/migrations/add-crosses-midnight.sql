-- Migration: Add crosses_midnight column to availability_rules
-- Run this in Vercel Postgres Dashboard "Query" tab
-- This column tracks whether the ORIGINAL (pre-UTC-conversion) time range crossed midnight

ALTER TABLE availability_rules
ADD COLUMN IF NOT EXISTS crosses_midnight BOOLEAN DEFAULT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN availability_rules.crosses_midnight IS
'Whether the ORIGINAL time range (before UTC conversion) crossed midnight.
TRUE = user specified overnight range (e.g., 10pm-2am),
FALSE = user specified same-day range (e.g., 9am-5pm or all day),
NULL = legacy data, use inference from time comparison';
