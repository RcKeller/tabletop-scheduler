"use client";

import { useState, useMemo, useCallback } from "react";
import { format, addDays, parse } from "date-fns";
import { HoverDetailPanel } from "./HoverDetailPanel";
import { HeatmapLegend } from "./HeatmapLegend";
import type { TimeSlot } from "@/lib/types";

interface Participant {
  id: string;
  name: string;
  availability: TimeSlot[];
}

interface CombinedHeatmapProps {
  participants: Participant[];
  weekStart: Date;
  earliestTime?: string;
  latestTime?: string;
  sessionLengthMinutes?: number;
}

// Generate time slots (30-min intervals)
function generateTimeSlots(earliest: string, latest: string): string[] {
  const slots: string[] = [];
  const is24Hour = earliest === latest;

  const parseTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const startMins = parseTime(earliest);
  let endMins = parseTime(latest);

  if (is24Hour) {
    endMins = startMins + 24 * 60;
  } else if (endMins <= startMins) {
    endMins += 24 * 60;
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

// Get week dates
function getWeekDates(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Get availability color based on percentage
function getHeatmapColor(availableCount: number, totalCount: number): string {
  if (totalCount === 0) return "bg-zinc-200 dark:bg-zinc-700";

  const percentage = (availableCount / totalCount) * 100;

  if (percentage === 100) return "bg-green-500 dark:bg-green-600";
  if (percentage >= 75) return "bg-green-400 dark:bg-green-500";
  if (percentage >= 50) return "bg-yellow-400 dark:bg-yellow-500";
  if (percentage >= 25) return "bg-orange-400 dark:bg-orange-500";
  if (percentage > 0) return "bg-red-300 dark:bg-red-400";
  return "bg-zinc-200 dark:bg-zinc-700";
}

export function CombinedHeatmap({
  participants,
  weekStart,
  earliestTime = "00:00",
  latestTime = "23:30",
  sessionLengthMinutes = 180,
}: CombinedHeatmapProps) {
  const [hoveredSlot, setHoveredSlot] = useState<{ date: string; time: string } | null>(null);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const timeSlots = useMemo(
    () => generateTimeSlots(earliestTime, latestTime),
    [earliestTime, latestTime]
  );

  // Build availability map: date-time -> participant IDs who are available
  const availabilityMap = useMemo(() => {
    const map = new Map<string, Set<string>>();

    for (const participant of participants) {
      for (const slot of participant.availability) {
        // Expand slot into 30-min intervals
        let currentTime = slot.startTime;
        while (currentTime < slot.endTime) {
          const key = `${slot.date}-${currentTime}`;
          if (!map.has(key)) {
            map.set(key, new Set());
          }
          map.get(key)!.add(participant.id);

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
    }

    return map;
  }, [participants]);

  // Get participants available/unavailable for a slot
  const getSlotParticipants = useCallback(
    (date: string, time: string) => {
      const key = `${date}-${time}`;
      const availableIds = availabilityMap.get(key) || new Set();

      const available = participants.filter((p) => availableIds.has(p.id));
      const unavailable = participants.filter((p) => !availableIds.has(p.id));

      return { available, unavailable };
    },
    [availabilityMap, participants]
  );

  // Get hovered slot details
  const hoveredDetails = useMemo(() => {
    if (!hoveredSlot) {
      return { available: [], unavailable: [] };
    }
    return getSlotParticipants(hoveredSlot.date, hoveredSlot.time);
  }, [hoveredSlot, getSlotParticipants]);

  // Find suggested times (slots where everyone or most people are available)
  const suggestedTimes = useMemo(() => {
    const suggestions: { date: string; time: string; count: number }[] = [];
    const slotsNeeded = Math.ceil(sessionLengthMinutes / 30);

    for (const date of weekDates) {
      const dateStr = format(date, "yyyy-MM-dd");

      for (let i = 0; i <= timeSlots.length - slotsNeeded; i++) {
        // Check if all consecutive slots have good availability
        let minAvailable = participants.length;
        let allSlotsValid = true;

        for (let j = 0; j < slotsNeeded; j++) {
          const time = timeSlots[i + j];
          const key = `${dateStr}-${time}`;
          const available = availabilityMap.get(key)?.size || 0;
          minAvailable = Math.min(minAvailable, available);

          if (available < participants.length * 0.5) {
            allSlotsValid = false;
            break;
          }
        }

        if (allSlotsValid && minAvailable > 0) {
          suggestions.push({
            date: dateStr,
            time: timeSlots[i],
            count: minAvailable,
          });
        }
      }
    }

    // Sort by count (descending) and take top 5
    return suggestions
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [weekDates, timeSlots, availabilityMap, participants.length, sessionLengthMinutes]);

  return (
    <div className="flex gap-4">
      {/* Heatmap Grid */}
      <div className="flex-1 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
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
            {timeSlots.map((time) => {
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
                    {isHourMark &&
                      format(parse(time, "HH:mm", new Date()), "h a")}
                  </div>
                  {weekDates.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const slotKey = `${dateStr}-${time}`;
                    const availableCount =
                      availabilityMap.get(slotKey)?.size || 0;
                    const cellColor = getHeatmapColor(
                      availableCount,
                      participants.length
                    );
                    const isHovered =
                      hoveredSlot?.date === dateStr &&
                      hoveredSlot?.time === time;

                    return (
                      <div
                        key={slotKey}
                        onMouseEnter={() =>
                          setHoveredSlot({ date: dateStr, time })
                        }
                        onMouseLeave={() => setHoveredSlot(null)}
                        className={`h-6 cursor-pointer border-l border-zinc-100 transition-all dark:border-zinc-800 ${cellColor} ${
                          isHovered ? "ring-2 ring-inset ring-blue-500" : ""
                        }`}
                        title={`${availableCount}/${participants.length} available`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-64 shrink-0 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        {hoveredSlot ? (
          <HoverDetailPanel
            date={hoveredSlot.date}
            time={hoveredSlot.time}
            availableParticipants={hoveredDetails.available}
            unavailableParticipants={hoveredDetails.unavailable}
            totalParticipants={participants.length}
          />
        ) : (
          <div className="space-y-6 p-4">
            {/* Legend */}
            <HeatmapLegend totalParticipants={participants.length} />

            {/* Suggested Times */}
            {participants.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Suggested Times
                </div>
                {suggestedTimes.length > 0 ? (
                  <ul className="space-y-2">
                    {suggestedTimes.map((suggestion, idx) => {
                      const dateObj = new Date(suggestion.date);
                      const timeObj = parse(
                        suggestion.time,
                        "HH:mm",
                        new Date()
                      );
                      return (
                        <li
                          key={idx}
                          className="rounded-md bg-green-50 p-2 text-sm dark:bg-green-900/20"
                        >
                          <div className="font-medium text-green-700 dark:text-green-400">
                            {format(dateObj, "EEE, MMM d")}
                          </div>
                          <div className="text-green-600 dark:text-green-500">
                            {format(timeObj, "h:mm a")} ({suggestion.count}/
                            {participants.length})
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
                    No times found where most players are available
                  </p>
                )}
              </div>
            )}

            {participants.length === 0 && (
              <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
                Waiting for players to submit their availability
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
