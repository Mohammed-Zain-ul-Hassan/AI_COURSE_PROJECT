"use client";

/**
 * Pathfinding Engine — A* search visualizer
 * AI2002 Academic Project
 *
 * Features: 8-connected weighted grid, Octile heuristic, animated
 * exploration + path drawing, A* and UCS algorithm support.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import IntroPanel from "./_components/IntroPanel";
import { PATHFINDING_SCENARIOS } from "./_lib/scenarios";
import DroneGrid, { type CellType, type Coord, type DroneGridHandle } from "./DroneGrid";

// ---------------------------------------------------------------------------
// Config options (dropdowns — no magic numbers in JSX)
// ---------------------------------------------------------------------------

const GRID_SIZE_OPTIONS = [
  { label: "Hazard preset (15 × 15)", rows: 15, cols: 15 },
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
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </label>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm
                   text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400
                   disabled:cursor-not-allowed disabled:opacity-50"
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

function MetricCard({
  label,
  value,
  sub,
  emphasis = false,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        emphasis
          ? "border-blue-200 bg-blue-50/80"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums leading-tight text-slate-900 font-mono">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function PathfindingResultsEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-14 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
        <svg
          className="size-7"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold text-slate-800">No search run yet</p>
        <p className="text-sm leading-relaxed text-slate-500">
          Place <span className="font-medium text-slate-700">Start</span> and{" "}
          <span className="font-medium text-slate-700">Goal</span>, then click{" "}
          <span className="font-semibold text-blue-700">Calculate path</span> to
          see cost, coverage, expansion count, and the replay animation below.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  // ── Grid config ──────────────────────────────────────────────────────
  const [gridSizeIdx, setGridSizeIdx] = useState(3); // default Large 50×50
  const { rows, cols } = GRID_SIZE_OPTIONS[gridSizeIdx];

  const [grid, setGrid]   = useState<CellType[][]>([]);
  const [start, setStart] = useState<Coord | null>(null);
  const [goal, setGoal]   = useState<Coord | null>(null);

  const [pfScenarioId, setPfScenarioId] = useState("custom");
  const [pfSnap, setPfSnap] = useState<{
    grid: CellType[][];
    start: Coord;
    goal: Coord;
  } | null>(null);
  const [pfVer, setPfVer] = useState(0);

  const gridRef = useRef<DroneGridHandle>(null);

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

  const handleGridReset = useCallback(() => {
    stopAnimation();
    clearOverlays();
    setResult(null);
    setError(null);
  }, []);

  const applyPathScenario = useCallback(
    (id: string) => {
      handleGridReset();
      setPfScenarioId(id);
      if (id === "custom") {
        setPfSnap(null);
        setPfVer((v) => v + 1);
        return;
      }
      const sc = PATHFINDING_SCENARIOS.find((s) => s.id === id);
      if (!sc) return;
      const ix = GRID_SIZE_OPTIONS.findIndex(
        (o) => o.rows === sc.rows && o.cols === sc.cols
      );
      if (ix < 0) return;
      setGridSizeIdx(ix);
      setPfSnap({
        grid: sc.grid.map((r) => [...r]) as CellType[][],
        start: sc.start,
        goal: sc.goal,
      });
      setPfVer((v) => v + 1);
    },
    [handleGridReset]
  );

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
    [speed]
  );

  // ── Calculate path ───────────────────────────────────────────────────

  const handleCalculate = useCallback(async () => {
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
  }, [algorithm, grid, goal, runAnimation, start]);

  function handleStop() {
    stopAnimation();
    setAnimPhase("idle");
  }

  function handleReplay() {
    if (result) runAnimation(result);
  }

  // ── Derived UI state ─────────────────────────────────────────────────

  const isAnimating = animPhase === "exploring" || animPhase === "drawing";
  const isDone = animPhase === "done";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        loading ||
        animPhase === "exploring" ||
        animPhase === "drawing"
      )
        return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, select, textarea, [contenteditable=true]"))
        return;
      const key = e.key;
      const lower = key.toLowerCase();
      const tool = gridRef.current;
      if (lower === "s") {
        e.preventDefault();
        tool?.setPaintMode("start");
        return;
      }
      if (lower === "g") {
        e.preventDefault();
        tool?.setPaintMode("goal");
        return;
      }
      if (key >= "0" && key <= "3") {
        e.preventDefault();
        tool?.setPaintMode(Number(key) as CellType);
        return;
      }
      if (lower === "r") {
        e.preventDefault();
        tool?.randomize();
        return;
      }
      if (
        key === "Enter" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        void handleCalculate();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCalculate, handleGridReset, animPhase, loading]);

  const totalExplored = result?.explored_sequence.length ?? 0;
  const progressPct   = totalExplored > 0 ? Math.round((animProgress / totalExplored) * 100) : 0;

  // ── Render ───────────────────────────────────────────────────────────

  const pathExists =
    result !== null &&
    result.optimal_path.length > 0 &&
    result.metrics.total_cost !== -1;
  const pathImpossible =
    result !== null &&
    (result.optimal_path.length === 0 || result.metrics.total_cost === -1);

  return (
    <div className="pathfinding-shell bg-slate-100 p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Disaster Response Drone
          <span className="ml-2 text-blue-600">Pathfinding Engine</span>
        </h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
          <span>A* · UCS · Moore neighborhood · octile heuristic</span>
          {result && (
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
              {algorithm === "astar" ? "A*" : "UCS"} · {rows}×{cols}
            </span>
          )}
        </p>
      </div>

      <IntroPanel
        accent="blue"
        title="A* Pathfinding"
        body="Visualize how A* finds the lowest-cost route across a weighted grid. Watch the explored frontier grow and the optimal path emerge in real time."
        bullets={[
          "Paint terrain (smoke, debris, walls) or randomize it",
          "Place a Start (green) and Goal (red) cell",
          "Pick A* or UCS, then click Calculate Path",
        ]}
        onDismiss={() => {}}
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* Grid workspace */}
        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-white px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Hazard map & visualization
              </h2>
              <p className="text-xs text-slate-500">
                Paint terrain, place start / goal — overlays show search & path
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {isAnimating && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 animate-pulse">
                  <span className="size-1.5 rounded-full bg-blue-500" />
                  {animPhase === "exploring" ? "Expanding…" : "Drawing path…"}
                </span>
              )}
              {isDone && !isAnimating && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                  <svg
                    className="size-3.5 text-emerald-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Animation complete
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            <DroneGrid
              ref={gridRef}
              rows={rows}
              cols={cols}
              exploredCells={exploredCells}
              optimalPath={displayedPath}
              disabled={isAnimating}
              onGridChange={setGrid}
              onStartChange={setStart}
              onGoalChange={setGoal}
              onReset={handleGridReset}
              appliedPathScenario={pfSnap}
              appliedPathScenarioVersion={pfVer}
            />
          </div>
        </section>

        {/* Controls — mission-style sidebar */}
        <aside className="w-full shrink-0 lg:w-80">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Pathfinding controls
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Scenario, grid size, solver, playback speed
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <LabeledSelect
                label="Load scenario"
                value={pfScenarioId}
                onChange={(v) => applyPathScenario(v)}
                disabled={isAnimating}
                options={[
                  { label: "Custom", value: "custom" },
                  ...PATHFINDING_SCENARIOS.map((s) => ({
                    label: s.label,
                    value: s.id,
                  })),
                ]}
              />
              {pfScenarioId !== "custom" && (
                <p className="text-xs leading-relaxed text-slate-600">
                  {
                    PATHFINDING_SCENARIOS.find((s) => s.id === pfScenarioId)
                      ?.description
                  }
                </p>
              )}
            </div>

            <div className="space-y-3">
              <LabeledSelect
                label="Grid size"
                value={gridSizeIdx}
                onChange={(v) => {
                  handleGridReset();
                  setPfScenarioId("custom");
                  setPfSnap(null);
                  setPfVer((x) => x + 1);
                  setGridSizeIdx(Number(v));
                }}
                options={GRID_SIZE_OPTIONS.map((o, i) => ({
                  label: o.label,
                  value: i,
                }))}
                disabled={isAnimating}
              />
              <LabeledSelect
                label="Algorithm"
                value={algorithm}
                onChange={(v) => setAlgorithm(v as Algorithm)}
                options={ALGORITHM_OPTIONS.map((o) => ({
                  label: o.label,
                  value: o.value,
                }))}
                disabled={isAnimating || loading}
              />
              <LabeledSelect
                label="Animation speed"
                value={speedIdx}
                onChange={(v) => setSpeedIdx(Number(v))}
                options={SPEED_OPTIONS.map((o, i) => ({
                  label: o.label,
                  value: i,
                }))}
                disabled={isAnimating}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Start
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-950">
                  {start ? `[${start[0]}, ${start[1]}]` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-rose-200/80 bg-rose-50/90 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">
                  Goal
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-rose-950">
                  {goal ? `[${goal[0]}, ${goal[1]}]` : "—"}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              {!isAnimating ? (
                <button
                  type="button"
                  onClick={handleCalculate}
                  disabled={loading || !start || !goal}
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:active:scale-100"
                >
                  {loading ? "Computing…" : "Calculate path"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStop}
                  className="w-full rounded-xl bg-red-500 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-red-600 active:scale-[0.98]"
                >
                  Stop animation
                </button>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800"
              >
                {error}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Results — bottom panel (mirrors Mission Result) */}
      <section className="print-page-break mt-5 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Search results</h2>
            <p className="text-xs text-slate-500">
              Metrics, playback progress, and path status from the latest run
            </p>
          </div>
          {result && (
            <p className="text-xs font-medium text-slate-500">
              {rows} × {cols} grid ·{" "}
              {algorithm === "astar" ? "A* (octile heuristic)" : "UCS (Dijkstra-style)"}
            </p>
          )}
        </div>

        {!result && !loading && <PathfindingResultsEmpty />}

        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-blue-100 bg-blue-50/40 py-16">
            <span className="inline-block size-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
            <p className="text-sm font-medium text-blue-900">Calling backend solver…</p>
            <p className="text-xs text-blue-700/90">Hang tight — animation follows automatically</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-5">
            {pathExists && (
              <div
                className="flex flex-wrap items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900"
                role="status"
              >
                <svg
                  className="mt-0.5 size-5 shrink-0 text-emerald-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-sm font-bold text-emerald-950">Path found</p>
                  <p className="text-sm text-emerald-900/95">
                    Optimal route has{" "}
                    <span className="font-semibold tabular-nums">
                      {result.optimal_path.length}
                    </span>{" "}
                    steps and total cost{" "}
                    <span className="font-mono font-semibold">
                      {result.metrics.total_cost}
                    </span>
                    . Explorer expanded{" "}
                    <span className="font-semibold tabular-nums">
                      {result.metrics.nodes_expanded}
                    </span>{" "}
                    nodes.
                  </p>
                </div>
              </div>
            )}

            {pathImpossible && (
              <div
                className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"
                role="status"
              >
                <svg
                  className="mt-0.5 size-5 shrink-0 text-amber-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.58c.75 1.334-.213 2.98-1.742 2.98H3.48c-1.53 0-2.493-1.646-1.743-2.98l6.52-11.58zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 001-1V8a1 1 0 10-2 0v3a1 1 0 001 1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-sm font-bold text-amber-950">No feasible path</p>
                  <p className="text-sm text-amber-900">
                    Start and goal are disconnected by walls or the goal is unreachable
                    with the current terrain. Adjust obstacles or move the markers.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard
                label="Total cost"
                emphasis
                value={
                  result.metrics.total_cost === -1
                    ? "∞"
                    : String(result.metrics.total_cost)
                }
              />
              <MetricCard
                label="Nodes expanded"
                value={String(result.metrics.nodes_expanded)}
              />
              <MetricCard
                label="Path length"
                value={
                  result.optimal_path.length === 0
                    ? "—"
                    : `${result.optimal_path.length} cells`
                }
              />
              <MetricCard
                label="Coverage"
                value={`${Math.round(
                  (result.metrics.nodes_expanded / (rows * cols)) * 100
                )}%`}
                sub={`of ${rows * cols} cells`}
              />
            </div>

            {(isAnimating || isDone) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Animation
                  </h3>
                  <span className="font-mono text-xs text-slate-600">
                    {animPhase === "drawing" || animPhase === "done"
                      ? "100%"
                      : `${progressPct}%`}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                  <div
                    className={`h-full rounded-full transition-all duration-100 ${
                      animPhase === "drawing" || animPhase === "done"
                        ? "bg-lime-500"
                        : "bg-sky-500"
                    }`}
                    style={{
                      width: `${
                        animPhase === "drawing" || animPhase === "done"
                          ? 100
                          : progressPct
                      }%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {animPhase === "exploring" &&
                    `Frontier: ${animProgress} / ${totalExplored} cells`}
                  {animPhase === "drawing" && "Drawing optimal path on the grid…"}
                  {animPhase === "done" && "Finished — path and frontier are fully shown."}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm border border-sky-400 bg-sky-200" />
                    Explored
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm border border-lime-600 bg-lime-400" />
                    Optimal path
                  </span>
                </div>
              </div>
            )}

            {isDone && result && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handleReplay}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100"
                >
                  Replay animation
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
