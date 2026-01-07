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

  // Find current week index
  const currentWeekIndex = useMemo(() => {
    return weeks.findIndex(
      (w) => w.toISOString() === currentWeekStart.toISOString()
    );
  }, [weeks, currentWeekStart]);

  const weekEnd = addDays(currentWeekStart, 6);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrev}
        disabled={!canGoPrev}
        className="flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Previous week"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Prev
      </button>

      <div className="flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-1.5 dark:bg-zinc-800">
        <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {format(currentWeekStart, "MMM d")} - {format(weekEnd, "MMM d")}
        </span>
        {weeks.length > 1 && (
          <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
            (Week {currentWeekIndex + 1}/{weeks.length})
          </span>
        )}
      </div>

      <button
        onClick={handleNext}
        disabled={!canGoNext}
        className="flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Next week"
      >
        Next
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
