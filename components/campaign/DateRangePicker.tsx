"use client";

import { useMemo } from "react";
import { format, addMonths, parseISO, isValid } from "date-fns";

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onStartDateChange: (date: string | null) => void;
  onEndDateChange: (date: string | null) => void;
  maxRangeMonths?: number;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  maxRangeMonths = 3,
  className = "",
}: DateRangePickerProps) {
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const maxEndDate = useMemo(() => {
    if (!startDate) return null;
    try {
      const start = parseISO(startDate);
      if (!isValid(start)) return null;
      return format(addMonths(start, maxRangeMonths), "yyyy-MM-dd");
    } catch {
      return null;
    }
  }, [startDate, maxRangeMonths]);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Availability Date Range
      </label>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Set when players can indicate their availability (up to {maxRangeMonths} months)
      </p>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex-1">
          <label
            htmlFor="startDate"
            className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
          >
            Start
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate || ""}
            min={today}
            onChange={(e) => {
              const value = e.target.value || null;
              onStartDateChange(value);
              // Reset end date if it's before the new start date
              if (value && endDate && endDate < value) {
                onEndDateChange(null);
              }
            }}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <span className="mt-5 text-zinc-400">to</span>
        <div className="flex-1">
          <label
            htmlFor="endDate"
            className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
          >
            End
          </label>
          <input
            type="date"
            id="endDate"
            value={endDate || ""}
            min={startDate || today}
            max={maxEndDate || undefined}
            disabled={!startDate}
            onChange={(e) => onEndDateChange(e.target.value || null)}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>
    </div>
  );
}
