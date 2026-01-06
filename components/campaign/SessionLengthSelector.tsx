"use client";

import { SESSION_LENGTH_OPTIONS } from "@/lib/types";

interface SessionLengthSelectorProps {
  value: number;
  onChange: (minutes: number) => void;
  className?: string;
}

export function SessionLengthSelector({
  value,
  onChange,
  className = "",
}: SessionLengthSelectorProps) {
  return (
    <div className={className}>
      <label
        htmlFor="sessionLength"
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Session Length
      </label>
      <select
        id="sessionLength"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      >
        {SESSION_LENGTH_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
