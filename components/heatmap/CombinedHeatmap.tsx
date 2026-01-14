"use client";

import { useState, useMemo, useCallback } from "react";
import { format, parse } from "date-fns";
import { VirtualizedAvailabilityGrid } from "../availability/VirtualizedAvailabilityGrid";
import { HoverDetailPanel } from "./HoverDetailPanel";
import type { TimeSlot } from "@/lib/types";

interface Participant {
  id: string;
  name: string;
  availability: TimeSlot[];
}

interface CombinedHeatmapProps {
  participants: Participant[];
  startDate: Date;
  endDate: Date;
  earliestTime?: string;
  latestTime?: string;
  gmAvailability?: TimeSlot[];
  sessionLengthMinutes?: number;
  timezone?: string;
  showGmToggle?: boolean;
}

export function CombinedHeatmap({
  participants,
  startDate,
  endDate,
  earliestTime = "00:00",
  latestTime = "23:30",
  gmAvailability = [],
  sessionLengthMinutes = 180,
  timezone = "UTC",
  showGmToggle = false,
}: CombinedHeatmapProps) {
  const [hoveredSlot, setHoveredSlot] = useState<{
    date: string;
    time: string;
    available: Participant[];
    unavailable: Participant[];
  } | null>(null);

  const [clampToGm, setClampToGm] = useState(false);

  // Compute effective time window based on GM availability toggle
  const effectiveTimeWindow = useMemo(() => {
    if (!clampToGm || gmAvailability.length === 0) {
      return { earliest: earliestTime, latest: latestTime };
    }

    // Find the earliest start and latest end across all GM availability
    let earliest = "23:59";
    let latest = "00:00";

    for (const slot of gmAvailability) {
      if (slot.startTime < earliest) earliest = slot.startTime;
      if (slot.endTime > latest) latest = slot.endTime;
    }

    return { earliest, latest };
  }, [clampToGm, gmAvailability, earliestTime, latestTime]);

  // Handle hover events from grid
  const handleHoverSlot = useCallback((
    date: string,
    time: string,
    available: Participant[],
    unavailable: Participant[]
  ) => {
    setHoveredSlot({ date, time, available, unavailable });
  }, []);

  const handleLeaveSlot = useCallback(() => {
    setHoveredSlot(null);
  }, []);

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
      {/* GM Time Clamp Toggle */}
      {showGmToggle && gmAvailability.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={clampToGm}
              onChange={(e) => setClampToGm(e.target.checked)}
              className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Show only times GM is available
          </label>
        </div>
      )}

      {/* Main content: Grid + Hover panel */}
      <div className="flex gap-4">
        {/* Availability Grid */}
        <div className="flex-1">
          <VirtualizedAvailabilityGrid
            startDate={startDate}
            endDate={endDate}
            earliestTime={effectiveTimeWindow.earliest}
            latestTime={effectiveTimeWindow.latest}
            mode="heatmap"
            participants={participants}
            gmAvailability={gmAvailability}
            onHoverSlot={handleHoverSlot}
            onLeaveSlot={handleLeaveSlot}
            timezone={timezone}
            disabled
          />
        </div>

        {/* Sidebar - Hover details */}
        <div className="w-64 shrink-0 hidden md:block">
          <div className="sticky top-4 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            {hoveredSlot ? (
              <HoverDetailPanel
                date={hoveredSlot.date}
                time={hoveredSlot.time}
                availableParticipants={hoveredSlot.available}
                unavailableParticipants={hoveredSlot.unavailable}
                totalParticipants={participants.length}
              />
            ) : (
              <div className="p-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Group Availability
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Hover over time slots to see who&apos;s available
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Players</span>
                      <span className="text-zinc-900 dark:text-zinc-100">{participants.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Session</span>
                      <span className="text-zinc-900 dark:text-zinc-100">{sessionLengthDisplay}</span>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Legend</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="w-4 h-4 rounded bg-green-500" />
                      <span>All available</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="w-4 h-4 rounded bg-green-300" />
                      <span>Some available</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-700" />
                      <span>None available</span>
                    </div>
                    {gmAvailability.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <div
                          className="w-4 h-4 rounded bg-zinc-300 dark:bg-zinc-600"
                          style={{
                            backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(59, 130, 246, 0.5) 2px, rgba(59, 130, 246, 0.5) 4px)",
                            backgroundSize: "6px 6px"
                          }}
                        />
                        <span>GM available</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Times */}
      {participants.length > 0 && (
        <SuggestedTimes
          participants={participants}
          sessionLengthMinutes={sessionLengthMinutes}
          sessionLengthDisplay={sessionLengthDisplay}
        />
      )}
    </div>
  );
}

// Separate component for suggested times to avoid re-renders
function SuggestedTimes({
  participants,
  sessionLengthMinutes,
  sessionLengthDisplay,
}: {
  participants: Participant[];
  sessionLengthMinutes: number;
  sessionLengthDisplay: string;
}) {
  // Build availability map for finding suggestions
  const suggestedTimes = useMemo(() => {
    const slotsNeeded = Math.ceil(sessionLengthMinutes / 30);
    const availabilityMap = new Map<string, Set<string>>();

    // Build map from participant availability
    for (const participant of participants) {
      for (const slot of participant.availability) {
        if (slot.startTime >= slot.endTime) continue;

        let currentTime = slot.startTime;
        let iterations = 0;

        while (currentTime < slot.endTime && iterations < 48) {
          const key = `${slot.date}-${currentTime}`;
          if (!availabilityMap.has(key)) {
            availabilityMap.set(key, new Set());
          }
          availabilityMap.get(key)!.add(participant.id);

          // Increment by 30 minutes
          const [h, m] = currentTime.split(":").map(Number);
          iterations++;
          const nextMinute = m + 30;
          if (nextMinute >= 60) {
            currentTime = `${(h + 1).toString().padStart(2, "0")}:00`;
          } else {
            currentTime = `${h.toString().padStart(2, "0")}:30`;
          }
        }
      }
    }

    // Find time blocks where most people are available
    const suggestions: { date: string; time: string; count: number }[] = [];
    const checkedStarts = new Set<string>();

    for (const [key] of availabilityMap) {
      const [datePart, timePart] = [key.substring(0, 10), key.substring(11)];
      const startKey = `${datePart}-${timePart}`;

      if (checkedStarts.has(startKey)) continue;
      checkedStarts.add(startKey);

      // Check consecutive slots
      let minAvailable = participants.length;
      let allSlotsValid = true;
      let checkTime = timePart;

      for (let j = 0; j < slotsNeeded; j++) {
        const checkKey = `${datePart}-${checkTime}`;
        const available = availabilityMap.get(checkKey)?.size || 0;
        minAvailable = Math.min(minAvailable, available);

        if (available < participants.length * 0.5) {
          allSlotsValid = false;
          break;
        }

        // Increment time
        const [h, m] = checkTime.split(":").map(Number);
        const nextMinute = m + 30;
        if (nextMinute >= 60) {
          checkTime = `${(h + 1).toString().padStart(2, "0")}:00`;
        } else {
          checkTime = `${h.toString().padStart(2, "0")}:30`;
        }
      }

      if (allSlotsValid && minAvailable > 0) {
        suggestions.push({
          date: datePart,
          time: timePart,
          count: minAvailable,
        });
      }
    }

    return suggestions
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [participants, sessionLengthMinutes]);

  if (suggestedTimes.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Suggested Times
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No times found where most players are available for a full {sessionLengthDisplay} session
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Suggested Times
        </h3>
        <span className="text-xs text-zinc-500">{sessionLengthDisplay} sessions</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestedTimes.map((suggestion, idx) => {
          const dateObj = new Date(suggestion.date + "T12:00:00Z");
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
    </div>
  );
}
