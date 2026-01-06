"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { format, addDays, startOfWeek, parse } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { TimeSlot } from "@/lib/types";

interface AvailabilityGridProps {
  availability: TimeSlot[];
  timezone: string;
  onSave: (slots: TimeSlot[]) => void;
  isSaving: boolean;
}

// Generate time slots (30-min intervals from 6am to midnight)
const TIME_SLOTS = Array.from({ length: 36 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
});

// Generate next 7 days
function getWeekDates(): Date[] {
  const today = startOfWeek(new Date(), { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

export function AvailabilityGrid({
  availability,
  timezone,
  onSave,
  isSaving,
}: AvailabilityGridProps) {
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"select" | "deselect">("select");
  const [hasChanges, setHasChanges] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const weekDates = getWeekDates();

  // Initialize selected slots from availability
  useEffect(() => {
    const slots = new Set<string>();
    for (const slot of availability) {
      // Add all 30-min intervals in this slot
      let currentTime = slot.startTime;
      while (currentTime < slot.endTime) {
        slots.add(`${slot.date}-${currentTime}`);
        // Increment by 30 minutes
        const [h, m] = currentTime.split(":").map(Number);
        const nextMinute = m + 30;
        if (nextMinute >= 60) {
          currentTime = `${(h + 1).toString().padStart(2, "0")}:00`;
        } else {
          currentTime = `${h.toString().padStart(2, "0")}:30`;
        }
      }
    }
    setSelectedSlots(slots);
  }, [availability]);

  const toggleSlot = useCallback((slotKey: string, forceMode?: "select" | "deselect") => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      const mode = forceMode || (next.has(slotKey) ? "deselect" : "select");
      if (mode === "select") {
        next.add(slotKey);
      } else {
        next.delete(slotKey);
      }
      return next;
    });
    setHasChanges(true);
  }, []);

  const handlePointerDown = useCallback((slotKey: string) => {
    setIsDragging(true);
    const mode = selectedSlots.has(slotKey) ? "deselect" : "select";
    setDragMode(mode);
    toggleSlot(slotKey, mode);
  }, [selectedSlots, toggleSlot]);

  const handlePointerEnter = useCallback((slotKey: string) => {
    if (isDragging) {
      toggleSlot(slotKey, dragMode);
    }
  }, [isDragging, dragMode, toggleSlot]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global pointer up listener
  useEffect(() => {
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerUp]);

  const handleSave = () => {
    // Convert selected slots to TimeSlot format
    const slotsMap = new Map<string, { start: string; end: string }[]>();

    // Group by date and find contiguous ranges
    const sortedSlots = Array.from(selectedSlots).sort();

    for (const slotKey of sortedSlots) {
      const [date, time] = slotKey.split("-").reduce((acc, part, i) => {
        if (i < 3) {
          acc[0] = acc[0] ? `${acc[0]}-${part}` : part;
        } else {
          acc[1] = part;
        }
        return acc;
      }, ["", ""] as [string, string]);

      const dateSlots = slotsMap.get(date) || [];

      // Calculate end time (30 mins later)
      const [h, m] = time.split(":").map(Number);
      const endMinute = m + 30;
      const endTime = endMinute >= 60
        ? `${(h + 1).toString().padStart(2, "0")}:00`
        : `${h.toString().padStart(2, "0")}:30`;

      // Try to extend existing range
      const lastRange = dateSlots[dateSlots.length - 1];
      if (lastRange && lastRange.end === time) {
        lastRange.end = endTime;
      } else {
        dateSlots.push({ start: time, end: endTime });
      }

      slotsMap.set(date, dateSlots);
    }

    // Convert to TimeSlot array
    const result: TimeSlot[] = [];
    for (const [date, ranges] of slotsMap) {
      for (const range of ranges) {
        result.push({
          date,
          startTime: range.start,
          endTime: range.end,
        });
      }
    }

    onSave(result);
    setHasChanges(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Click and drag to select available times
        </p>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div
        ref={gridRef}
        className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
        style={{ touchAction: "none" }}
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
            {TIME_SLOTS.map((time) => {
              const [hour, minute] = time.split(":").map(Number);
              const isHourMark = minute === 0;

              return (
                <div
                  key={time}
                  className={`grid grid-cols-[60px_repeat(7,1fr)] ${
                    isHourMark ? "border-t border-zinc-200 dark:border-zinc-700" : ""
                  }`}
                >
                  <div className="flex items-center justify-center p-1 text-xs text-zinc-400 dark:text-zinc-500">
                    {isHourMark && format(parse(time, "HH:mm", new Date()), "h a")}
                  </div>
                  {weekDates.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const slotKey = `${dateStr}-${time}`;
                    const isSelected = selectedSlots.has(slotKey);

                    return (
                      <div
                        key={slotKey}
                        onPointerDown={() => handlePointerDown(slotKey)}
                        onPointerEnter={() => handlePointerEnter(slotKey)}
                        className={`h-6 cursor-pointer border-l border-zinc-100 transition-colors dark:border-zinc-800 ${
                          isSelected
                            ? "bg-green-400 dark:bg-green-600"
                            : "bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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

      <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-green-400 dark:bg-green-600" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700" />
          <span>Not available</span>
        </div>
      </div>
    </div>
  );
}
