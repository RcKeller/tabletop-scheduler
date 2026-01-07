"use client";

import { useState, useEffect, useMemo } from "react";
import type { GeneralAvailability } from "@/lib/types";

interface GeneralAvailabilityEditorProps {
  patterns: GeneralAvailability[];
  timezone: string;
  onSave: (patterns: Omit<GeneralAvailability, "id" | "participantId">[]) => void;
  isSaving: boolean;
  eventEarliestTime?: string; // Campaign's earliest allowed time
  eventLatestTime?: string; // Campaign's latest allowed time
}

const DAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const display = hour === 0 ? "12:00 AM" :
    hour < 12 ? `${hour}:${minute.toString().padStart(2, "0")} AM` :
    hour === 12 ? `12:${minute.toString().padStart(2, "0")} PM` :
    `${hour - 12}:${minute.toString().padStart(2, "0")} PM`;
  return { value: time, label: display };
});

interface PatternEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Generate default weekly patterns:
 * - Sat/Sun: 10am-10pm
 * - M-F: 5pm-10pm
 */
function generateDefaultPatterns(): PatternEntry[] {
  const patterns: PatternEntry[] = [];

  // Weekend: Sat & Sun, 10am-10pm
  [0, 6].forEach((dayOfWeek, i) => {
    patterns.push({
      id: `default-weekend-${i}`,
      dayOfWeek,
      startTime: "10:00",
      endTime: "22:00",
    });
  });

  // Weekdays: M-F, 5pm-10pm
  [1, 2, 3, 4, 5].forEach((dayOfWeek, i) => {
    patterns.push({
      id: `default-weekday-${i}`,
      dayOfWeek,
      startTime: "17:00",
      endTime: "22:00",
    });
  });

  return patterns;
}

/**
 * Check if a time is within the event's time window
 */
function isTimeInWindow(time: string, earliest: string, latest: string): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const timeMins = toMins(time);
  const earliestMins = toMins(earliest);
  let latestMins = toMins(latest);

  // Handle midnight crossing
  if (latestMins <= earliestMins) {
    latestMins += 24 * 60;
  }

  return timeMins >= earliestMins && timeMins <= latestMins;
}

export function GeneralAvailabilityEditor({
  patterns,
  timezone,
  onSave,
  isSaving,
  eventEarliestTime,
  eventLatestTime,
}: GeneralAvailabilityEditorProps) {
  const [entries, setEntries] = useState<PatternEntry[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Check if any entries are outside the campaign window
  const entriesOutsideWindow = useMemo(() => {
    if (!eventEarliestTime || !eventLatestTime) return [];

    return entries.filter((entry) => {
      const startInWindow = isTimeInWindow(entry.startTime, eventEarliestTime, eventLatestTime);
      const endInWindow = isTimeInWindow(entry.endTime, eventEarliestTime, eventLatestTime);
      return !startInWindow || !endInWindow;
    });
  }, [entries, eventEarliestTime, eventLatestTime]);

  // Initialize from patterns or generate defaults
  useEffect(() => {
    if (initialized) return;

    if (patterns.length > 0) {
      // Use existing patterns
      setEntries(
        patterns.map((p, i) => ({
          id: p.id || `entry-${i}`,
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        }))
      );
      setHasChanges(false);
    } else {
      // Generate default patterns (last 5 hours of day, M-F)
      setEntries(generateDefaultPatterns());
      setHasChanges(true); // Mark as needing save
    }
    setInitialized(true);
  }, [patterns, initialized]);

  // Reset initialization when patterns prop changes significantly
  useEffect(() => {
    if (patterns.length > 0 && initialized) {
      const currentIds = new Set(entries.map(e => e.id));
      const newIds = new Set(patterns.map(p => p.id));
      const hasNewPatterns = patterns.some(p => !currentIds.has(p.id || ''));

      if (hasNewPatterns) {
        setEntries(
          patterns.map((p, i) => ({
            id: p.id || `entry-${i}`,
            dayOfWeek: p.dayOfWeek,
            startTime: p.startTime,
            endTime: p.endTime,
          }))
        );
        setHasChanges(false);
      }
    }
  }, [patterns]);

  const addEntry = () => {
    setEntries([
      ...entries,
      {
        id: `new-${Date.now()}`,
        dayOfWeek: 6, // Saturday
        startTime: "14:00",
        endTime: "22:00",
      },
    ]);
    setHasChanges(true);
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id));
    setHasChanges(true);
  };

  const updateEntry = (id: string, field: keyof PatternEntry, value: number | string) => {
    setEntries(
      entries.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    const patternsToSave = entries.map((e) => ({
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      endTime: e.endTime,
    }));
    onSave(patternsToSave);
    setHasChanges(false);
  };

  // Format time for display
  const formatTimeRange = (start: string, end: string) => {
    const formatTime = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const hour = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
    };
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const hour = h % 12 || 12;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Set your recurring weekly availability.
      </p>

      {/* Warning for times outside campaign window */}
      {entriesOutsideWindow.length > 0 && eventEarliestTime && eventLatestTime && (
        <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              Some of your availability is outside this campaign's time window ({formatTimeDisplay(eventEarliestTime)} - {formatTimeDisplay(eventLatestTime)}).
              Only times within this window will count.
            </span>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="rounded-md bg-yellow-50 p-3 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
          No weekly schedule set. Add time slots below.
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-800"
          >
            <select
              value={entry.dayOfWeek}
              onChange={(e) => updateEntry(entry.id, "dayOfWeek", parseInt(e.target.value))}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            >
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>

            <span className="text-sm text-zinc-500 dark:text-zinc-400">from</span>

            <select
              value={entry.startTime}
              onChange={(e) => updateEntry(entry.id, "startTime", e.target.value)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <span className="text-sm text-zinc-500 dark:text-zinc-400">to</span>

            <select
              value={entry.endTime}
              onChange={(e) => updateEntry(entry.id, "endTime", e.target.value)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            >
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => removeEntry(entry.id)}
              className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
              aria-label="Remove"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={addEntry}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          + Add time slot
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Schedule"}
        </button>
      </div>
    </div>
  );
}
