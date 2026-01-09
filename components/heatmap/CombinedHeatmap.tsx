"use client";

import { useState, useMemo, useCallback } from "react";
import { format, parse } from "date-fns";
import { HoverDetailPanel } from "./HoverDetailPanel";
import { HeatmapLegend } from "./HeatmapLegend";
import type { TimeSlot } from "@/lib/types";
import { generateTimeSlots, getWeekDates } from "@/lib/utils/time-slots";
import { utcToLocal } from "@/lib/utils/timezone";

interface Participant {
  id: string;
  name: string;
  availability: TimeSlot[];
}

interface SessionDetails {
  campaignType?: "ONESHOT" | "CAMPAIGN";
  sessionLengthMinutes: number;
  meetingType?: string | null;
  meetingLocation?: string | null;
  dateRange?: string | null;
  timeWindow?: string;
}

interface CombinedHeatmapProps {
  participants: Participant[];  // Availability data is in UTC
  weekStart: Date;
  earliestTime?: string;  // Time window in UTC
  latestTime?: string;    // Time window in UTC
  sessionLengthMinutes?: number;
  timezone?: string;  // User's display timezone (defaults to UTC)
  sessionDetails?: SessionDetails;
}

// Get availability color based on percentage (light to dark green scale)
function getHeatmapColor(availableCount: number, totalCount: number): string {
  if (totalCount === 0) return "bg-zinc-200 dark:bg-zinc-700";

  const percentage = (availableCount / totalCount) * 100;

  if (percentage === 100) return "bg-green-600 dark:bg-green-500";
  if (percentage >= 75) return "bg-green-500 dark:bg-green-600";
  if (percentage >= 50) return "bg-green-400 dark:bg-green-500";
  if (percentage >= 25) return "bg-green-300 dark:bg-green-400";
  if (percentage > 0) return "bg-green-200 dark:bg-green-300";
  return "bg-zinc-200 dark:bg-zinc-700";
}

export function CombinedHeatmap({
  participants,
  weekStart,
  earliestTime = "00:00",
  latestTime = "23:30",
  sessionLengthMinutes = 180,
  timezone = "UTC",
  sessionDetails,
}: CombinedHeatmapProps) {
  // UTC-first: All incoming data is in UTC, convert to user's timezone for display
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

  // Format session length for display
  const sessionLengthDisplay = useMemo(() => {
    const hours = Math.floor(sessionLengthMinutes / 60);
    const mins = sessionLengthMinutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }, [sessionLengthMinutes]);

  return (
    <div className="space-y-4">
      {/* Main content: Heatmap + Hover panel side by side */}
      <div className="flex gap-4">
        {/* Heatmap Grid */}
        <div
          className="flex-1 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
          style={{
            touchAction: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none"
          } as React.CSSProperties}
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
                      {isHourMark && (() => {
                        // UTC-first: Convert UTC time to user's timezone for display
                        const dateStr = format(weekDates[0], "yyyy-MM-dd");
                        const localTime = utcToLocal(time, dateStr, timezone);
                        const timeObj = parse(localTime.time, "HH:mm", new Date());
                        return format(timeObj, "h a");
                      })()}
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

        {/* Sidebar - fixed height to prevent layout shift */}
        <div className="w-64 shrink-0">
          <div className="sticky top-0 min-h-[200px] rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            {hoveredSlot ? (
              <HoverDetailPanel
                date={hoveredSlot.date}
                time={hoveredSlot.time}
                availableParticipants={hoveredDetails.available}
                unavailableParticipants={hoveredDetails.unavailable}
                totalParticipants={participants.length}
              />
            ) : (
              <div className="p-4">
                {sessionDetails ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Session Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      {sessionDetails.campaignType && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Type</span>
                          <span className="text-zinc-900 dark:text-zinc-100">
                            {sessionDetails.campaignType === "ONESHOT" ? "One-Shot" : "Campaign"}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Length</span>
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {sessionDetails.sessionLengthMinutes >= 60
                            ? `${Math.floor(sessionDetails.sessionLengthMinutes / 60)}h${sessionDetails.sessionLengthMinutes % 60 > 0 ? ` ${sessionDetails.sessionLengthMinutes % 60}m` : ""}`
                            : `${sessionDetails.sessionLengthMinutes}m`
                          }
                        </span>
                      </div>
                      {sessionDetails.timeWindow && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Window</span>
                          <span className="text-zinc-900 dark:text-zinc-100">
                            {sessionDetails.timeWindow}
                          </span>
                        </div>
                      )}
                      {sessionDetails.meetingType && (
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Platform</span>
                          <span className="text-zinc-900 dark:text-zinc-100">
                            {sessionDetails.meetingType}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        Hover over a time slot to see who's available
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <HeatmapLegend totalParticipants={participants.length} />
                    {participants.length === 0 && (
                      <p className="mt-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
                        Waiting for players to submit availability
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Times - separate section below heatmap */}
      {participants.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Suggested Times
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {sessionLengthDisplay} sessions
            </span>
          </div>
          {suggestedTimes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestedTimes.map((suggestion, idx) => {
                const dateObj = new Date(suggestion.date);
                const timeObj = parse(suggestion.time, "HH:mm", new Date());
                const endTime = new Date(timeObj);
                endTime.setMinutes(endTime.getMinutes() + sessionLengthMinutes);

                return (
                  <div
                    key={idx}
                    className="rounded-md bg-green-50 px-3 py-2 dark:bg-green-900/20"
                  >
                    <div className="text-sm font-medium text-green-700 dark:text-green-400">
                      {format(dateObj, "EEE, MMM d")}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-500">
                      {format(timeObj, "h:mm a")} - {format(endTime, "h:mm a")}
                    </div>
                    <div className="mt-0.5 text-xs text-green-500 dark:text-green-600">
                      {suggestion.count}/{participants.length} available
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No times found where most players are available for a full {sessionLengthDisplay} session
            </p>
          )}
        </div>
      )}
    </div>
  );
}
