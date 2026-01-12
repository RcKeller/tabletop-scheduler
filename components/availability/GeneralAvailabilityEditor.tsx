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
  { value: 0, label: "Sunday", short: "Su" },
  { value: 1, label: "Monday", short: "Mo" },
  { value: 2, label: "Tuesday", short: "Tu" },
  { value: 3, label: "Wednesday", short: "We" },
  { value: 4, label: "Thursday", short: "Th" },
  { value: 5, label: "Friday", short: "Fr" },
  { value: 6, label: "Saturday", short: "Sa" },
];

const DAY_PRESETS = [
  { value: "weekdays", label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { value: "weekends", label: "Weekends", days: [0, 6] },
];

// Generate time options from 00:00 to 23:30 for start times
const TIME_OPTIONS_START = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  const display = `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
  return { value: time, label: display };
});

// Generate time options from 00:30 to 24:00 for end times (includes midnight as 24:00)
const TIME_OPTIONS_END = [
  ...Array.from({ length: 47 }, (_, i) => {
    const hour = Math.floor((i + 1) / 2);
    const minute = ((i + 1) % 2) * 30;
    const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour < 12 ? "AM" : "PM";
    const display = `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
    return { value: time, label: display };
  }),
  { value: "24:00", label: "12:00 AM (midnight)" },
];

// Combined options for backwards compatibility (used where overnight isn't supported yet)
const TIME_OPTIONS = TIME_OPTIONS_START;

// Local entry supports multiple days
interface PatternEntry {
  id: string;
  days: number[]; // Multiple days selected
  startTime: string;
  endTime: string;
  isAvailable: boolean;
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

// Group patterns by time and availability status into multi-day entries
function groupPatternsToEntries(patterns: GeneralAvailability[]): PatternEntry[] {
  const groups = new Map<string, PatternEntry>();

  for (const p of patterns) {
    const key = `${p.startTime}-${p.endTime}-${p.isAvailable}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.days.includes(p.dayOfWeek)) {
        existing.days.push(p.dayOfWeek);
        existing.days.sort((a, b) => a - b);
      }
    } else {
      groups.set(key, {
        id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        days: [p.dayOfWeek],
        startTime: p.startTime,
        endTime: p.endTime,
        isAvailable: p.isAvailable ?? true,
      });
    }
  }

  return Array.from(groups.values());
}

// Expand entries back to individual patterns for saving
function expandEntriesToPatterns(entries: PatternEntry[]): Omit<GeneralAvailability, "id" | "participantId">[] {
  const patterns: Omit<GeneralAvailability, "id" | "participantId">[] = [];

  for (const entry of entries) {
    for (const dayOfWeek of entry.days) {
      patterns.push({
        dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        isAvailable: entry.isAvailable,
      });
    }
  }

  return patterns;
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  // Track the last saved patterns to detect external changes
  const [lastSavedPatterns, setLastSavedPatterns] = useState<string>("");

  // Event time window is already in user's local timezone (pre-converted by parent component)
  const localTimeWindow = useMemo(() => {
    if (!eventEarliestTime || !eventLatestTime) return null;
    return {
      earliest: eventEarliestTime,
      latest: eventLatestTime,
    };
  }, [eventEarliestTime, eventLatestTime]);

  const entriesOutsideWindow = useMemo(() => {
    if (!localTimeWindow) return [];

    return entries.filter((entry) => {
      if (!entry.isAvailable) return false;
      const startInWindow = isTimeInWindow(entry.startTime, localTimeWindow.earliest, localTimeWindow.latest);
      const endInWindow = isTimeInWindow(entry.endTime, localTimeWindow.earliest, localTimeWindow.latest);
      return !startInWindow || !endInWindow;
    });
  }, [entries, localTimeWindow]);

  // Initialize and sync from patterns - only when patterns actually change externally
  useEffect(() => {
    const patternsKey = JSON.stringify(patterns.map(p => ({
      d: p.dayOfWeek,
      s: p.startTime,
      e: p.endTime,
      a: p.isAvailable
    })).sort((a, b) => a.d - b.d || a.s.localeCompare(b.s)));

    // Only update if patterns changed externally (different from what we last saved)
    if (patternsKey !== lastSavedPatterns) {
      setEntries(groupPatternsToEntries(patterns));
      setLastSavedPatterns(patternsKey);
      setHasChanges(false);
    }
  }, [patterns, lastSavedPatterns]);

  const addEntry = useCallback((days: number[], isAvailable: boolean = true) => {
    const newEntry: PatternEntry = {
      id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      days,
      startTime: "17:00",
      endTime: "21:00",
      isAvailable,
    };
    setEntries(prev => [...prev, newEntry]);
    setHasChanges(true);
    setShowAddMenu(false);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter((e) => e.id !== id));
    setHasChanges(true);
  }, []);

  const toggleDay = useCallback((entryId: string, dayValue: number) => {
    setEntries(prev =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const hasDday = e.days.includes(dayValue);
        let newDays: number[];
        if (hasDday) {
          // Remove day (but keep at least one)
          newDays = e.days.filter(d => d !== dayValue);
          if (newDays.length === 0) return e; // Don't allow empty
        } else {
          // Add day
          newDays = [...e.days, dayValue].sort((a, b) => a - b);
        }
        return { ...e, days: newDays };
      })
    );
    setHasChanges(true);
  }, []);

  const updateEntry = useCallback((id: string, field: "startTime" | "endTime", value: string) => {
    setEntries(prev =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
    setHasChanges(true);
  }, []);

  const toggleAvailability = useCallback((id: string) => {
    setEntries(prev =>
      prev.map((e) => (e.id === id ? { ...e, isAvailable: !e.isAvailable } : e))
    );
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    const patternsToSave = expandEntriesToPatterns(entries);

    // Update lastSavedPatterns to match what we're saving
    const patternsKey = JSON.stringify(patternsToSave.map(p => ({
      d: p.dayOfWeek,
      s: p.startTime,
      e: p.endTime,
      a: p.isAvailable
    })).sort((a, b) => a.d - b.d || a.s.localeCompare(b.s)));
    setLastSavedPatterns(patternsKey);

    onSave(patternsToSave);
    setHasChanges(false);
  }, [entries, onSave]);

  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const hour = h % 12 || 12;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatDaysLabel = (days: number[]) => {
    if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) {
      return "Weekdays";
    }
    if (days.length === 2 && days.includes(0) && days.includes(6)) {
      return "Weekends";
    }
    if (days.length === 7) {
      return "Every day";
    }
    return days.map(d => DAYS[d].short).join(", ");
  };

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <svg className="mx-auto h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            No recurring schedule set
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Add times when you&apos;re typically available or unavailable each week
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-lg border p-3 transition-colors ${
                entry.isAvailable
                  ? "border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20"
                  : "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
              }`}
            >
              {/* Row 1: Toggle + Days label + Delete */}
              <div className="flex items-center gap-3">
                {/* Available/Not Available Toggle */}
                <button
                  onClick={() => toggleAvailability(entry.id)}
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    entry.isAvailable
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                  title={entry.isAvailable ? "Click to mark as Not Available" : "Click to mark as Available"}
                >
                  {entry.isAvailable ? "Available" : "Not Available"}
                </button>

                {/* Days label */}
                <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {formatDaysLabel(entry.days)}
                </span>

                {/* Delete Button */}
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="flex-shrink-0 rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  title="Delete this schedule"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Row 2: Day Selection Checkboxes */}
              <div className="mt-2 flex flex-wrap gap-1">
                {DAYS.map((day) => {
                  const isSelected = entry.days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(entry.id, day.value)}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? entry.isAvailable
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      }`}
                      title={isSelected ? `Remove ${day.label}` : `Add ${day.label}`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>

              {/* Row 3: Time Selection */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">From</span>
                <select
                  value={entry.startTime}
                  onChange={(e) => updateEntry(entry.id, "startTime", e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                >
                  {TIME_OPTIONS_START.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <span className="text-xs text-zinc-500 dark:text-zinc-400">to</span>

                <select
                  value={entry.endTime}
                  onChange={(e) => updateEntry(entry.id, "endTime", e.target.value)}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                >
                  {TIME_OPTIONS_END.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add availability dropdown + Save button */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
                <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Available times
                </div>
                {DAY_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => addEntry(preset.days, true)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {preset.days.length} days
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => addEntry([0, 1, 2, 3, 4, 5, 6], true)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <span className="font-medium">Every day</span>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    7 days
                  </span>
                </button>
                {/* Single day quick-add */}
                <div className="flex gap-1 px-3 py-2">
                  {DAYS.map((day) => (
                    <button
                      key={`single-${day.value}`}
                      onClick={() => addEntry([day.value], true)}
                      className="flex-1 rounded bg-green-50 px-1 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40"
                      title={`Add ${day.label} only`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-700" />
                <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Blocked times
                </div>
                {DAY_PRESETS.map((preset) => (
                  <button
                    key={`blocked-${preset.value}`}
                    onClick={() => addEntry(preset.days, false)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      blocked
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => addEntry([0, 1, 2, 3, 4, 5, 6], false)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <span className="font-medium">Every day</span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    blocked
                  </span>
                </button>
                {/* Single day quick-add for blocked */}
                <div className="flex gap-1 px-3 py-2">
                  {DAYS.map((day) => (
                    <button
                      key={`blocked-single-${day.value}`}
                      onClick={() => addEntry([day.value], false)}
                      className="flex-1 rounded bg-red-50 px-1 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                      title={`Block ${day.label} only`}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
      {entriesOutsideWindow.length > 0 && localTimeWindow && (
        <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              Some times are outside this campaign&apos;s window ({formatTimeDisplay(localTimeWindow.earliest)} - {formatTimeDisplay(localTimeWindow.latest)}).
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
