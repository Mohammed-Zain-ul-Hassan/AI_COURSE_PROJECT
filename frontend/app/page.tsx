"use client";

/**
 * Main dashboard — Disaster Response Drone Pathfinding Engine
 * AI2002 Academic Project
 *
 * Implemented (Zain):
 *   ✅ Grid editor with dynamic size selector
 *   ✅ Algorithm + animation speed dropdowns
 *   ✅ Fetch → /calculate-path
 *   ✅ Animation engine (explore phase → path draw phase)
 *   ✅ Play / Stop / Replay controls
 *   ✅ Live progress bar + metrics panel
 *
 * Left for Salman to extend:
 *   🔲 UCS algorithm implementation (backend stub already exists)
 *   🔲 Side-by-side A* vs UCS comparison view
 *   🔲 Canvas-based rendering for >50×50 grids (performance)
 *   🔲 Heatmap overlay showing per-cell g-score
 */

import { useState, useRef, useCallback } from "react";
import DroneGrid, { CellType, Coord } from "./DroneGrid";

// ---------------------------------------------------------------------------
// Config options (dropdowns — no magic numbers in JSX)
// ---------------------------------------------------------------------------

const GRID_SIZE_OPTIONS = [
  { label: "Small  (20 × 20)", rows: 20, cols: 20 },
  { label: "Medium (30 × 30)", rows: 30, cols: 30 },
  { label: "Large  (50 × 50)", rows: 50, cols: 50 },
] as const;

const SPEED_OPTIONS = [
  { label: "Slow   (60 ms / cell)", exploreMs: 60,  pathMs: 30  },
  { label: "Normal (15 ms / cell)", exploreMs: 15,  pathMs: 8   },
  { label: "Fast   ( 3 ms / cell)", exploreMs: 3,   pathMs: 2   },
  { label: "Instant (no animation)", exploreMs: 0,  pathMs: 0   },
] as const;

const ALGORITHM_OPTIONS = [
  { value: "astar", label: "A*  (A-Star)"         },
  { value: "ucs",   label: "UCS (Uniform Cost)"   },
] as const;

type Algorithm = "astar" | "ucs";
type AnimPhase = "idle" | "exploring" | "drawing" | "done";

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface Metrics {
  total_cost: number;
  nodes_expanded: number;
}

interface PathResult {
  explored_sequence: [number, number][];
  optimal_path:      [number, number][];
  metrics:           Metrics;
}

const API_BASE = "http://localhost:8000";

// ---------------------------------------------------------------------------
// Small reusable label+select wrapper
// ---------------------------------------------------------------------------

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  options: readonly { label: string; value?: string | number }[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white
                   text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400
                   disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {options.map((opt, i) => (
          <option key={i} value={opt.value !== undefined ? String(opt.value) : String(i)}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-lg font-bold text-gray-800 font-mono leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  // ── Grid config ──────────────────────────────────────────────────────
  const [gridSizeIdx, setGridSizeIdx] = useState(2); // default Large 50×50
  const { rows, cols } = GRID_SIZE_OPTIONS[gridSizeIdx];

  const [grid, setGrid]   = useState<CellType[][]>([]);
  const [start, setStart] = useState<Coord | null>(null);
  const [goal, setGoal]   = useState<Coord | null>(null);

  // ── Algorithm + speed ────────────────────────────────────────────────
  const [algorithm, setAlgorithm] = useState<Algorithm>("astar");
  const [speedIdx, setSpeedIdx]   = useState(1); // default Normal
  const speed = SPEED_OPTIONS[speedIdx];

  // ── API ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<PathResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // ── Animation state ──────────────────────────────────────────────────
  const [animPhase, setAnimPhase]         = useState<AnimPhase>("idle");
  const [exploredCells, setExploredCells] = useState<Set<string>>(new Set());
  const [displayedPath, setDisplayedPath] = useState<Coord[]>([]);
  const [animProgress, setAnimProgress]   = useState(0); // cells painted so far

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────

  function stopAnimation() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function clearOverlays() {
    setExploredCells(new Set());
    setDisplayedPath([]);
    setAnimProgress(0);
    setAnimPhase("idle");
  }

  // ── Animation engine ─────────────────────────────────────────────────

  const runAnimation = useCallback(
    (data: PathResult) => {
      stopAnimation();
      clearOverlays();

      const { explored_sequence, optimal_path } = data;

      // ── Instant mode — paint everything at once ──────────────────
      if (speed.exploreMs === 0) {
        const allExplored = new Set(
          explored_sequence.map(([r, c]) => `${r},${c}`)
        );
        setExploredCells(allExplored);
        setDisplayedPath(optimal_path as Coord[]);
        setAnimProgress(explored_sequence.length);
        setAnimPhase("done");
        return;
      }

      // ── Step-by-step: explore phase ──────────────────────────────
      setAnimPhase("exploring");
      let exploreIdx = 0;

      // Use a ref-captured set so we never trigger re-renders
      // of the whole page on each step — only DroneGrid re-renders
      // via the exploredCells prop.
      const liveSet = new Set<string>();

      function exploreStep() {
        if (exploreIdx >= explored_sequence.length) {
          // Hand off to path drawing phase
          setAnimPhase("drawing");
          drawStep(0);
          return;
        }
        const [r, c] = explored_sequence[exploreIdx];
        liveSet.add(`${r},${c}`);
        // Snapshot the set so React sees a new reference
        setExploredCells(new Set(liveSet));
        setAnimProgress(exploreIdx + 1);
        exploreIdx++;
        timerRef.current = setTimeout(exploreStep, speed.exploreMs);
      }

      // ── Step-by-step: path drawing phase ────────────────────────
      function drawStep(pathIdx: number) {
        if (pathIdx >= optimal_path.length) {
          setAnimPhase("done");
          return;
        }
        setDisplayedPath((prev) => [...prev, optimal_path[pathIdx] as Coord]);
        timerRef.current = setTimeout(() => drawStep(pathIdx + 1), speed.pathMs);
      }

      exploreStep();
    },
    [speed] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Calculate path ───────────────────────────────────────────────────

  async function handleCalculate() {
    if (!start || !goal) {
      setError("Place both a Start and a Goal on the grid first.");
      return;
    }

    stopAnimation();
    clearOverlays();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/calculate-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid, start, goal, algorithm }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }

      const data: PathResult = await res.json();
      setResult(data);
      runAnimation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleStop() {
    stopAnimation();
    setAnimPhase("idle");
  }

  function handleReplay() {
    if (result) runAnimation(result);
  }

  function handleGridReset() {
    stopAnimation();
    clearOverlays();
    setResult(null);
    setError(null);
  }

  // ── Derived UI state ─────────────────────────────────────────────────

  const isAnimating  = animPhase === "exploring" || animPhase === "drawing";
  const isIdle       = animPhase === "idle";
  const isDone       = animPhase === "done";

  const totalExplored = result?.explored_sequence.length ?? 0;
  const progressPct   = totalExplored > 0 ? Math.round((animProgress / totalExplored) * 100) : 0;

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          Disaster Response Drone
          <span className="ml-2 text-blue-600">Pathfinding Engine</span>
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          AI2002 · Anisotropic A* on a weighted Moore-neighborhood grid
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-5 items-start">

        {/* ── Grid panel ──────────────────────────────────────────── */}
        <section className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Grid Editor</h2>
            {isAnimating && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium animate-pulse">
                {animPhase === "exploring" ? "Searching…" : "Drawing path…"}
              </span>
            )}
            {isDone && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                Complete
              </span>
            )}
          </div>

          <DroneGrid
            rows={rows}
            cols={cols}
            exploredCells={exploredCells}
            optimalPath={displayedPath}
            disabled={isAnimating}
            onGridChange={setGrid}
            onStartChange={setStart}
            onGoalChange={setGoal}
            onReset={handleGridReset}
          />
        </section>

        {/* ── Right sidebar ───────────────────────────────────────── */}
        <aside className="w-full xl:w-72 flex flex-col gap-4">

          {/* ── Config card ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-gray-700">Configuration</h2>

            <LabeledSelect
              label="Grid Size"
              value={gridSizeIdx}
              onChange={(v) => {
                handleGridReset();
                setGridSizeIdx(Number(v));
              }}
              options={GRID_SIZE_OPTIONS.map((o, i) => ({ label: o.label, value: i }))}
              disabled={isAnimating}
            />

            <LabeledSelect
              label="Algorithm"
              value={algorithm}
              onChange={(v) => setAlgorithm(v as Algorithm)}
              options={ALGORITHM_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              disabled={isAnimating || loading}
            />
            {algorithm === "ucs" && (
              <p className="text-xs text-amber-600 -mt-2 bg-amber-50 border border-amber-200 rounded p-2">
                UCS backend pending (Salman). API will return 501.
              </p>
            )}

            <LabeledSelect
              label="Animation Speed"
              value={speedIdx}
              onChange={(v) => setSpeedIdx(Number(v))}
              options={SPEED_OPTIONS.map((o, i) => ({ label: o.label, value: i }))}
              disabled={isAnimating}
            />

            {/* Coordinate summary */}
            <div className="flex gap-3 text-xs">
              <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-green-600 font-semibold mb-0.5">Start</p>
                <p className="font-mono text-green-800">
                  {start ? `[${start[0]}, ${start[1]}]` : "not set"}
                </p>
              </div>
              <div className="flex-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-red-600 font-semibold mb-0.5">Goal</p>
                <p className="font-mono text-red-800">
                  {goal ? `[${goal[0]}, ${goal[1]}]` : "not set"}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {/* Primary: Calculate / Stop */}
              {!isAnimating ? (
                <button
                  onClick={handleCalculate}
                  disabled={loading || !start || !goal}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white
                             bg-blue-600 hover:bg-blue-700 active:scale-95
                             disabled:bg-gray-300 disabled:cursor-not-allowed
                             transition-all shadow-sm"
                >
                  {loading ? "Fetching path…" : "Calculate Path"}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white
                             bg-red-500 hover:bg-red-600 active:scale-95
                             transition-all shadow-sm"
                >
                  Stop Animation
                </button>
              )}

              {/* Secondary: Replay */}
              {isDone && result && (
                <button
                  onClick={handleReplay}
                  className="w-full py-2 rounded-xl text-sm font-semibold
                             text-blue-700 bg-blue-50 hover:bg-blue-100
                             border border-blue-200 transition-all"
                >
                  Replay Animation
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 leading-relaxed">
                {error}
              </div>
            )}
          </div>

          {/* ── Progress card (shown while animating) ───────────── */}
          {(isAnimating || isDone) && result && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-700">Animation Progress</h2>

              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>
                  {animPhase === "drawing"
                    ? "Drawing path…"
                    : animPhase === "done"
                    ? "Done"
                    : `Exploring: ${animProgress} / ${totalExplored}`}
                </span>
                <span className="font-mono">{progressPct}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-100 ${
                    animPhase === "drawing" || animPhase === "done"
                      ? "bg-lime-400"
                      : "bg-sky-400"
                  }`}
                  style={{ width: `${animPhase === "drawing" || animPhase === "done" ? 100 : progressPct}%` }}
                />
              </div>

              <div className="flex gap-2 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-200 inline-block border border-sky-400" />
                  Frontier
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-lime-400 inline-block border border-lime-600" />
                  Optimal path
                </span>
              </div>
            </div>
          )}

          {/* ── Metrics card (shown after calculation) ──────────── */}
          {result && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-700">Metrics</h2>

              <div className="grid grid-cols-2 gap-2">
                <MetricCard
                  label="Total Cost"
                  value={
                    result.metrics.total_cost === -1
                      ? "∞"
                      : String(result.metrics.total_cost)
                  }
                />
                <MetricCard
                  label="Nodes Expanded"
                  value={String(result.metrics.nodes_expanded)}
                />
                <MetricCard
                  label="Path Length"
                  value={
                    result.optimal_path.length === 0
                      ? "No path"
                      : `${result.optimal_path.length} cells`
                  }
                />
                <MetricCard
                  label="Search Coverage"
                  value={`${Math.round(
                    (result.metrics.nodes_expanded / (rows * cols)) * 100
                  )}%`}
                  sub={`of ${rows * cols} cells`}
                />
              </div>

              {result.optimal_path.length === 0 && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-2">
                  No path exists between start and goal with the current obstacles.
                </p>
              )}
            </div>
          )}

        </aside>
      </div>
    </main>
  );
}
