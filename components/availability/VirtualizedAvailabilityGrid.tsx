"use client";

import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
} from "ag-grid-community";
import { format, eachDayOfInterval, startOfWeek } from "date-fns";
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
  earliestTime?: string;
  latestTime?: string;
  mode: "edit" | "heatmap";
  availability?: TimeSlot[];
  onSave?: (slots: TimeSlot[]) => void;
  isSaving?: boolean;
  autoSave?: boolean;
  participants?: Participant[];
  onHoverSlot?: (date: string, time: string, available: Participant[], unavailable: Participant[]) => void;
  onLeaveSlot?: () => void;
  timezone?: string;
  eventTimezone?: string;
}

// Build availability lookup from TimeSlot array
function buildAvailabilitySet(availability: TimeSlot[]): Set<string> {
  const set = new Set<string>();
  for (const slot of availability) {
    let currentTime = slot.startTime;
    while (currentTime < slot.endTime) {
      set.add(`${slot.date}-${currentTime}`);
      currentTime = addThirtyMinutes(currentTime);
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

// Group dates by week
function groupDatesByWeek(dates: Date[]): Map<string, Date[]> {
  const groups = new Map<string, Date[]>();

  for (const date of dates) {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekKey = format(weekStart, "MMM d");

    if (!groups.has(weekKey)) {
      groups.set(weekKey, []);
    }
    groups.get(weekKey)!.push(date);
  }

  return groups;
}

export function VirtualizedAvailabilityGrid({
  startDate,
  endDate,
  earliestTime = "00:00",
  latestTime = "23:30",
  mode,
  availability = [],
  onSave,
  isSaving = false,
  autoSave = false,
  participants = [],
  onHoverSlot,
  onLeaveSlot,
}: VirtualizedAvailabilityGridProps) {
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
    const serialized = serializeAvailability(availability);

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
    selectedSlotsRef.current = buildAvailabilitySet(availability);
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
  }, [availability]);

  // Cleanup animation frame on unmount
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

  // Generate all dates in range
  const allDates = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  // Pre-compute date strings for performance
  const dateStrings = useMemo(() => {
    return allDates.map(d => format(d, "yyyy-MM-dd"));
  }, [allDates]);

  // Generate time slots
  const timeSlots = useMemo(
    () => generateTimeSlots(earliestTime, latestTime),
    [earliestTime, latestTime]
  );

  // Build heatmap data
  const heatmapData = useMemo(() => {
    if (mode !== "heatmap") return new Map<string, Set<string>>();

    const map = new Map<string, Set<string>>();
    for (const p of participants) {
      for (const slot of p.availability) {
        let currentTime = slot.startTime;
        while (currentTime < slot.endTime) {
          const key = `${slot.date}-${currentTime}`;
          if (!map.has(key)) map.set(key, new Set());
          map.get(key)!.add(p.id);
          currentTime = addThirtyMinutes(currentTime);
        }
      }
    }
    return map;
  }, [mode, participants]);

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
        for (const dateStr of dateStrings) {
          const key = `${dateStr}-${time}`;
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
  }, [timeSlots, dateStrings, mode, heatmapData]);

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

  // Refresh only affected cells
  const refreshGrid = useCallback(() => {
    if (gridApiRef.current) {
      gridApiRef.current.refreshCells({ force: true });
    }
  }, []);

  // Mouse down handler
  const handleCellMouseDown = useCallback((event: CellMouseDownEvent) => {
    if (mode !== "edit") return;
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
  }, [mode, timeSlots, refreshGrid]);

  // Mouse over handler
  const handleCellMouseOver = useCallback((event: CellMouseOverEvent) => {
    const field = event.colDef.field;
    if (!field || field === "time" || field === "_timeDisplay") return;

    // Heatmap hover
    if (mode === "heatmap" && onHoverSlot) {
      const rowIndex = event.data.rowIndex as number;
      const time = timeSlots[rowIndex];
      const key = `${field}-${time}`;
      const availableIds = heatmapData.get(key) || new Set();

      const available = participants.filter(p => availableIds.has(p.id));
      const unavailable = participants.filter(p => !availableIds.has(p.id));

      onHoverSlot(field, time, available, unavailable);
      return;
    }

    // Edit mode drag
    if (!isDraggingRef.current || mode !== "edit" || !dragStartRef.current) return;

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
  }, [mode, calculatePendingCells, heatmapData, participants, onHoverSlot, timeSlots, refreshGrid]);

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
        onSave(newSlots);
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
  }, [mode, autoSave, onSave, refreshGrid]);

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

  // Cell class rules for efficient styling
  const cellClassRules = useMemo(() => {
    if (mode !== "edit") return undefined;

    return {
      "cell-selected": (params: CellClassParams) => {
        const field = params.colDef.field;
        if (!field || field === "time" || field === "_timeDisplay") return false;
        const rowIndex = params.data?.rowIndex as number;
        const time = timeSlots[rowIndex];
        if (!time) return false;
        const key = `${field}-${time}`;
        return selectedSlotsRef.current.has(key) && !pendingCellsRef.current.has(key);
      },
      "cell-pending-add": (params: CellClassParams) => {
        const field = params.colDef.field;
        if (!field || field === "time" || field === "_timeDisplay") return false;
        const rowIndex = params.data?.rowIndex as number;
        const time = timeSlots[rowIndex];
        if (!time) return false;
        const key = `${field}-${time}`;
        return pendingCellsRef.current.has(key) && dragModeRef.current === "select";
      },
      "cell-pending-remove": (params: CellClassParams) => {
        const field = params.colDef.field;
        if (!field || field === "time" || field === "_timeDisplay") return false;
        const rowIndex = params.data?.rowIndex as number;
        const time = timeSlots[rowIndex];
        if (!time) return false;
        const key = `${field}-${time}`;
        return pendingCellsRef.current.has(key) && dragModeRef.current === "deselect";
      },
      "cell-unselected": (params: CellClassParams) => {
        const field = params.colDef.field;
        if (!field || field === "time" || field === "_timeDisplay") return false;
        const rowIndex = params.data?.rowIndex as number;
        const time = timeSlots[rowIndex];
        if (!time) return false;
        const key = `${field}-${time}`;
        return !selectedSlotsRef.current.has(key) && !pendingCellsRef.current.has(key);
      },
    };
  }, [mode, timeSlots]);

  // Heatmap cell style
  const getHeatmapCellStyle = useCallback((params: CellClassParams) => {
    const field = params.colDef.field;
    if (!field || field === "time" || field === "_timeDisplay") return undefined;
    const count = params.value as number;
    return {
      backgroundColor: getHeatmapBgColor(count, participants.length, isDarkMode),
      cursor: "pointer",
    };
  }, [participants.length, isDarkMode]);

  // Column definitions grouped by week
  const columnDefs = useMemo((): (ColDef | ColGroupDef)[] => {
    const cols: (ColDef | ColGroupDef)[] = [
      {
        field: "_timeDisplay",
        headerName: "",
        width: 50,
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
        const dateStr = format(date, "yyyy-MM-dd");
        const dayName = format(date, "EEE");
        const dayNum = format(date, "d");

        const colDef: ColDef = {
          field: dateStr,
          headerName: `${dayName} ${dayNum}`,
          width: 48,
          suppressMovable: true,
          cellRenderer: () => null,
          headerClass: "date-header",
        };

        if (mode === "edit") {
          colDef.cellClassRules = cellClassRules;
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
  }, [allDates, mode, cellClassRules, getHeatmapCellStyle]);

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
    // Initialize with current availability
    selectedSlotsRef.current = buildAvailabilitySet(availability);
    lastAvailabilityRef.current = serializeAvailability(availability);
  }, [availability]);

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
      headerFontSize: 11,
      fontSize: 11,
      rowHeight: 24,
      headerHeight: 32,
    });
  }, [isDarkMode]);

  // Calculate grid height
  const gridHeight = useMemo(() => {
    const rowCount = timeSlots.length;
    const headerHeight = 64;
    const rowsHeight = rowCount * 24;
    return Math.min(headerHeight + rowsHeight + 20, 600);
  }, [timeSlots.length]);

  // CSS for cell states
  const cellStyles = useMemo(() => `
    .virtualized-availability-grid .ag-header-group-cell {
      font-weight: 600 !important;
      font-size: 11px !important;
      justify-content: center !important;
    }
    .virtualized-availability-grid .ag-header-cell {
      padding: 0 2px !important;
    }
    .virtualized-availability-grid .ag-header-cell-label {
      justify-content: center !important;
      font-size: 10px !important;
    }
    .virtualized-availability-grid .ag-cell {
      padding: 1px !important;
      border-right: 1px solid ${isDarkMode ? "#27272a" : "#f4f4f5"} !important;
      border-bottom: 1px solid ${isDarkMode ? "#27272a" : "#f4f4f5"} !important;
    }
    .virtualized-availability-grid .time-cell {
      display: flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      padding-right: 8px !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      color: ${isDarkMode ? "#a1a1aa" : "#71717a"} !important;
      background-color: ${isDarkMode ? "#18181b" : "#fafafa"} !important;
      border-right: 2px solid ${isDarkMode ? "#3f3f46" : "#e4e4e7"} !important;
    }
    .virtualized-availability-grid .ag-pinned-left-cols-container .ag-cell {
      border-right: none !important;
    }
    .virtualized-availability-grid .ag-row:nth-child(even) .ag-cell:not(.time-cell) {
      border-bottom-color: ${isDarkMode ? "#3f3f46" : "#e4e4e7"} !important;
    }
    .virtualized-availability-grid .ag-body-horizontal-scroll {
      height: 10px !important;
    }
    .virtualized-availability-grid .ag-root-wrapper {
      border-radius: 8px !important;
      border: 1px solid ${isDarkMode ? "#3f3f46" : "#e4e4e7"} !important;
    }
    .virtualized-availability-grid .week-group-header {
      background-color: ${isDarkMode ? "#27272a" : "#f4f4f5"} !important;
      border-bottom: 1px solid ${isDarkMode ? "#3f3f46" : "#e4e4e7"} !important;
    }
    .virtualized-availability-grid .date-header {
      font-size: 10px !important;
    }
    .virtualized-availability-grid .time-header {
      background-color: ${isDarkMode ? "#18181b" : "#fafafa"} !important;
    }
    .virtualized-availability-grid .cell-selected {
      background-color: ${isDarkMode ? "#16a34a" : "#4ade80"} !important;
      cursor: pointer !important;
    }
    .virtualized-availability-grid .cell-pending-add {
      background-color: ${isDarkMode ? "#22c55e" : "#86efac"} !important;
      cursor: pointer !important;
    }
    .virtualized-availability-grid .cell-pending-remove {
      background-color: ${isDarkMode ? "#ef4444" : "#fca5a5"} !important;
      cursor: pointer !important;
    }
    .virtualized-availability-grid .cell-unselected {
      background-color: ${isDarkMode ? "#18181b" : "#ffffff"} !important;
      cursor: pointer !important;
    }
    .virtualized-availability-grid .cell-unselected:hover {
      background-color: ${isDarkMode ? "#27272a" : "#f4f4f5"} !important;
    }
  `, [isDarkMode]);

  return (
    <div className="virtualized-availability-grid">
      <style dangerouslySetInnerHTML={{ __html: cellStyles }} />

      <div
        style={{ height: gridHeight, width: "100%" }}
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

      {mode === "edit" && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-green-400 dark:bg-green-600" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900" />
              <span>Not available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-red-300 dark:bg-red-500" />
              <span>Removing</span>
            </div>
          </div>
          {isSaving && (
            <span className="text-xs text-zinc-500">Saving...</span>
          )}
          {!autoSave && onSave && (
            <button
              onClick={() => onSave(setToTimeSlots(selectedSlotsRef.current))}
              disabled={isSaving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
