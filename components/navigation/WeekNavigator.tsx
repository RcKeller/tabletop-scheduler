"use client";

import { useMemo } from "react";
import { format, addDays, startOfWeek, isBefore, isAfter } from "date-fns";

interface WeekNavigatorProps {
  currentWeekStart: Date;
  eventStartDate: Date;
  eventEndDate: Date;
  onWeekChange: (newWeekStart: Date) => void;
}

export function WeekNavigator({
  currentWeekStart,
  eventStartDate,
  eventEndDate,
  onWeekChange,
}: WeekNavigatorProps) {
  // Calculate all weeks in the event range
  const weeks = useMemo(() => {
    const result: Date[] = [];
    let week = startOfWeek(eventStartDate, { weekStartsOn: 0 });
    const endWeek = startOfWeek(eventEndDate, { weekStartsOn: 0 });

    while (!isAfter(week, endWeek)) {
      result.push(week);
      week = addDays(week, 7);
    }

    return result;
  }, [eventStartDate, eventEndDate]);

  const canGoPrev = useMemo(() => {
    const prevWeek = addDays(currentWeekStart, -7);
    return !isBefore(prevWeek, startOfWeek(eventStartDate, { weekStartsOn: 0 }));
  }, [currentWeekStart, eventStartDate]);

  const canGoNext = useMemo(() => {
    const nextWeek = addDays(currentWeekStart, 7);
    return !isAfter(nextWeek, startOfWeek(eventEndDate, { weekStartsOn: 0 }));
  }, [currentWeekStart, eventEndDate]);

  const handlePrev = () => {
    if (canGoPrev) {
      onWeekChange(addDays(currentWeekStart, -7));
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onWeekChange(addDays(currentWeekStart, 7));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrev}
        disabled={!canGoPrev}
        className="rounded p-1.5 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800"
        aria-label="Previous week"
      >
        <svg
          className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <select
        value={currentWeekStart.toISOString()}
        onChange={(e) => onWeekChange(new Date(e.target.value))}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      >
        {weeks.map((week) => {
          const weekEnd = addDays(week, 6);
          return (
            <option key={week.toISOString()} value={week.toISOString()}>
              {format(week, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </option>
          );
        })}
      </select>

      <button
        onClick={handleNext}
        disabled={!canGoNext}
        className="rounded p-1.5 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800"
        aria-label="Next week"
      >
        <svg
          className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
