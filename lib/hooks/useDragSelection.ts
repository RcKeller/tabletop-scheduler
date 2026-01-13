"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface CellPosition {
  row: number;
  col: number;
}

interface SelectionBox {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface UseDragSelectionOptions {
  /** Number of rows in the grid */
  rows: number;
  /** Number of columns in the grid */
  cols: number;
  /** Callback when selection is completed */
  onSelectionComplete?: (
    cells: { row: number; col: number }[],
    mode: "add" | "remove"
  ) => void;
  /** Function to check if a cell is currently selected */
  isCellSelected?: (row: number, col: number) => boolean;
}

interface UseDragSelectionReturn {
  /** Whether a drag is currently in progress */
  isDragging: boolean;
  /** The current selection mode (add or remove based on first cell) */
  selectionMode: "add" | "remove" | null;
  /** Current selection box coordinates */
  selectionBox: SelectionBox | null;
  /** Handler for mouse/touch down on a cell */
  handleCellPointerDown: (row: number, col: number) => void;
  /** Handler for mouse/touch move */
  handlePointerMove: (row: number, col: number) => void;
  /** Handler for mouse/touch up */
  handlePointerUp: () => void;
  /** Check if a cell is in the current selection */
  isCellInSelection: (row: number, col: number) => boolean;
  /** Get all cells in the current selection */
  getSelectedCells: () => { row: number; col: number }[];
  /** Cancel the current selection */
  cancelSelection: () => void;
}

export function useDragSelection({
  rows,
  cols,
  onSelectionComplete,
  isCellSelected,
}: UseDragSelectionOptions): UseDragSelectionReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"add" | "remove" | null>(
    null
  );
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const startCellRef = useRef<CellPosition | null>(null);
  const currentCellRef = useRef<CellPosition | null>(null);

  const handleCellPointerDown = useCallback(
    (row: number, col: number) => {
      // Determine selection mode based on whether first cell is selected
      const isSelected = isCellSelected?.(row, col) ?? false;
      const mode = isSelected ? "remove" : "add";

      setIsDragging(true);
      setSelectionMode(mode);
      startCellRef.current = { row, col };
      currentCellRef.current = { row, col };

      setSelectionBox({
        startRow: row,
        startCol: col,
        endRow: row,
        endCol: col,
      });
    },
    [isCellSelected]
  );

  const handlePointerMove = useCallback(
    (row: number, col: number) => {
      if (!isDragging || !startCellRef.current) return;

      // Clamp to grid bounds
      const clampedRow = Math.max(0, Math.min(rows - 1, row));
      const clampedCol = Math.max(0, Math.min(cols - 1, col));

      currentCellRef.current = { row: clampedRow, col: clampedCol };

      setSelectionBox({
        startRow: Math.min(startCellRef.current.row, clampedRow),
        startCol: Math.min(startCellRef.current.col, clampedCol),
        endRow: Math.max(startCellRef.current.row, clampedRow),
        endCol: Math.max(startCellRef.current.col, clampedCol),
      });
    },
    [isDragging, rows, cols]
  );

  const getSelectedCells = useCallback(() => {
    if (!selectionBox) return [];

    const cells: { row: number; col: number }[] = [];
    for (let row = selectionBox.startRow; row <= selectionBox.endRow; row++) {
      for (let col = selectionBox.startCol; col <= selectionBox.endCol; col++) {
        cells.push({ row, col });
      }
    }
    return cells;
  }, [selectionBox]);

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;

    const cells = getSelectedCells();
    if (cells.length > 0 && selectionMode && onSelectionComplete) {
      onSelectionComplete(cells, selectionMode);
    }

    setIsDragging(false);
    setSelectionMode(null);
    setSelectionBox(null);
    startCellRef.current = null;
    currentCellRef.current = null;
  }, [isDragging, selectionMode, getSelectedCells, onSelectionComplete]);

  const cancelSelection = useCallback(() => {
    setIsDragging(false);
    setSelectionMode(null);
    setSelectionBox(null);
    startCellRef.current = null;
    currentCellRef.current = null;
  }, []);

  const isCellInSelection = useCallback(
    (row: number, col: number) => {
      if (!selectionBox) return false;
      return (
        row >= selectionBox.startRow &&
        row <= selectionBox.endRow &&
        col >= selectionBox.startCol &&
        col <= selectionBox.endCol
      );
    },
    [selectionBox]
  );

  // Handle global mouse up to catch releases outside the grid
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDragging) {
        handlePointerUp();
      }
    };

    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", cancelSelection);

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", cancelSelection);
    };
  }, [isDragging, handlePointerUp, cancelSelection]);

  // Prevent text selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = "none";
      return () => {
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging]);

  return {
    isDragging,
    selectionMode,
    selectionBox,
    handleCellPointerDown,
    handlePointerMove,
    handlePointerUp,
    isCellInSelection,
    getSelectedCells,
    cancelSelection,
  };
}
