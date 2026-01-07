"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { GeneralAvailability } from "@/lib/types";

interface GeneralAvailabilityEditorProps {
  patterns: GeneralAvailability[];
  timezone: string;
  onSave: (patterns: Omit<GeneralAvailability, "id" | "participantId">[]) => void;
  isSaving: boolean;
  eventEarliestTime?: string;
  eventLatestTime?: string;
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

const DAY_PRESETS = [
  { value: "weekdays", label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { value: "weekends", label: "Weekends", days: [0, 6] },
  { value: "sunday", label: "Sunday", days: [0] },
  { value: "monday", label: "Monday", days: [1] },
  { value: "tuesday", label: "Tuesday", days: [2] },
  { value: "wednesday", label: "Wednesday", days: [3] },
  { value: "thursday", label: "Thursday", days: [4] },
  { value: "friday", label: "Friday", days: [5] },
  { value: "saturday", label: "Saturday", days: [6] },
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

function isTimeInWindow(time: string, earliest: string, latest: string): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const timeMins = toMins(time);
  const earliestMins = toMins(earliest);
  let latestMins = toMins(latest);

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
  const [showAddMenu, setShowAddMenu] = useState(false);

  const entriesOutsideWindow = useMemo(() => {
    if (!eventEarliestTime || !eventLatestTime) return [];

    return entries.filter((entry) => {
      const startInWindow = isTimeInWindow(entry.startTime, eventEarliestTime, eventLatestTime);
      const endInWindow = isTimeInWindow(entry.endTime, eventEarliestTime, eventLatestTime);
      return !startInWindow || !endInWindow;
    });
  }, [entries, eventEarliestTime, eventLatestTime]);

  // Initialize from patterns only (no auto-population)
  useEffect(() => {
    if (initialized) return;

    if (patterns.length > 0) {
      setEntries(
        patterns.map((p, i) => ({
          id: p.id || `entry-${i}`,
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        }))
      );
    } else {
      setEntries([]);
    }
    setHasChanges(false);
    setInitialized(true);
  }, [patterns, initialized]);

  useEffect(() => {
    if (patterns.length > 0 && initialized) {
      const currentIds = new Set(entries.map(e => e.id));
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
  }, [patterns, initialized, entries]);

  const addEntriesForDays = useCallback((days: number[]) => {
    const newEntries = days.map((dayOfWeek, i) => ({
      id: `new-${Date.now()}-${i}`,
      dayOfWeek,
      startTime: "17:00",
      endTime: "21:00",
    }));
    setEntries([...entries, ...newEntries]);
    setHasChanges(true);
    setShowAddMenu(false);
  }, [entries]);

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

  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const hour = h % 12 || 12;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  // Group entries by time range for cleaner display
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, PatternEntry[]>();
    for (const entry of entries) {
      const key = `${entry.startTime}-${entry.endTime}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }
    return groups;
  }, [entries]);

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <svg className="mx-auto h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No weekly availability set yet
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Add times when you're typically free each week
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 p-2 dark:bg-zinc-800"
            >
              <select
                value={entry.dayOfWeek}
                onChange={(e) => updateEntry(entry.id, "dayOfWeek", parseInt(e.target.value))}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              >
                {DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>

              <select
                value={entry.startTime}
                onChange={(e) => updateEntry(entry.id, "startTime", e.target.value)}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <span className="text-sm text-zinc-400">-</span>

              <select
                value={entry.endTime}
                onChange={(e) => updateEntry(entry.id, "endTime", e.target.value)}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
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
      )}

      {/* Add availability dropdown */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Time Slot
          </button>

          {showAddMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAddMenu(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
                <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Quick add
                </div>
                {DAY_PRESETS.slice(0, 2).map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => addEntriesForDays(preset.days)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                      {preset.days.length} days
                    </span>
                  </button>
                ))}
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-700" />
                <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Individual days
                </div>
                {DAY_PRESETS.slice(2).map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => addEntriesForDays(preset.days)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {entries.length > 0 && hasChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Schedule
              </>
            )}
          </button>
        )}
      </div>

      {/* Warning for times outside campaign window */}
      {entriesOutsideWindow.length > 0 && eventEarliestTime && eventLatestTime && (
        <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              Some times are outside this campaign's window ({formatTimeDisplay(eventEarliestTime)} - {formatTimeDisplay(eventLatestTime)}).
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
