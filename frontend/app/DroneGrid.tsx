"use client";

/**
 * DroneGrid — Interactive disaster-zone map editor + animation canvas
 *
 * Paint mode (toolbar):
 *   Start / Goal — click a cell to place the marker
 *   Hazard types — left-click or drag to paint, right-click to erase
 *
 * Animation overlays (driven by parent):
 *   exploredCells — Set<"row,col"> cells visited during the search (sky blue)
 *   optimalPath   — Coord[] final path (lime green), higher priority than explored
 *
 * Cell priority in rendering:
 *   Start > Goal > Optimal path > Explored > Normal terrain
 *
 * Authors: Zain (core) | Salman (optimization, canvas migration TBD)
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CellType = 0 | 1 | 2 | 3; // free | smoke | debris | wall
export type Coord = [number, number];   // [row, col]
type PaintMode = "start" | "goal" | CellType;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CELL_COSTS: Record<CellType, number | typeof Infinity> = {
  0: 1,
  1: 5,
  2: 10,
  3: Infinity,
};

const CELL_BASE_CLASS: Record<CellType, string> = {
  0: "bg-white",
  1: "bg-yellow-100",
  2: "bg-orange-300",
  3: "bg-gray-900",
};

export const CELL_LABEL: Record<CellType, string> = {
  0: "Free (cost 1)",
  1: "Smoke (cost 5)",
  2: "Debris (cost 10)",
  3: "Wall / Fire (∞)",
};

const TOOLBAR_ITEMS: { mode: PaintMode; label: string; bg: string; text: string }[] = [
  { mode: "start", label: "Start",  bg: "bg-green-500",                          text: "text-white" },
  { mode: "goal",  label: "Goal",   bg: "bg-red-500",                            text: "text-white" },
  { mode: 0,       label: "Free",   bg: "bg-white border border-gray-300",       text: "text-gray-700" },
  { mode: 1,       label: "Smoke",  bg: "bg-yellow-100 border border-gray-300",  text: "text-gray-700" },
  { mode: 2,       label: "Debris", bg: "bg-orange-300",                         text: "text-gray-800" },
  { mode: 3,       label: "Wall",   bg: "bg-gray-900",                           text: "text-white" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmptyGrid(rows: number, cols: number): CellType[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(0) as CellType[]);
}

// Weighted random cell type based on obstacle density
// Returns 0 (free), 1 (smoke), 2 (debris), or 3 (wall)
type Density = "light" | "medium" | "dense";

const DENSITY_WEIGHTS: Record<Density, [number, number, number, number]> = {
  //              free  smoke  debris  wall
  light:         [0.75, 0.12,  0.08,  0.05],
  medium:        [0.55, 0.18,  0.15,  0.12],
  dense:         [0.35, 0.22,  0.20,  0.23],
};

function randomCellType(density: Density): CellType {
  const [wFree, wSmoke, wDebris] = DENSITY_WEIGHTS[density];
  const r = Math.random();
  if (r < wFree)              return 0;
  if (r < wFree + wSmoke)     return 1;
  if (r < wFree + wSmoke + wDebris) return 2;
  return 3;
}

function buildRandomGrid(
  rows: number,
  cols: number,
  density: Density,
  protectedCells: Set<string>
): CellType[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (__, c) => {
      // Never randomize start / goal cells
      if (protectedCells.has(`${r},${c}`)) return 0 as CellType;
      return randomCellType(density);
    })
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DroneGridProps {
  rows?: number;                   // default 50
  cols?: number;                   // default 50
  exploredCells?: Set<string>;     // "row,col" keys — search frontier overlay
  optimalPath?: Coord[];           // final path overlay
  disabled?: boolean;              // lock painting during animation
  onGridChange?: (grid: CellType[][]) => void;
  onStartChange?: (coord: Coord | null) => void;
  onGoalChange?: (coord: Coord | null) => void;
  onReset?: () => void;            // notify parent when grid is reset
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DroneGrid({
  rows = 50,
  cols = 50,
  exploredCells,
  optimalPath,
  disabled = false,
  onGridChange,
  onStartChange,
  onGoalChange,
  onReset,
}: DroneGridProps) {
  const [grid, setGrid]         = useState<CellType[][]>(() => buildEmptyGrid(rows, cols));
  const [start, setStart]       = useState<Coord | null>(null);
  const [goal, setGoal]         = useState<Coord | null>(null);
  const [paintMode, setPaintMode] = useState<PaintMode>(3);

  const isPainting = useRef(false);
  const [density, setDensity] = useState<Density>("medium");

  // Re-initialize grid when dimensions change
  useEffect(() => {
    const fresh = buildEmptyGrid(rows, cols);
    setGrid(fresh);
    setStart(null);
    setGoal(null);
    onGridChange?.(fresh);
    onStartChange?.(null);
    onGoalChange?.(null);
  }, [rows, cols]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-build a Set for optimal path lookups so cellClass is O(1)
  const optimalPathSet = useMemo<Set<string>>(() => {
    if (!optimalPath) return new Set();
    return new Set(optimalPath.map(([r, c]) => `${r},${c}`));
  }, [optimalPath]);

  // ------------------------------------------------------------------
  // Cell class resolution (priority: start > goal > path > explored > terrain)
  // ------------------------------------------------------------------

  const cellClass = useCallback(
    (row: number, col: number): string => {
      if (start && start[0] === row && start[1] === col) return "bg-green-500";
      if (goal  && goal[0]  === row && goal[1]  === col) return "bg-red-500";

      const key = `${row},${col}`;
      if (optimalPathSet.has(key))  return "bg-lime-400";
      if (exploredCells?.has(key))  return "bg-sky-200";

      return CELL_BASE_CLASS[grid[row][col]];
    },
    [start, goal, grid, exploredCells, optimalPathSet]
  );

  // ------------------------------------------------------------------
  // Painting
  // ------------------------------------------------------------------

  const applyPaint = useCallback(
    (row: number, col: number, isRightClick: boolean) => {
      if (disabled) return;

      if (isRightClick) {
        // Compute next outside the updater — never call parent setState inside a setState callback
        const next = grid.map((r: CellType[]) => [...r]) as CellType[][];
        next[row][col] = 0;
        setGrid(next);
        onGridChange?.(next);
        return;
      }

      if (paintMode === "start") {
        if (grid[row][col] === 3) return;
        const coord: Coord = [row, col];
        setStart(coord);
        onStartChange?.(coord);
        return;
      }

      if (paintMode === "goal") {
        if (grid[row][col] === 3) return;
        const coord: Coord = [row, col];
        setGoal(coord);
        onGoalChange?.(coord);
        return;
      }

      if (start && start[0] === row && start[1] === col) return;
      if (goal  && goal[0]  === row && goal[1]  === col) return;

      const next = grid.map((r: CellType[]) => [...r]) as CellType[][];
      next[row][col] = paintMode as CellType;
      setGrid(next);
      onGridChange?.(next);
    },
    [disabled, paintMode, grid, start, goal, onGridChange, onStartChange, onGoalChange]
  );

  const handleMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    e.preventDefault();
    isPainting.current = true;
    applyPaint(row, col, e.button === 2);
  };

  const handleMouseEnter = (row: number, col: number, e: React.MouseEvent) => {
    if (!isPainting.current || paintMode === "start" || paintMode === "goal") return;
    applyPaint(row, col, e.buttons === 2);
  };

  const handleMouseUp = () => { isPainting.current = false; };

  // ------------------------------------------------------------------
  // Reset
  // ------------------------------------------------------------------

  function handleReset() {
    const fresh = buildEmptyGrid(rows, cols);
    setGrid(fresh);
    setStart(null);
    setGoal(null);
    onGridChange?.(fresh);
    onStartChange?.(null);
    onGoalChange?.(null);
    onReset?.();
  }

  function handleRandomize() {
    const protected_ = new Set<string>();
    if (start) protected_.add(`${start[0]},${start[1]}`);
    if (goal)  protected_.add(`${goal[0]},${goal[1]}`);

    const next = buildRandomGrid(rows, cols, density, protected_);
    setGrid(next);
    onGridChange?.(next);
    onReset?.(); // clear any existing animation overlays in parent
  }

  // Cell pixel size — fixed canvas, cells scale to fill it
  // 550px canvas → 20×20 = 27px/cell, 30×30 = 18px/cell, 50×50 = 11px/cell
  const CANVAS_PX = 550;
  const cellPx = Math.floor(CANVAS_PX / Math.max(rows, cols));

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3 select-none">

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">
          Paint
        </span>

        {TOOLBAR_ITEMS.map(({ mode, label, bg, text }) => (
          <button
            key={String(mode)}
            onClick={() => setPaintMode(mode)}
            disabled={disabled}
            className={`
              px-2.5 py-1 rounded text-xs font-semibold border-2 transition-all
              ${bg} ${text}
              ${paintMode === mode
                ? "border-blue-500 ring-2 ring-blue-200 scale-105"
                : "border-transparent opacity-80 hover:opacity-100"}
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            {label}
          </button>
        ))}

        {/* Density selector + Randomize button */}
        <div className="ml-auto flex items-center gap-1.5">
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value as Density)}
            disabled={disabled}
            className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white
                       text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="light">Light obstacles</option>
            <option value="medium">Medium obstacles</option>
            <option value="dense">Dense obstacles</option>
          </select>

          <button
            onClick={handleRandomize}
            disabled={disabled}
            className="px-2.5 py-1 rounded text-xs font-semibold bg-violet-100
                       hover:bg-violet-200 border border-violet-300 text-violet-700
                       disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Randomize
          </button>

          <button
            onClick={handleReset}
            disabled={disabled}
            className="px-2.5 py-1 rounded text-xs font-semibold bg-gray-100
                       hover:bg-gray-200 border border-gray-300 text-gray-600
                       disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {(Object.entries(CELL_LABEL) as [string, string][]).map(([t, label]) => (
          <span key={t} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm border border-gray-300 ${CELL_BASE_CLASS[Number(t) as CellType]}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-sky-200 border border-sky-400" />
          Explored
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-lime-400 border border-lime-600" />
          Path
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" /> Start
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Goal
        </span>
      </div>

      {/* ── Grid canvas ─────────────────────────────────────────── */}
      <div
        className={`
          inline-block border border-gray-300 rounded shadow-inner
          ${disabled ? "cursor-not-allowed" : "cursor-crosshair"}
        `}
        style={{ lineHeight: 0, width: CANVAS_PX, height: CANVAS_PX }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {grid.map((rowArr, row) => (
          <div key={row} className="flex">
            {rowArr.map((_, col) => (
              <div
                key={col}
                style={{ width: cellPx, height: cellPx }}
                className={`
                  border-[0.5px] border-gray-100 transition-colors duration-75
                  ${cellClass(row, col)}
                `}
                onMouseDown={(e) => handleMouseDown(row, col, e)}
                onMouseEnter={(e) => handleMouseEnter(row, col, e)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Status bar ──────────────────────────────────────────── */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span>
          Start:{" "}
          <span className="font-mono text-green-700 font-medium">
            {start ? `[${start[0]}, ${start[1]}]` : "—"}
          </span>
        </span>
        <span>
          Goal:{" "}
          <span className="font-mono text-red-700 font-medium">
            {goal ? `[${goal[0]}, ${goal[1]}]` : "—"}
          </span>
        </span>
        <span className="ml-auto font-medium text-gray-500">
          {disabled ? "🔒 Painting locked during animation" : (
            <>Mode: <span className="capitalize">{
              paintMode === "start" ? "Place Start"
              : paintMode === "goal" ? "Place Goal"
              : CELL_LABEL[paintMode as CellType]
            }</span></>
          )}
        </span>
      </div>
    </div>
  );
}
