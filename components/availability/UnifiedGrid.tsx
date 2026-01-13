"use client";

import { useMemo, useCallback, useRef } from "react";
import { format, parseISO } from "date-fns";
import { useDragSelection } from "@/lib/hooks/useDragSelection";
import {
  computeEffectiveRanges,
  rangesToSlots,
  getDateRange,
  timeToMinutes,
  minutesToTime,
  convertRuleForDisplay,
  type AvailabilityRule,
  type DateRange,
  SLOT_DURATION_MINUTES,
} from "@/lib/availability";

interface UnifiedGridProps {
  /** Rules for this participant (in UTC) */
  rules: AvailabilityRule[];
  /** Date range to display */
  dateRange: DateRange;
  /** Time window to display (HH:MM format) */
  earliestTime: string;
  latestTime: string;
  /** Display timezone */
  displayTimezone: string;
  /** Whether the grid is editable */
  editable?: boolean;
  /** Callback when selection is made */
  onSelectionComplete?: (
    cells: { date: string; time: string }[],
    mode: "add" | "remove"
  ) => void;
  /** Optional CSS class */
  className?: string;
}

interface GridCell {
  date: string;
  time: string;
  isAvailable: boolean;
}

export function UnifiedGrid({
  rules,
  dateRange,
  earliestTime,
  latestTime,
  displayTimezone,
  editable = false,
  onSelectionComplete,
  className = "",
}: UnifiedGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate dates and time slots for the grid
  const dates = useMemo(() => {
    return getDateRange(dateRange.startDate, dateRange.endDate);
  }, [dateRange]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    const startMins = timeToMinutes(earliestTime);
    let endMins = timeToMinutes(latestTime);

    // Handle overnight time window
    if (endMins <= startMins && latestTime !== earliestTime) {
      endMins += 24 * 60;
    }

    for (let mins = startMins; mins < endMins; mins += SLOT_DURATION_MINUTES) {
      slots.push(minutesToTime(mins));
    }

    return slots;
  }, [earliestTime, latestTime]);

  // Compute effective availability from rules
  const effectiveAvailability = useMemo(() => {
    return computeEffectiveRanges(rules, dateRange);
  }, [rules, dateRange]);

  // Build a Set of available slots for O(1) lookup
  const availableSlotSet = useMemo(() => {
    const set = new Set<string>();

    for (const [date, dayAvail] of effectiveAvailability) {
      const slots = rangesToSlots(dayAvail.availableRanges, date);
      for (const slot of slots) {
        set.add(`${slot.date}|${slot.time}`);
      }
    }

    return set;
  }, [effectiveAvailability]);

  // Check if a cell is available
  const isCellAvailable = useCallback(
    (date: string, time: string) => {
      return availableSlotSet.has(`${date}|${time}`);
    },
    [availableSlotSet]
  );

  // Convert row/col to date/time
  const cellToDateTime = useCallback(
    (row: number, col: number) => {
      return {
        date: dates[col] || "",
        time: timeSlots[row] || "",
      };
    },
    [dates, timeSlots]
  );

  // Handle selection complete
  const handleSelectionComplete = useCallback(
    (cells: { row: number; col: number }[], mode: "add" | "remove") => {
      if (!onSelectionComplete) return;

      const selectedCells = cells.map(({ row, col }) => cellToDateTime(row, col));
      onSelectionComplete(selectedCells, mode);
    },
    [onSelectionComplete, cellToDateTime]
  );

  // Drag selection hook
  const {
    isDragging,
    selectionMode,
    handleCellPointerDown,
    handlePointerMove,
    isCellInSelection,
  } = useDragSelection({
    rows: timeSlots.length,
    cols: dates.length,
    onSelectionComplete: handleSelectionComplete,
    isCellSelected: (row, col) => {
      const { date, time } = cellToDateTime(row, col);
      return isCellAvailable(date, time);
    },
  });

  // Get cell state
  const getCellState = useCallback(
    (rowIndex: number, colIndex: number) => {
      const { date, time } = cellToDateTime(rowIndex, colIndex);
      const isAvailable = isCellAvailable(date, time);
      const inSelection = isCellInSelection(rowIndex, colIndex);

      let state: "available" | "unavailable" | "pending-add" | "pending-remove" =
        isAvailable ? "available" : "unavailable";

      if (inSelection) {
        state = selectionMode === "add" ? "pending-add" : "pending-remove";
      }

      return state;
    },
    [cellToDateTime, isCellAvailable, isCellInSelection, selectionMode]
  );

  // Get cell CSS classes
  const getCellClasses = useCallback(
    (state: "available" | "unavailable" | "pending-add" | "pending-remove") => {
      const base = "h-6 border-r border-b border-gray-200 transition-colors";

      switch (state) {
        case "available":
          return `${base} bg-green-400 hover:bg-green-500`;
        case "unavailable":
          return `${base} bg-gray-100 hover:bg-gray-200`;
        case "pending-add":
          return `${base} bg-green-300 ring-2 ring-green-500 ring-inset`;
        case "pending-remove":
          return `${base} bg-red-200 ring-2 ring-red-500 ring-inset`;
        default:
          return base;
      }
    },
    []
  );

  // Format day header
  const formatDayHeader = useCallback((dateStr: string) => {
    const date = parseISO(dateStr);
    return {
      dayName: format(date, "EEE"),
      dayNum: format(date, "d"),
      month: format(date, "MMM"),
    };
  }, []);

  // Format time label
  const formatTimeLabel = useCallback((time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "pm" : "am";
    const hour12 = hours % 12 || 12;
    if (minutes === 0) {
      return `${hour12}${period}`;
    }
    return `${hour12}:${minutes.toString().padStart(2, "0")}`;
  }, []);

  // Handle pointer move on grid
  const handleGridPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 48; // Subtract time label width
      const y = e.clientY - rect.top - 48; // Subtract header height

      if (x < 0 || y < 0) return;

      const cellWidth = (rect.width - 48) / dates.length;
      const cellHeight = 24; // h-6 = 24px

      const col = Math.floor(x / cellWidth);
      const row = Math.floor(y / cellHeight);

      if (row >= 0 && row < timeSlots.length && col >= 0 && col < dates.length) {
        handlePointerMove(row, col);
      }
    },
    [isDragging, dates.length, timeSlots.length, handlePointerMove]
  );

  return (
    <div
      ref={gridRef}
      className={`select-none ${className}`}
      onPointerMove={handleGridPointerMove}
    >
      {/* Header row with dates */}
      <div className="flex border-b border-gray-300">
        {/* Empty corner cell */}
        <div className="w-12 flex-shrink-0" />

        {/* Date headers */}
        {dates.map((dateStr) => {
          const { dayName, dayNum, month } = formatDayHeader(dateStr);
          return (
            <div
              key={dateStr}
              className="flex-1 text-center py-2 border-r border-gray-200 min-w-[60px]"
            >
              <div className="text-xs text-gray-500">{dayName}</div>
              <div className="font-semibold">{dayNum}</div>
              <div className="text-xs text-gray-400">{month}</div>
            </div>
          );
        })}
      </div>

      {/* Grid rows */}
      <div className="overflow-y-auto max-h-[60vh]">
        {timeSlots.map((time, rowIndex) => (
          <div key={time} className="flex">
            {/* Time label */}
            <div className="w-12 flex-shrink-0 text-xs text-gray-500 text-right pr-2 py-1">
              {formatTimeLabel(time)}
            </div>

            {/* Cells */}
            {dates.map((date, colIndex) => {
              const state = getCellState(rowIndex, colIndex);
              return (
                <div
                  key={`${date}-${time}`}
                  className={`flex-1 min-w-[60px] ${getCellClasses(state)} ${
                    editable ? "cursor-pointer" : ""
                  }`}
                  onPointerDown={
                    editable
                      ? (e) => {
                          e.preventDefault();
                          handleCellPointerDown(rowIndex, colIndex);
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 rounded" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded" />
          <span>Unavailable</span>
        </div>
        {editable && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-300 ring-2 ring-green-500 ring-inset rounded" />
              <span>Adding</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 ring-2 ring-red-500 ring-inset rounded" />
              <span>Removing</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
