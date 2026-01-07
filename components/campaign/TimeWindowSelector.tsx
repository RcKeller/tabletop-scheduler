"use client";

import { useMemo } from "react";

interface TimeWindowSelectorProps {
  earliestTime: string;
  latestTime: string;
  onEarliestChange: (time: string) => void;
  onLatestChange: (time: string) => void;
  className?: string;
}

// Generate time options in 30-minute increments
function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? "AM" : "PM";
      const label = `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
      options.push({ value, label });
    }
  }
  return options;
}

export function TimeWindowSelector({
  earliestTime,
  latestTime,
  onEarliestChange,
  onLatestChange,
  className = "",
}: TimeWindowSelectorProps) {
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const is24Hour = earliestTime === latestTime;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Time Window
      </label>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        What hours work for sessions? (in your timezone)
      </p>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex-1">
          <label
            htmlFor="earliestTime"
            className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
          >
            Earliest
          </label>
          <select
            id="earliestTime"
            value={earliestTime}
            onChange={(e) => onEarliestChange(e.target.value)}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {timeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <span className="mt-5 text-zinc-400">to</span>
        <div className="flex-1">
          <label
            htmlFor="latestTime"
            className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
          >
            Latest
          </label>
          <select
            id="latestTime"
            value={latestTime}
            onChange={(e) => onLatestChange(e.target.value)}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {timeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {is24Hour && (
        <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
          Same start and end time = 24-hour availability window
        </p>
      )}
    </div>
  );
}
