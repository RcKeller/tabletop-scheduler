"use client";

import { useState, useEffect } from "react";
import type { GeneralAvailability } from "@/lib/types";

interface GeneralAvailabilityEditorProps {
  patterns: GeneralAvailability[];
  timezone: string;
  onSave: (patterns: Omit<GeneralAvailability, "id" | "participantId">[]) => void;
  isSaving: boolean;
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

export function GeneralAvailabilityEditor({
  patterns,
  timezone,
  onSave,
  isSaving,
}: GeneralAvailabilityEditorProps) {
  const [entries, setEntries] = useState<PatternEntry[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from patterns
  useEffect(() => {
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
      // Default: weekday evenings
      setEntries([
        { id: "default-1", dayOfWeek: 1, startTime: "18:00", endTime: "22:00" },
        { id: "default-2", dayOfWeek: 2, startTime: "18:00", endTime: "22:00" },
        { id: "default-3", dayOfWeek: 3, startTime: "18:00", endTime: "22:00" },
        { id: "default-4", dayOfWeek: 4, startTime: "18:00", endTime: "22:00" },
        { id: "default-5", dayOfWeek: 5, startTime: "18:00", endTime: "22:00" },
      ]);
      setHasChanges(true);
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Set your recurring weekly availability. This helps others know when you&apos;re generally free.
      </p>

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
