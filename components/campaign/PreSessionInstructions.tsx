"use client";

import { useCallback } from "react";

interface PreSessionInstructionsProps {
  value: string;
  defaultValue: string;
  onChange: (instructions: string) => void;
  className?: string;
}

export function PreSessionInstructions({
  value,
  defaultValue,
  onChange,
  className = "",
}: PreSessionInstructionsProps) {
  const isModified = value !== defaultValue && defaultValue.length > 0;

  const handleReset = useCallback(() => {
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <label
          htmlFor="preSessionInstructions"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Pre-Session Instructions
        </label>
        {isModified && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Reset to default
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        What should players prepare before each session?
        {defaultValue && " (Pre-filled from game system)"}
      </p>
      <textarea
        id="preSessionInstructions"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Bring your character sheet, review last session's events..."
        rows={4}
        className="mt-2 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
      {isModified && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          Modified from game system default
        </p>
      )}
    </div>
  );
}
