"use client";

import { useEffect, useState } from "react";
import { COMMON_TIMEZONES, getBrowserTimezone } from "@/lib/utils/timezone";

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  className?: string;
}

export function TimezoneSelector({
  value,
  onChange,
  className = "",
}: TimezoneSelectorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set to browser timezone on first mount if not already set
    if (!value) {
      onChange(getBrowserTimezone());
    }
  }, [value, onChange]);

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <select
        className={`rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
        disabled
      >
        <option>Loading...</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
    >
      {COMMON_TIMEZONES.map((tz) => (
        <option key={tz.value} value={tz.value}>
          {tz.label}
        </option>
      ))}
      {/* Add browser timezone if not in common list */}
      {!COMMON_TIMEZONES.some((tz) => tz.value === value) && (
        <option value={value}>{value}</option>
      )}
    </select>
  );
}
