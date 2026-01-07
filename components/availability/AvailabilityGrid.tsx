"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { format, addDays, startOfWeek, parse } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { TimeSlot } from "@/lib/types";

interface AvailabilityGridProps {
  availability: TimeSlot[];
  timezone: string;
  eventTimezone?: string;
  onSave: (slots: TimeSlot[]) => void;
  isSaving: boolean;
  isLoading?: boolean;
  weekStart?: Date;
  earliestTime?: string;
  latestTime?: string;
  autoSave?: boolean;
  showLegend?: boolean;
}

// Generate time slots (30-min intervals for full day)
function generateTimeSlots(earliest: string, latest: string): string[] {
  const slots: string[] = [];
  const is24Hour = earliest === latest;

  // Parse times to minutes from midnight
  const parseTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const startMins = parseTime(earliest);
  let endMins = parseTime(latest);

  // If 24 hour or latest is before earliest (crosses midnight), adjust
  if (is24Hour) {
    endMins = startMins + 24 * 60;
  } else if (endMins <= startMins) {
    endMins += 24 * 60; // Crosses midnight
  }

  for (let mins = startMins; mins < endMins; mins += 30) {
    const normalizedMins = mins % (24 * 60);
    const hour = Math.floor(normalizedMins / 60);
    const minute = normalizedMins % 60;
    slots.push(
      `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
    );
  }

  return slots;
}

// Generate 7 days starting from a date
function getWeekDates(start?: Date): Date[] {
  const weekStart = start || startOfWeek(new Date(), { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function AvailabilityGrid({
  availability,
  timezone,
  eventTimezone,
  onSave,
  isSaving,
  isLoading = false,
  weekStart,
  earliestTime = "00:00",
  latestTime = "23:30",
  autoSave = false,
  showLegend = true,
}: AvailabilityGridProps) {
  // Use event timezone if provided, otherwise fall back to viewer timezone
  const displayTimezone = eventTimezone || timezone;
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"select" | "deselect">("select");
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ row: number; col: number } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<string | null>(null); // Track pending save hash
  const initializedRef = useRef(false);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const timeSlots = useMemo(
    () => generateTimeSlots(earliestTime, latestTime),
    [earliestTime, latestTime]
  );

  // Calculate pending slots from drag rectangle
  const pendingSlots = useMemo(() => {
    if (!isDragging || !dragStart || !dragEnd) return new Set<string>();

    const pending = new Set<string>();
    const minRow = Math.min(dragStart.row, dragEnd.row);
    const maxRow = Math.max(dragStart.row, dragEnd.row);
    const minCol = Math.min(dragStart.col, dragEnd.col);
    const maxCol = Math.max(dragStart.col, dragEnd.col);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (row < timeSlots.length && col < weekDates.length) {
          const dateStr = format(weekDates[col], "yyyy-MM-dd");
          const time = timeSlots[row];
          pending.add(`${dateStr}-${time}`);
        }
      }
    }

    return pending;
  }, [isDragging, dragStart, dragEnd, timeSlots, weekDates]);

  // Convert availability prop to slot set
  const availabilityToSlots = useCallback((avail: TimeSlot[]): Set<string> => {
    const slots = new Set<string>();
    for (const slot of avail) {
      let currentTime = slot.startTime;
      while (currentTime < slot.endTime) {
        slots.add(`${slot.date}-${currentTime}`);
        const [h, m] = currentTime.split(":").map(Number);
        const nextMinute = m + 30;
        if (nextMinute >= 60) {
          currentTime = `${(h + 1).toString().padStart(2, "0")}:00`;
        } else {
          currentTime = `${h.toString().padStart(2, "0")}:30`;
        }
      }
    }
    return slots;
  }, []);

  // Initialize selected slots from availability
  useEffect(() => {
    const serverSlots = availabilityToSlots(availability);
    const serverSlotsHash = JSON.stringify([...serverSlots].sort());

    // On first load, always initialize from server
    if (!initializedRef.current) {
      setSelectedSlots(serverSlots);
      setHasChanges(false);
      initializedRef.current = true;
      return;
    }

    // If we have a pending save, check if this response matches it
    if (pendingSaveRef.current !== null) {
      // Server response came back - if it matches our pending save, clear the pending flag
      if (serverSlotsHash === pendingSaveRef.current) {
        pendingSaveRef.current = null;
      }
      // Either way, don't overwrite local state while we have pending changes
      return;
    }

    // No pending save - sync from server (e.g., another tab changed data)
    setSelectedSlots(serverSlots);
    setHasChanges(false);
  }, [availability, availabilityToSlots]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handlePointerDown = useCallback(
    (row: number, col: number, slotKey: string) => {
      setIsDragging(true);
      const mode = selectedSlots.has(slotKey) ? "deselect" : "select";
      setDragMode(mode);
      setDragStart({ row, col });
      setDragEnd({ row, col });
    },
    [selectedSlots]
  );

  const handlePointerEnter = useCallback(
    (row: number, col: number) => {
      if (isDragging) {
        setDragEnd({ row, col });
      }
    },
    [isDragging]
  );

  // Convert selected slots to TimeSlot array
  const convertSlotsToTimeSlots = useCallback((slots: Set<string>): TimeSlot[] => {
    const slotsMap = new Map<string, { start: string; end: string }[]>();
    const sortedSlots = Array.from(slots).sort();

    for (const slotKey of sortedSlots) {
      const [date, time] = slotKey.split("-").reduce(
        (acc, part, i) => {
          if (i < 3) {
            acc[0] = acc[0] ? `${acc[0]}-${part}` : part;
          } else {
            acc[1] = part;
          }
          return acc;
        },
        ["", ""] as [string, string]
      );

      const dateSlots = slotsMap.get(date) || [];
      const [h, m] = time.split(":").map(Number);
      const endMinute = m + 30;
      const endTime =
        endMinute >= 60
          ? `${(h + 1).toString().padStart(2, "0")}:00`
          : `${h.toString().padStart(2, "0")}:30`;

      const lastRange = dateSlots[dateSlots.length - 1];
      if (lastRange && lastRange.end === time) {
        lastRange.end = endTime;
      } else {
        dateSlots.push({ start: time, end: endTime });
      }

      slotsMap.set(date, dateSlots);
    }

    const result: TimeSlot[] = [];
    for (const [date, ranges] of slotsMap) {
      for (const range of ranges) {
        result.push({ date, startTime: range.start, endTime: range.end });
      }
    }
    return result;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (isDragging && pendingSlots.size > 0) {
      const nextSlots = new Set(selectedSlots);
      for (const slot of pendingSlots) {
        if (dragMode === "select") {
          nextSlots.add(slot);
        } else {
          nextSlots.delete(slot);
        }
      }
      // Optimistic update - show changes immediately
      setSelectedSlots(nextSlots);
      setHasChanges(true);

      // Auto-save with debounce if enabled
      if (autoSave) {
        // Clear any pending save timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // Track what we're saving to prevent server response from overwriting
        const slotsHash = JSON.stringify([...nextSlots].sort());
        pendingSaveRef.current = slotsHash;

        // Debounce the actual save
        saveTimeoutRef.current = setTimeout(() => {
          const timeSlotsToSave = convertSlotsToTimeSlots(nextSlots);
          onSave(timeSlotsToSave);
        }, 300);
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, pendingSlots, dragMode, selectedSlots, autoSave, convertSlotsToTimeSlots, onSave]);

  // Global pointer up listener
  useEffect(() => {
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerUp]);

  const handleSave = () => {
    const result = convertSlotsToTimeSlots(selectedSlots);
    onSave(result);
    setHasChanges(false);
  };

  // Determine cell state
  const getCellState = (slotKey: string): "selected" | "pending-select" | "pending-deselect" | "unselected" => {
    const isSelected = selectedSlots.has(slotKey);
    const isPending = pendingSlots.has(slotKey);

    if (isPending) {
      return dragMode === "select" ? "pending-select" : "pending-deselect";
    }
    return isSelected ? "selected" : "unselected";
  };

  // Prevent text selection during drag
  const preventSelection = useCallback((e: Event) => {
    if (isDragging) {
      e.preventDefault();
    }
  }, [isDragging]);

  useEffect(() => {
    document.addEventListener("selectstart", preventSelection);
    return () => document.removeEventListener("selectstart", preventSelection);
  }, [preventSelection]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="min-w-[600px]">
            {/* Header skeleton */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="p-2 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Time
              </div>
              {weekDates.map((date) => (
                <div
                  key={date.toISOString()}
                  className="p-2 text-center text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  <div>{format(date, "EEE")}</div>
                  <div className="text-zinc-500 dark:text-zinc-400">
                    {format(date, "M/d")}
                  </div>
                </div>
              ))}
            </div>
            {/* Skeleton grid rows */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {Array.from({ length: Math.min(timeSlots.length, 12) }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[60px_repeat(7,1fr)]"
                >
                  <div className="flex h-6 items-center justify-end pr-2">
                    <div className="h-3 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                  </div>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={j} className="h-6 border-l border-zinc-100 p-0.5 dark:border-zinc-800">
                      <div
                        className="h-full w-full animate-pulse rounded-sm bg-zinc-100 dark:bg-zinc-800"
                        style={{ animationDelay: `${(i * 7 + j) * 30}ms` }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={gridRef}
        className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
        style={{
          touchAction: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none"
        } as React.CSSProperties}
        onMouseDown={() => document.body.style.userSelect = "none"}
        onMouseUp={() => document.body.style.userSelect = ""}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="min-w-[600px]">
          {/* Header row with days */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="p-2 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Time
            </div>
            {weekDates.map((date) => (
              <div
                key={date.toISOString()}
                className="p-2 text-center text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                <div>{format(date, "EEE")}</div>
                <div className="text-zinc-500 dark:text-zinc-400">
                  {format(date, "M/d")}
                </div>
              </div>
            ))}
          </div>

          {/* Time slots grid */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {timeSlots.map((time, rowIndex) => {
              const [hour, minute] = time.split(":").map(Number);
              const isHourMark = minute === 0;

              return (
                <div
                  key={time}
                  className={`grid grid-cols-[60px_repeat(7,1fr)] ${
                    isHourMark
                      ? "border-t border-zinc-200 dark:border-zinc-700"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-center p-1 text-xs text-zinc-400 dark:text-zinc-500">
                    {isHourMark && (() => {
                      // Convert time from event timezone to viewer timezone for display
                      if (eventTimezone && timezone && eventTimezone !== timezone) {
                        try {
                          const dateStr = format(weekDates[0], "yyyy-MM-dd");
                          // Create date in event timezone and convert to viewer timezone
                          const eventDate = fromZonedTime(`${dateStr} ${time}`, eventTimezone);
                          return formatInTimeZone(eventDate, timezone, "h a");
                        } catch {
                          return format(parse(time, "HH:mm", new Date()), "h a");
                        }
                      }
                      return format(parse(time, "HH:mm", new Date()), "h a");
                    })()}
                  </div>
                  {weekDates.map((date, colIndex) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const slotKey = `${dateStr}-${time}`;
                    const cellState = getCellState(slotKey);

                    let cellClass = "bg-white dark:bg-zinc-900";
                    if (cellState === "selected") {
                      cellClass = "bg-green-400 dark:bg-green-600";
                    } else if (cellState === "pending-select") {
                      cellClass = "bg-green-300 dark:bg-green-500";
                    } else if (cellState === "pending-deselect") {
                      cellClass = "bg-red-200 dark:bg-red-400";
                    }

                    return (
                      <div
                        key={slotKey}
                        onPointerDown={() =>
                          handlePointerDown(rowIndex, colIndex, slotKey)
                        }
                        onPointerEnter={() =>
                          handlePointerEnter(rowIndex, colIndex)
                        }
                        className={`h-6 cursor-pointer border-l border-zinc-100 transition-colors dark:border-zinc-800 ${cellClass} ${
                          cellState === "unselected"
                            ? "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            : ""
                        }`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {showLegend && (
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-green-400 dark:bg-green-600" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
              <span>Not available</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {autoSave && isSaving && (
            <span className="text-xs text-zinc-500">Saving...</span>
          )}
          {!autoSave && (
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
