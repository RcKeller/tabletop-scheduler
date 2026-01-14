"use client";

import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
} from "ag-grid-community";
import { format, eachDayOfInterval, startOfWeek, addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type {
  ColDef,
  ColGroupDef,
  CellClassParams,
  GridReadyEvent,
  CellMouseDownEvent,
  CellMouseOverEvent,
  GridApi,
} from "ag-grid-community";
import type { TimeSlot } from "@/lib/types";
import { generateTimeSlots, addThirtyMinutes } from "@/lib/utils/time-slots";
import { utcToLocal, localToUTC, convertDateTime } from "@/lib/utils/timezone";
import { timeToMinutes, minutesToTime } from "@/lib/availability/range-math";

/**
 * Convert availability array from UTC to local timezone for display
 * Handles slots that cross midnight when converted (splits them into two slots)
 * Also handles "24:00" endTime which represents "end of this day" (midnight)
 */
function convertAvailabilityToLocal(
  availability: TimeSlot[],
  timezone: string
): TimeSlot[] {
  if (timezone === "UTC") return availability;

  const result: TimeSlot[] = [];

  for (const slot of availability) {
    const start = utcToLocal(slot.startTime, slot.date, timezone);

    // Handle "24:00" as "end of this day" = "00:00 of next day"
    let end;
    if (slot.endTime === "24:00") {
      const nextDate = new Date(slot.date + "T12:00:00Z");
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextDateStr = nextDate.toISOString().split("T")[0];
      end = utcToLocal("00:00", nextDateStr, timezone);
    } else {
      end = utcToLocal(slot.endTime, slot.date, timezone);
    }

    if (start.date === end.date) {
      // Same day - simple case
      if (start.time < end.time) {
        result.push({
          date: start.date,
          startTime: start.time,
          endTime: end.time,
        });
      }
    } else {
      // Slot crosses midnight when converted to local - split into two slots
      // First part: from start time to midnight on start date
      result.push({
        date: start.date,
        startTime: start.time,
        endTime: "24:00",
      });
      // Second part: from midnight to end time on end date
      if (end.time > "00:00") {
        result.push({
          date: end.date,
          startTime: "00:00",
          endTime: end.time,
        });
      }
    }
  }

  // Merge adjacent slots on the same date
  return mergeAdjacentSlots(result);
}

/**
 * Merge adjacent slots on the same date to create continuous ranges
 */
function mergeAdjacentSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];

  // Group by date
  const byDate = new Map<string, { startTime: string; endTime: string }[]>();
  for (const slot of slots) {
    if (!byDate.has(slot.date)) {
      byDate.set(slot.date, []);
    }
    byDate.get(slot.date)!.push({ startTime: slot.startTime, endTime: slot.endTime });
  }

  const result: TimeSlot[] = [];

  for (const [date, daySlots] of byDate) {
    // Sort by start time
    daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Merge adjacent/overlapping slots
    let current = daySlots[0];
    for (let i = 1; i < daySlots.length; i++) {
      const next = daySlots[i];
      // Check if adjacent or overlapping (endTime >= next.startTime)
      if (current.endTime >= next.startTime) {
        // Merge: extend current's end time
        current = {
          startTime: current.startTime,
          endTime: current.endTime > next.endTime ? current.endTime : next.endTime,
        };
      } else {
        // Gap: push current and start new
        result.push({ date, ...current });
        current = next;
      }
    }
    result.push({ date, ...current });
  }

  return result;
}

/**
 * Convert availability array from local timezone to UTC for storage
 * Handles slots that cross midnight when converted (splits them into two slots)
 */
function convertAvailabilityToUTC(
  availability: TimeSlot[],
  timezone: string
): TimeSlot[] {
  if (timezone === "UTC") return availability;

  const result: TimeSlot[] = [];

  for (const slot of availability) {
    const start = localToUTC(slot.startTime, slot.date, timezone);
    const end = localToUTC(slot.endTime, slot.date, timezone);

    if (start.date === end.date) {
      // Same day - simple case
      if (start.time < end.time) {
        result.push({
          date: start.date,
          startTime: start.time,
          endTime: end.time,
        });
      }
    } else {
      // Slot crosses midnight when converted to UTC - split into two slots
      result.push({
        date: start.date,
        startTime: start.time,
        endTime: "23:59",
      });
      if (end.time > "00:00") {
        result.push({
          date: end.date,
          startTime: "00:00",
          endTime: end.time,
        });
      }
    }
  }

  return result;
}

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface Participant {
  id: string;
  name: string;
  availability: TimeSlot[];
}

interface VirtualizedAvailabilityGridProps {
  startDate: Date;
  endDate: Date;
  earliestTime?: string;  // Time window start (in timeWindowTimezone if provided, else local)
  latestTime?: string;    // Time window end (in timeWindowTimezone if provided, else local)
  timeWindowTimezone?: string;  // Source timezone of earliestTime/latestTime (converts to user's timezone)
  mode: "edit" | "heatmap";
  availability?: TimeSlot[];  // Availability data (in UTC)
  onSave?: (slots: TimeSlot[]) => void;  // Returns UTC times
  isSaving?: boolean;
  autoSave?: boolean;
  participants?: Participant[];  // Participant availability (in UTC)
  onHoverSlot?: (date: string, time: string, available: Participant[], unavailable: Participant[]) => void;
  onLeaveSlot?: () => void;
  timezone?: string;  // User's display timezone (defaults to UTC)
  gmAvailability?: TimeSlot[];  // GM's availability for visual indication (in UTC)
  disabled?: boolean;  // Disable interactions (view-only mode)
  compact?: boolean;  // Use smaller cell sizes
}

// Build availability lookup from TimeSlot array
function buildAvailabilitySet(availability: TimeSlot[]): Set<string> {
  const set = new Set<string>();
  for (const slot of availability) {
    // Skip invalid slots where start >= end (except for overnight which we don't support here)
    if (slot.startTime >= slot.endTime) continue;

    let currentTime = slot.startTime;
    let iterations = 0;
    const maxIterations = 48; // Max 48 half-hour slots in a day

    while (currentTime < slot.endTime && iterations < maxIterations) {
      set.add(`${slot.date}-${currentTime}`);
      currentTime = addThirtyMinutes(currentTime);
      iterations++;
    }
  }
  return set;
}

// Convert set of slot keys back to TimeSlot array
function setToTimeSlots(keys: Set<string>): TimeSlot[] {
  const sortedKeys = Array.from(keys).sort();
  const slotsMap = new Map<string, { start: string; end: string }[]>();

  for (const key of sortedKeys) {
    const parts = key.split("-");
    const date = `${parts[0]}-${parts[1]}-${parts[2]}`;
    const time = parts[3];

    const dateSlots = slotsMap.get(date) || [];
    const endTime = addThirtyMinutes(time);

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
}

// Serialize availability for comparison
function serializeAvailability(availability: TimeSlot[]): string {
  return availability
    .map(s => `${s.date}|${s.startTime}|${s.endTime}`)
    .sort()
    .join(",");
}

// Get heatmap background color
function getHeatmapBgColor(count: number, total: number, isDark: boolean): string {
  if (total === 0) return isDark ? "#27272a" : "#e4e4e7";
  const pct = count / total;
  if (pct === 1) return isDark ? "#15803d" : "#16a34a";
  if (pct >= 0.75) return isDark ? "#16a34a" : "#22c55e";
  if (pct >= 0.5) return isDark ? "#22c55e" : "#4ade80";
  if (pct >= 0.25) return isDark ? "#4ade80" : "#86efac";
  if (pct > 0) return isDark ? "#86efac" : "#bbf7d0";
  return isDark ? "#27272a" : "#e4e4e7";
}

// Group dates by week, returning "Week 1", "Week 2", etc.
function groupDatesByWeek(dates: Date[]): Map<string, Date[]> {
  const groups = new Map<string, Date[]>();
  const weekStarts = new Map<string, number>(); // weekStartKey -> weekNumber
  let weekCounter = 1;

  for (const date of dates) {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekStartKey = format(weekStart, "yyyy-MM-dd");

    if (!weekStarts.has(weekStartKey)) {
      weekStarts.set(weekStartKey, weekCounter++);
    }

    const weekNum = weekStarts.get(weekStartKey)!;
    const weekLabel = `Week ${weekNum}`;

    if (!groups.has(weekLabel)) {
      groups.set(weekLabel, []);
    }
    groups.get(weekLabel)!.push(date);
  }

  return groups;
}

export function VirtualizedAvailabilityGrid({
  startDate,
  endDate,
  earliestTime = "00:00",
  latestTime = "23:30",
  timeWindowTimezone,
  mode,
  availability = [],
  onSave,
  isSaving = false,
  autoSave = false,
  participants = [],
  onHoverSlot,
  onLeaveSlot,
  timezone = "UTC",
  gmAvailability = [],
  disabled = false,
  compact = false,
}: VirtualizedAvailabilityGridProps) {
  // UTC-first architecture:
  // - Availability data is always in UTC, convert to user's timezone for display
  // - Time window (earliestTime/latestTime) is in timeWindowTimezone if provided, else already local
  // - Convert back to UTC when saving
  const userTimezone = timezone;

  // Convert availability from UTC to user's timezone for display
  const displayAvailability = useMemo(() => {
    return convertAvailabilityToLocal(availability, userTimezone);
  }, [availability, userTimezone]);

  // Convert participants' availability from UTC to user's timezone for heatmap
  const displayParticipants = useMemo(() => {
    return participants.map(p => ({
      ...p,
      availability: convertAvailabilityToLocal(p.availability, userTimezone),
    }));
  }, [participants, userTimezone]);

  // Convert GM availability from UTC to user's timezone for visual indication
  const displayGmAvailability = useMemo(() => {
    return convertAvailabilityToLocal(gmAvailability, userTimezone);
  }, [gmAvailability, userTimezone]);

  // Build set of GM available slots for quick lookup
  const gmAvailableSlots = useMemo(() => {
    return buildAvailabilitySet(displayGmAvailability);
  }, [displayGmAvailability]);

  const gridRef = useRef<AgGridReact>(null);
  const gridApiRef = useRef<GridApi | null>(null);

  // Track the last serialized availability to detect actual changes
  const lastAvailabilityRef = useRef<string>("");
  // Track if we have local changes pending save (don't sync from props while pending)
  const hasPendingChangesRef = useRef(false);

  // Use refs for drag state to avoid re-renders during drag
  const selectedSlotsRef = useRef<Set<string>>(new Set());
  const pendingCellsRef = useRef<Set<string>>(new Set());
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<"select" | "deselect">("select");
  const dragStartRef = useRef<{ row: number; col: string } | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshFrameRef = useRef<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  // Sync selectedSlots when availability prop changes (only if actually different and no pending local changes)
  useEffect(() => {
    const serialized = serializeAvailability(displayAvailability);

    // If props match our local state, clear the pending flag
    if (serialized === lastAvailabilityRef.current) {
      hasPendingChangesRef.current = false;
      return;
    }

    // Don't sync from props if we have pending local changes (prevents flash during rapid edits)
    if (hasPendingChangesRef.current) {
      return;
    }

    lastAvailabilityRef.current = serialized;
    selectedSlotsRef.current = buildAvailabilitySet(displayAvailability);
    // Refresh grid if it exists using requestAnimationFrame for smoother updates
    if (gridApiRef.current) {
      if (refreshFrameRef.current) {
        cancelAnimationFrame(refreshFrameRef.current);
      }
      refreshFrameRef.current = requestAnimationFrame(() => {
        gridApiRef.current?.refreshCells({ force: true });
        refreshFrameRef.current = null;
      });
    }
  }, [displayAvailability]);

  // Cleanup animation frames and timeouts on unmount
  useEffect(() => {
    return () => {
      if (refreshFrameRef.current) {
        cancelAnimationFrame(refreshFrameRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Convert the time window for Y-axis display if needed
  // - If timeWindowTimezone is provided and different from userTimezone: convert
  // - Otherwise: use as-is (already in user's local timezone)
  const displayTimeWindow = useMemo(() => {
    if (!timeWindowTimezone || timeWindowTimezone === userTimezone) {
      return { earliest: earliestTime, latest: latestTime };
    }
    // Convert from source timezone to user's timezone
    const refDate = format(startDate, "yyyy-MM-dd");
    const localEarliest = convertDateTime(earliestTime, refDate, timeWindowTimezone, userTimezone);
    const localLatest = convertDateTime(latestTime, refDate, timeWindowTimezone, userTimezone);
    return { earliest: localEarliest.time, latest: localLatest.time };
  }, [earliestTime, latestTime, timeWindowTimezone, userTimezone, startDate]);

  // Generate all dates in range
  // Use noon UTC to avoid date-shifting issues when converting to other timezones
  // This ensures the "date" portion is stable across all timezones
  const allDates = useMemo(() => {
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    // Adjust each date to noon UTC to make date formatting timezone-stable
    // This prevents dates from shifting when formatted in negative-offset timezones
    return dates.map(d => {
      const noon = new Date(d);
      noon.setUTCHours(12, 0, 0, 0);
      return noon;
    });
  }, [startDate, endDate]);

  // Pre-compute date strings for performance
  // Format in user's timezone - since we're using noon UTC, the date won't shift
  // for any timezone within +/- 12 hours of UTC (covers all timezones)
  const dateStrings = useMemo(() => {
    return allDates.map(d => formatInTimeZone(d, userTimezone, "yyyy-MM-dd"));
  }, [allDates, userTimezone]);

  // Generate time slots using the converted time window
  const timeSlots = useMemo(
    () => generateTimeSlots(displayTimeWindow.earliest, displayTimeWindow.latest),
    [displayTimeWindow.earliest, displayTimeWindow.latest]
  );

  // Helper to convert user's local timezone slots back to UTC for saving
  const convertToUTC = useCallback((slots: TimeSlot[]): TimeSlot[] => {
    return convertAvailabilityToUTC(slots, userTimezone);
  }, [userTimezone]);

  // Build heatmap data
  const heatmapData = useMemo(() => {
    if (mode !== "heatmap") return new Map<string, Set<string>>();

    const map = new Map<string, Set<string>>();
    for (const p of displayParticipants) {
      for (const slot of p.availability) {
        // Skip invalid slots where start >= end
        if (slot.startTime >= slot.endTime) continue;

        let currentTime = slot.startTime;
        let iterations = 0;
        const maxIterations = 48; // Max 48 half-hour slots in a day

        while (currentTime < slot.endTime && iterations < maxIterations) {
          const key = `${slot.date}-${currentTime}`;
          if (!map.has(key)) map.set(key, new Set());
          map.get(key)!.add(p.id);
          currentTime = addThirtyMinutes(currentTime);
          iterations++;
        }
      }
    }
    return map;
  }, [mode, displayParticipants]);

  // Check if the time window is overnight (earliest > latest means it crosses midnight)
  const isOvernightWindow = useMemo(() => {
    return displayTimeWindow.earliest > displayTimeWindow.latest;
  }, [displayTimeWindow.earliest, displayTimeWindow.latest]);

  // Static row data - doesn't include selection state
  const rowData = useMemo(() => {
    return timeSlots.map((time, rowIndex) => {
      const row: Record<string, unknown> = {
        time,
        rowIndex,
        _timeDisplay: (() => {
          const [h, m] = time.split(":").map(Number);
          if (m !== 0) return "";
          const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
          const ampm = h < 12 ? "AM" : "PM";
          return `${hour12}${ampm}`;
        })(),
      };

      // For heatmap mode, include counts
      if (mode === "heatmap") {
        // For overnight windows (e.g., 18:00-08:00), times after midnight (00:00-07:30)
        // actually fall on the NEXT calendar day
        const isAfterMidnight = isOvernightWindow && time < displayTimeWindow.latest;

        for (let colIdx = 0; colIdx < dateStrings.length; colIdx++) {
          const dateStr = dateStrings[colIdx];
          // For after-midnight times, look up the next day's date
          // The availability data has the correct date because it was converted from UTC
          let lookupDate = dateStr;
          if (isAfterMidnight) {
            // Get the next date in the user's timezone
            const nextDayDateStr = colIdx + 1 < dateStrings.length
              ? dateStrings[colIdx + 1]
              : formatInTimeZone(addDays(allDates[colIdx], 1), userTimezone, "yyyy-MM-dd");
            lookupDate = nextDayDateStr;
          }
          const key = `${lookupDate}-${time}`;
          row[dateStr] = heatmapData.get(key)?.size || 0;
        }
      } else {
        // For edit mode, just set a placeholder - styling handles the rest
        for (const dateStr of dateStrings) {
          row[dateStr] = 0;
        }
      }

      return row;
    });
  }, [timeSlots, dateStrings, mode, heatmapData, isOvernightWindow, displayTimeWindow.latest, allDates, userTimezone]);

  // Calculate pending cells during drag (no state update)
  const calculatePendingCells = useCallback((
    startRow: number,
    startCol: string,
    endRow: number,
    endCol: string
  ): Set<string> => {
    const pending = new Set<string>();
    const startColIdx = dateStrings.indexOf(startCol);
    const endColIdx = dateStrings.indexOf(endCol);

    if (startColIdx === -1 || endColIdx === -1) return pending;

    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const dateStr = dateStrings[c];
        const time = timeSlots[r];
        if (dateStr && time) {
          pending.add(`${dateStr}-${time}`);
        }
      }
    }

    return pending;
  }, [dateStrings, timeSlots]);

  // Batch refresh using requestAnimationFrame to prevent multiple refreshes per frame
  const pendingRefreshRef = useRef<number | null>(null);
  const refreshGrid = useCallback(() => {
    if (pendingRefreshRef.current) return; // Already scheduled
    pendingRefreshRef.current = requestAnimationFrame(() => {
      if (gridApiRef.current) {
        gridApiRef.current.refreshCells({ force: true });
      }
      pendingRefreshRef.current = null;
    });
  }, []);

  // Cleanup pending refresh on unmount
  useEffect(() => {
    return () => {
      if (pendingRefreshRef.current) {
        cancelAnimationFrame(pendingRefreshRef.current);
      }
    };
  }, []);

  // Mouse down handler
  const handleCellMouseDown = useCallback((event: CellMouseDownEvent) => {
    if (mode !== "edit" || disabled) return;
    const field = event.colDef.field;
    if (!field || field === "time" || field === "_timeDisplay") return;

    const rowIndex = event.data.rowIndex as number;
    const key = `${field}-${timeSlots[rowIndex]}`;
    const isCurrentlySelected = selectedSlotsRef.current.has(key);

    isDraggingRef.current = true;
    dragModeRef.current = isCurrentlySelected ? "deselect" : "select";
    dragStartRef.current = { row: rowIndex, col: field };
    pendingCellsRef.current = new Set([key]);

    refreshGrid();
  }, [mode, timeSlots, refreshGrid, disabled]);

  // Mouse over handler
  const handleCellMouseOver = useCallback((event: CellMouseOverEvent) => {
    const field = event.colDef.field;
    if (!field || field === "time" || field === "_timeDisplay") return;

    // Heatmap hover
    if (mode === "heatmap" && onHoverSlot) {
      const rowIndex = event.data.rowIndex as number;
      const time = timeSlots[rowIndex];

      // For overnight windows, after-midnight times need to look up the next day
      let lookupDate = field;
      const isAfterMidnight = isOvernightWindow && time < displayTimeWindow.latest;
      if (isAfterMidnight) {
        const colIdx = dateStrings.indexOf(field);
        if (colIdx !== -1) {
          lookupDate = colIdx + 1 < dateStrings.length
            ? dateStrings[colIdx + 1]
            : formatInTimeZone(addDays(allDates[colIdx], 1), userTimezone, "yyyy-MM-dd");
        }
      }

      const key = `${lookupDate}-${time}`;
      const availableIds = heatmapData.get(key) || new Set();

      const available = participants.filter(p => availableIds.has(p.id));
      const unavailable = participants.filter(p => !availableIds.has(p.id));

      onHoverSlot(field, time, available, unavailable);
      return;
    }

    // Edit mode drag
    if (!isDraggingRef.current || mode !== "edit" || !dragStartRef.current || disabled) return;

    const rowIndex = event.data.rowIndex as number;
    const newPending = calculatePendingCells(
      dragStartRef.current.row,
      dragStartRef.current.col,
      rowIndex,
      field
    );

    // Only refresh if pending cells changed
    if (newPending.size !== pendingCellsRef.current.size ||
        ![...newPending].every(k => pendingCellsRef.current.has(k))) {
      pendingCellsRef.current = newPending;
      refreshGrid();
    }
  }, [mode, calculatePendingCells, heatmapData, participants, onHoverSlot, timeSlots, refreshGrid, isOvernightWindow, displayTimeWindow.latest, dateStrings, allDates, userTimezone, disabled]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current || mode !== "edit") {
      isDraggingRef.current = false;
      dragStartRef.current = null;
      if (pendingCellsRef.current.size > 0) {
        pendingCellsRef.current = new Set();
        refreshGrid();
      }
      return;
    }

    // Apply pending changes
    const next = new Set(selectedSlotsRef.current);
    for (const cell of pendingCellsRef.current) {
      if (dragModeRef.current === "select") {
        next.add(cell);
      } else {
        next.delete(cell);
      }
    }
    selectedSlotsRef.current = next;

    // Update lastAvailabilityRef to prevent sync from overwriting
    const newSlots = setToTimeSlots(next);
    lastAvailabilityRef.current = serializeAvailability(newSlots);

    // Mark that we have pending changes (prevents prop sync from causing flash)
    hasPendingChangesRef.current = true;

    // Clear drag state
    isDraggingRef.current = false;
    dragStartRef.current = null;
    pendingCellsRef.current = new Set();

    // Refresh grid
    refreshGrid();

    // Auto-save
    if (autoSave && onSave) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        // Convert from user's local timezone back to UTC before saving
        onSave(convertToUTC(newSlots));
        // Clear pending flag after save is initiated - allow prop sync after short delay
        // This gives time for the server response to arrive with matching data
        setTimeout(() => {
          hasPendingChangesRef.current = false;
        }, 500);
      }, 300);
    } else {
      // If not auto-saving, clear the pending flag immediately
      hasPendingChangesRef.current = false;
    }
  }, [mode, autoSave, onSave, refreshGrid, convertToUTC]);

  // Global mouse up listener
  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  // Mouse leave handler
  const handleMouseLeave = useCallback(() => {
    if (mode === "heatmap" && onLeaveSlot) {
      onLeaveSlot();
    }
  }, [mode, onLeaveSlot]);

  // Edit mode cell style - combines selection state with GM availability stripes
  const getEditCellStyle = useCallback((params: CellClassParams) => {
    const field = params.colDef.field;
    if (!field || field === "time" || field === "_timeDisplay") return undefined;
    const rowIndex = params.data?.rowIndex as number;
    const time = timeSlots[rowIndex];
    if (!time) return undefined;

    const key = `${field}-${time}`;
    const isSelected = selectedSlotsRef.current.has(key);
    const isPending = pendingCellsRef.current.has(key);
    const isPendingAdd = isPending && dragModeRef.current === "select";
    const isPendingRemove = isPending && dragModeRef.current === "deselect";
    const isGmAvailable = gmAvailableSlots.has(key);

    // Determine base background color
    let bgColor: string;
    if (isPendingAdd) {
      bgColor = isDarkMode ? "#22c55e" : "#86efac";
    } else if (isPendingRemove) {
      bgColor = isDarkMode ? "#ef4444" : "#fca5a5";
    } else if (isSelected && !isPending) {
      bgColor = isDarkMode ? "#16a34a" : "#4ade80";
    } else {
      bgColor = isDarkMode ? "#18181b" : "#ffffff";
    }

    const style: Record<string, string> = {
      backgroundColor: bgColor,
      cursor: disabled ? "default" : "pointer",
    };

    // Add diagonal purple stripes for GM available times
    // Stripes always show when GM is available - darker on selected cells for visibility
    if (isGmAvailable) {
      // Use pre-computed stripe colors to avoid string interpolation (purple-500: 168, 85, 247)
      const stripeColor = (isSelected || isPendingAdd)
        ? (isDarkMode ? "rgba(168,85,247,0.6)" : "rgba(168,85,247,0.5)")
        : (isDarkMode ? "rgba(168,85,247,0.35)" : "rgba(168,85,247,0.25)");
      style.backgroundImage = `repeating-linear-gradient(-45deg,transparent,transparent 3px,${stripeColor} 3px,${stripeColor} 6px)`;
      style.backgroundSize = "8px 8px";
    }

    return style;
  }, [timeSlots, isDarkMode, gmAvailableSlots, disabled]);

  // Heatmap cell style with GM availability indication (diagonal stripes)
  const getHeatmapCellStyle = useCallback((params: CellClassParams) => {
    const field = params.colDef.field;
    if (!field || field === "time" || field === "_timeDisplay") return undefined;
    const rowIndex = params.data?.rowIndex as number;
    const time = timeSlots[rowIndex];
    const count = params.value as number;
    const isGmAvailable = time && gmAvailableSlots.has(`${field}-${time}`);

    const baseBgColor = getHeatmapBgColor(count, participants.length, isDarkMode);

    // Base style
    const style: Record<string, string> = {
      backgroundColor: baseBgColor,
      cursor: disabled ? "default" : "pointer",
    };

    // Add diagonal purple stripes for GM available times
    if (isGmAvailable) {
      const stripeColor = isDarkMode ? "rgba(168, 85, 247, 0.4)" : "rgba(168, 85, 247, 0.3)";
      style.backgroundImage = `repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 3px,
        ${stripeColor} 3px,
        ${stripeColor} 6px
      )`;
      style.backgroundSize = "8px 8px";
    }

    return style;
  }, [participants.length, isDarkMode, timeSlots, gmAvailableSlots, disabled]);

  // Cell sizes - more compact by default
  const cellWidth = compact ? 28 : 36;
  const timeColWidth = compact ? 36 : 44;

  // Column definitions grouped by week
  const columnDefs = useMemo((): (ColDef | ColGroupDef)[] => {
    const cols: (ColDef | ColGroupDef)[] = [
      {
        field: "_timeDisplay",
        headerName: "",
        width: timeColWidth,
        pinned: "left",
        lockPosition: true,
        suppressMovable: true,
        cellClass: "time-cell",
        headerClass: "time-header",
      },
    ];

    // Group dates by week
    const weekGroups = groupDatesByWeek(allDates);

    for (const [weekLabel, dates] of weekGroups) {
      const children: ColDef[] = dates.map((date) => {
        // Format in user's timezone to match availability data
        const dateStr = formatInTimeZone(date, userTimezone, "yyyy-MM-dd");
        const dayName = formatInTimeZone(date, userTimezone, "EEE");
        const dayNum = formatInTimeZone(date, userTimezone, "d");

        const colDef: ColDef = {
          field: dateStr,
          headerName: compact ? dayNum : `${dayName} ${dayNum}`,
          width: cellWidth,
          suppressMovable: true,
          cellRenderer: () => null,
          headerClass: "date-header",
        };

        if (mode === "edit") {
          colDef.cellStyle = getEditCellStyle;
        } else {
          colDef.cellStyle = getHeatmapCellStyle;
        }

        return colDef;
      });

      cols.push({
        headerName: weekLabel,
        headerClass: "week-group-header",
        children,
      });
    }

    return cols;
  }, [allDates, mode, getEditCellStyle, getHeatmapCellStyle, userTimezone, compact, cellWidth, timeColWidth]);

  // Default column definition
  const defaultColDef = useMemo((): ColDef => ({
    sortable: false,
    filter: false,
    resizable: false,
    suppressMovable: true,
    suppressHeaderMenuButton: true,
  }), []);

  // Grid ready handler
  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    // Initialize with current availability (in display timezone)
    selectedSlotsRef.current = buildAvailabilitySet(displayAvailability);
    lastAvailabilityRef.current = serializeAvailability(displayAvailability);
  }, [displayAvailability]);

  // Row height - more compact by default
  const rowHeight = compact ? 16 : 20;
  const headerHeight = compact ? 20 : 26;

  // AG Grid theme
  const gridTheme = useMemo(() => {
    return themeQuartz.withParams({
      backgroundColor: isDarkMode ? "#18181b" : "#ffffff",
      foregroundColor: isDarkMode ? "#fafafa" : "#18181b",
      headerBackgroundColor: isDarkMode ? "#27272a" : "#fafafa",
      headerTextColor: isDarkMode ? "#a1a1aa" : "#71717a",
      borderColor: isDarkMode ? "#3f3f46" : "#e4e4e7",
      rowBorder: isDarkMode ? "#27272a" : "#f4f4f5",
      oddRowBackgroundColor: isDarkMode ? "#18181b" : "#ffffff",
      headerFontSize: compact ? 9 : 11,
      fontSize: compact ? 9 : 11,
      rowHeight,
      headerHeight,
    });
  }, [isDarkMode, compact, rowHeight, headerHeight]);

  // Calculate grid height - capped at 60vh for scrollability
  const gridHeight = useMemo(() => {
    const rowCount = timeSlots.length;
    const totalHeaderHeight = compact ? 48 : 64;
    const rowsHeight = rowCount * rowHeight;
    const naturalHeight = totalHeaderHeight + rowsHeight + 4;
    // Cap at 60vh - will be applied via CSS
    return naturalHeight;
  }, [timeSlots.length, compact, rowHeight]);

  // CSS for cell states - more compact styling
  const cellStyles = useMemo(() => `
    .virtualized-availability-grid .ag-header-group-cell {
      font-weight: 600 !important;
      font-size: ${compact ? "8px" : "9px"} !important;
      justify-content: center !important;
    }
    .virtualized-availability-grid .ag-header-cell {
      padding: 0 !important;
    }
    .virtualized-availability-grid .ag-header-cell-label {
      justify-content: center !important;
      font-size: ${compact ? "7px" : "8px"} !important;
    }
    .virtualized-availability-grid .ag-cell {
      padding: 0 !important;
      border-right: 1px solid ${isDarkMode ? "#27272a" : "#f4f4f5"} !important;
      border-bottom: 1px solid ${isDarkMode ? "#27272a" : "#f4f4f5"} !important;
    }
    .virtualized-availability-grid .time-cell {
      display: flex !important;
      align-items: flex-start !important;
      justify-content: flex-end !important;
      padding-right: ${compact ? "2px" : "4px"} !important;
      font-size: ${compact ? "7px" : "9px"} !important;
      font-weight: 500 !important;
      color: ${isDarkMode ? "#a1a1aa" : "#71717a"} !important;
      background-color: ${isDarkMode ? "#18181b" : "#fafafa"} !important;
      border-right: 1px solid ${isDarkMode ? "#3f3f46" : "#e4e4e7"} !important;
      line-height: ${rowHeight}px !important;
      position: relative !important;
    }
    .virtualized-availability-grid .time-cell .ag-cell-value {
      position: absolute !important;
      top: 0 !important;
      right: ${compact ? "2px" : "4px"} !important;
      transform: translateY(-50%) !important;
    }
    .virtualized-availability-grid .ag-pinned-left-cols-container .ag-cell {
      border-right: none !important;
    }
    .virtualized-availability-grid .ag-row:nth-child(even) .ag-cell:not(.time-cell) {
      border-bottom-color: ${isDarkMode ? "#3f3f46" : "#e4e4e7"} !important;
    }
    .virtualized-availability-grid .ag-body-horizontal-scroll {
      height: ${compact ? "4px" : "6px"} !important;
    }
    .virtualized-availability-grid .ag-root-wrapper {
      border-radius: 6px !important;
      border: 1px solid ${isDarkMode ? "#3f3f46" : "#e4e4e7"} !important;
    }
    .virtualized-availability-grid .week-group-header {
      background-color: ${isDarkMode ? "#27272a" : "#f4f4f5"} !important;
      border-bottom: 1px solid ${isDarkMode ? "#3f3f46" : "#e4e4e7"} !important;
    }
    .virtualized-availability-grid .date-header {
      font-size: ${compact ? "7px" : "8px"} !important;
    }
    .virtualized-availability-grid .time-header {
      background-color: ${isDarkMode ? "#18181b" : "#fafafa"} !important;
    }
    .virtualized-availability-grid .cell-selected {
      background-color: ${isDarkMode ? "#16a34a" : "#4ade80"} !important;
      cursor: ${disabled ? "default" : "pointer"} !important;
    }
    .virtualized-availability-grid .cell-blocked {
      background-color: ${isDarkMode ? "#7f1d1d" : "#fecaca"} !important;
      cursor: ${disabled ? "default" : "pointer"} !important;
    }
    .virtualized-availability-grid .cell-pending-add {
      background-color: ${isDarkMode ? "#22c55e" : "#86efac"} !important;
      cursor: ${disabled ? "default" : "pointer"} !important;
    }
    .virtualized-availability-grid .cell-pending-remove {
      background-color: ${isDarkMode ? "#ef4444" : "#fca5a5"} !important;
      cursor: ${disabled ? "default" : "pointer"} !important;
    }
    .virtualized-availability-grid .cell-unselected {
      background-color: ${isDarkMode ? "#18181b" : "#ffffff"} !important;
      cursor: ${disabled ? "default" : "pointer"} !important;
    }
    .virtualized-availability-grid .cell-unselected:hover {
      background-color: ${disabled ? (isDarkMode ? "#18181b" : "#ffffff") : (isDarkMode ? "#27272a" : "#f4f4f5")} !important;
    }
  `, [isDarkMode, compact, rowHeight, disabled]);

  return (
    <div className="virtualized-availability-grid">
      <style dangerouslySetInnerHTML={{ __html: cellStyles }} />

      <div
        style={{ height: gridHeight, maxHeight: "60vh", width: "100%", overflowY: "auto" }}
        onMouseLeave={handleMouseLeave}
      >
        <AgGridReact
          ref={gridRef}
          theme={gridTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          suppressCellFocus={true}
          suppressRowClickSelection={true}
          onCellMouseDown={handleCellMouseDown}
          onCellMouseOver={handleCellMouseOver}
          animateRows={false}
          suppressScrollOnNewData={true}
          getRowId={(params) => params.data.time}
          suppressDragLeaveHidesColumns={true}
          enableCellTextSelection={false}
        />
      </div>

      {mode === "edit" && !disabled && (
        <div className="mt-2 flex items-center justify-end">
          <div className="hidden items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 sm:flex">
            {gmAvailability.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded"
                  style={{
                    backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(59, 130, 246, 0.3) 2px, rgba(59, 130, 246, 0.3) 4px)",
                    backgroundSize: "6px 6px"
                  }}
                />
                <span>GM available</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded bg-green-400 dark:bg-green-600" />
              <span>Your availability</span>
            </div>
            {isSaving && (
              <span className="text-zinc-400">Saving...</span>
            )}
          </div>
          {!autoSave && onSave && (
            <button
              onClick={() => onSave(convertToUTC(setToTimeSlots(selectedSlotsRef.current)))}
              disabled={isSaving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      )}

      {mode === "heatmap" && gmAvailability.length > 0 && (
        <div className="mt-2 hidden justify-end sm:flex">
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded bg-green-400 dark:bg-green-600"
                style={{
                  backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(59, 130, 246, 0.3) 2px, rgba(59, 130, 246, 0.3) 4px)",
                  backgroundSize: "6px 6px"
                }}
              />
              <span>GM available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-green-400 dark:bg-green-600" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" />
              <span>No availability</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
