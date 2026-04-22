# Assignment 3 Technical Report

## Disaster Response Drone Pathfinding Engine

Course: AI2002  
Project type: Weighted-grid pathfinding with interactive GUI  
Codebase audited: `/Users/zain/Documents/6th_Semester/AI/assignment-1`  
Audit date: 2026-04-22

---

## How This Report Was Prepared

This report is based on a direct audit of the submitted codebase rather than a generic project template. The audit covered:

- Backend source in `backend/main.py`
- Frontend source in `frontend/app/page.tsx`, `frontend/app/DroneGrid.tsx`, `frontend/app/layout.tsx`, and `frontend/app/globals.css`
- Dependency manifests and project documentation
- Runtime verification of backend algorithm behavior using the existing Python virtual environment
- Frontend lint/build checks using the installed Node.js dependencies already present in the project

Generated and vendored folders were intentionally excluded from architectural analysis:

- `backend/venv/`
- `frontend/node_modules/`
- `frontend/.next/`

---

## Executive Summary

The project implements a disaster-response drone pathfinding simulator with a FastAPI backend and a Next.js frontend. The core implemented AI method is A* search over an 8-connected weighted grid where terrain types model different traversal costs. The GUI supports manual grid painting, random hazard generation, algorithm selection, animation-speed control, and stepwise visualization of explored nodes and the final route.

From an academic perspective, the project is strong in these areas:

- Clear separation between backend path computation and frontend visualization
- Useful interactive GUI for demonstrating AI search behavior
- Clean, readable implementation with meaningful comments
- Working A* search, path reconstruction, metrics reporting, and animated visualization

The audit also found several important issues that should be documented honestly in the final submission:

1. Uniform Cost Search is exposed in the frontend but not implemented in the backend.
2. The current diagonal movement model makes Euclidean heuristic assumptions theoretically inconsistent with the actual step-cost model.
3. The backend does not validate ragged grids and can raise `IndexError` on malformed input.
4. The pathfinder allows diagonal corner-cutting through blocked orthogonal neighbors.
5. The frontend production build fails in an offline environment because `next/font/google` fetches external font assets.
6. Repository hygiene is incomplete for GitHub submission because the workspace root is not a Git repository, while `frontend/` is a nested Git repository and generated artifacts are committed.

These issues do not erase the project’s strengths, but they are important to acknowledge under limitations and future work.

---

## Codebase Inventory

### Relevant Application Files

- `README.md`
- `backend/main.py`
- `backend/requirements.txt`
- `frontend/app/page.tsx`
- `frontend/app/DroneGrid.tsx`
- `frontend/app/layout.tsx`
- `frontend/app/globals.css`
- `frontend/package.json`
- `frontend/tsconfig.json`
- `frontend/eslint.config.mjs`

### Observed Repository State

- The workspace root is not initialized as a Git repository.
- `frontend/` contains its own nested `.git/` directory.
- The project includes generated or environment-specific content:
  - `backend/venv/`
  - `frontend/node_modules/`
  - `frontend/.next/`
  - `frontend/tsconfig.tsbuildinfo`

This matters because Assignment 3 explicitly requires a clean, well-organized GitHub repository.

---

# Audit Findings

## High-Priority Findings

### 1. UCS is advertised but not implemented

Evidence:

- `backend/main.py:212-225`
- `backend/main.py:265-269`
- `frontend/app/page.tsx:42-45`
- `frontend/app/page.tsx:362-365`

Details:

- The frontend exposes both `astar` and `ucs`.
- The backend defines a `UCSPathfinder` class, but `search()` raises `NotImplementedError`.
- The API intentionally returns HTTP 501 for `ucs`.

Impact:

- The project currently supports only one real search algorithm.
- Any report comparing A* and UCS would be inaccurate unless presented as planned future work.

Verified behavior:

- Requesting `ucs` returns:
  - `{'status_code': 501, 'detail': 'UCS not yet implemented — assigned to Salman'}`

### 2. The heuristic is theoretically non-admissible under the implemented move-cost model

Evidence:

- `backend/main.py:109-112`
- `backend/main.py:177-198`
- `backend/main.py:188-189`

Details:

- The code allows diagonal moves.
- Diagonal step cost currently equals the destination cell cost, exactly like orthogonal movement.
- The comment at `backend/main.py:188-189` shows the intended `sqrt(2)` diagonal multiplier is not active.
- The heuristic is Euclidean distance.

Why this matters:

- If diagonal traversal from one free cell to another costs `1`, but Euclidean distance between diagonal neighbors is `sqrt(2)`, then the heuristic can overestimate the true remaining cost.
- That breaks the classical admissibility guarantee of A*.

Concrete example:

- Start `(0,0)`, goal `(1,1)`, both free.
- Current optimal path cost is `1.0` because diagonal motion is allowed at base cell cost.
- Euclidean heuristic from start to goal is approximately `1.414`.

Observed runtime result:

- The implementation still found the optimal route in the tested case, but optimality is no longer theoretically guaranteed.

### 3. Ragged grids are not validated and can crash the backend

Evidence:

- `backend/main.py:49-61`
- `backend/main.py:88-91`
- `backend/main.py:243-258`

Details:

- `PathRequest.grid_must_be_nonempty()` only checks that the grid exists and the first row is non-empty.
- No validation ensures all rows have equal length.
- `cols = len(grid[0])` assumes rectangular structure.
- A malformed request such as `[[0,0,0],[0]]` can trigger `IndexError`.

Verified behavior:

- Direct invocation with a ragged grid raised:
  - `IndexError: list index out of range`

Impact:

- The public API is not robust against malformed external input.
- The frontend always sends rectangular grids, so the issue is masked in normal UI usage, but it is still a backend correctness gap.

### 4. Diagonal corner-cutting is allowed through blocked orthogonal cells

Evidence:

- `backend/main.py:177-186`

Details:

- Neighbor expansion checks only the destination cell.
- There is no rule preventing diagonal motion between two blocked orthogonal cells.

Verified behavior:

- Grid:

```text
[S, Wall]
[Wall, G]
```

- The algorithm returns a direct diagonal path from `S` to `G` with total cost `1.0`.

Impact:

- This may be unrealistic for a drone depending on whether obstacles represent solid building footprints, fire zones, or no-fly cells.
- The report should state the current assumption clearly: the grid forbids entering blocked cells, but does not forbid diagonal passage around obstacle corners.

### 5. Frontend production build depends on online Google font fetches

Evidence:

- `frontend/app/layout.tsx:1-17`

Details:

- The app imports `Geist` and `Geist_Mono` from `next/font/google`.
- In an offline or restricted environment, `npm run build` fails because fonts cannot be fetched.

Verified behavior:

- Build failed with errors stating `Failed to fetch Geist from Google Fonts`.

Impact:

- Reproducibility is weaker than required for an academic submission that should build reliably.
- For a final deliverable, local fonts or a fallback stack would be safer.

### 6. Repository organization is not yet ready for final GitHub submission

Evidence:

- Root folder has no Git repository.
- `frontend/` is a nested Git repository.
- Generated content and local environments are present in the workspace.

Impact:

- The final GitHub submission would be confusing if pushed as-is.
- A clean root repository should be created with proper `.gitignore` rules and without vendored local runtime directories.

---

## Medium-Priority Findings

### 7. React lint error in grid re-initialization effect

Evidence:

- `frontend/app/DroneGrid.tsx:147-155`

Details:

- `npm run lint` reported:
  - `react-hooks/set-state-in-effect`
- The component re-initializes internal state inside `useEffect` when dimensions change.

Impact:

- The app still works, but this pattern is flagged because it may cause unnecessary cascading renders.

### 8. `API_BASE` is hard-coded to localhost

Evidence:

- `frontend/app/page.tsx:65`

Impact:

- The project is tightly bound to a development setup.
- Deployment or alternate backend hosts would require source modification instead of environment configuration.

### 9. Backend test harness dependencies are incomplete

Evidence:

- Attempting `fastapi.testclient.TestClient` failed because `httpx` is not installed in the Python environment.

Impact:

- Automated API tests are harder to write and run.
- This weakens evidence for robustness and reproducibility.

### 10. Root and frontend documentation are inconsistent

Evidence:

- Root `README.md` is project-specific and useful.
- `frontend/README.md` is still the default create-next-app template.

Impact:

- The repository presents mixed levels of polish.
- For submission, documentation should be consistent and project-specific.

---

# Part A: Algorithmic Specifications and Pseudocode

## A.1 Problem Definition

The project models a disaster environment as a weighted 2D grid:

- `0`: free airspace, cost `1`
- `1`: smoke, cost `5`
- `2`: debris, cost `10`
- `3`: wall/fire, impassable

The objective is to compute a minimum-cost route from a user-defined start cell to a goal cell using 8-directional movement.

State representation:

- A state is a coordinate pair `(row, col)`.

Transition model:

- From each state, the drone may move to up to 8 neighbors:
  - North, South, East, West
  - North-West, North-East, South-West, South-East

Path cost model:

- Cost is charged when entering a destination cell.
- Impassable cells have infinite cost and are skipped.

Search outputs:

- `explored_sequence`: expansion order for visualization
- `optimal_path`: final path from start to goal
- `metrics.total_cost`
- `metrics.nodes_expanded`

## A.2 Core Algorithm Pseudocode: A* Search

```text
Algorithm A_STAR_SEARCH(grid, start, goal)
Input:
    grid: rectangular 2D matrix of terrain codes
    start: start coordinate (r, c)
    goal: goal coordinate (r, c)
Output:
    explored_sequence, optimal_path, metrics

1. open_set <- empty min-priority queue
2. counter <- 0
3. g_score[start] <- 0
4. came_from[start] <- NIL
5. h <- HEURISTIC(start, goal)
6. PUSH(open_set, (h, counter, start))
7. explored_sequence <- empty list
8. nodes_expanded <- 0

9. while open_set is not empty do
10.     (f, _, current) <- POP_MIN(open_set)

11.     if f > g_score[current] + HEURISTIC(current, goal) + epsilon then
12.         continue
13.     end if

14.     APPEND explored_sequence, current
15.     nodes_expanded <- nodes_expanded + 1

16.     if current = goal then
17.         optimal_path <- RECONSTRUCT_PATH(came_from, current)
18.         return {
19.             explored_sequence,
20.             optimal_path,
21.             metrics = {
22.                 total_cost = g_score[current],
23.                 nodes_expanded = nodes_expanded
24.             }
25.         }
26.     end if

27.     for each (dr, dc, is_diagonal) in DIRECTIONS do
28.         neighbor <- (current.row + dr, current.col + dc)

29.         if not IN_BOUNDS(neighbor) then
30.             continue
31.         end if

32.         step_cost <- CELL_COST(neighbor)
33.         if step_cost = infinity then
34.             continue
35.         end if

36.         tentative_g <- g_score[current] + step_cost

37.         if tentative_g < g_score.get(neighbor, infinity) then
38.             came_from[neighbor] <- current
39.             g_score[neighbor] <- tentative_g
40.             h <- HEURISTIC(neighbor, goal)
41.             counter <- counter + 1
42.             PUSH(open_set, (tentative_g + h, counter, neighbor))
43.         end if
44.     end for
45. end while

46. return {
47.     explored_sequence,
48.     optimal_path = empty list,
49.     metrics = {
50.         total_cost = -1,
51.         nodes_expanded = nodes_expanded
52.     }
53. }
```

Complexity:

- Time: `O((V + E) log V)` in the standard heap-based formulation
- Space: `O(V)` for `g_score`, `came_from`, and the heap

## A.3 Auxiliary Procedure Pseudocode

### Heuristic Function

```text
Algorithm HEURISTIC(node, goal)
1. dr <- node.row - goal.row
2. dc <- node.col - goal.col
3. return sqrt(dr^2 + dc^2)
```

Complexity:

- Time: `O(1)`
- Space: `O(1)`

### Cell Cost Lookup

```text
Algorithm CELL_COST(cell)
1. if grid[cell] = 0 then return 1
2. if grid[cell] = 1 then return 5
3. if grid[cell] = 2 then return 10
4. if grid[cell] = 3 then return infinity
5. otherwise return infinity
```

Complexity:

- Time: `O(1)`
- Space: `O(1)`

### Boundary Check

```text
Algorithm IN_BOUNDS(cell)
1. return (0 <= cell.row < rows) AND (0 <= cell.col < cols)
```

Complexity:

- Time: `O(1)`
- Space: `O(1)`

### Path Reconstruction

```text
Algorithm RECONSTRUCT_PATH(came_from, current)
1. path <- empty list
2. while current is not NIL do
3.     APPEND path, current
4.     current <- came_from.get(current)
5. end while
6. REVERSE(path)
7. return path
```

Complexity:

- Time: `O(L)`, where `L` is path length
- Space: `O(L)`

### Random Grid Generation

```text
Algorithm BUILD_RANDOM_GRID(rows, cols, density, protected_cells)
1. grid <- empty matrix
2. for r from 0 to rows - 1 do
3.     for c from 0 to cols - 1 do
4.         if (r, c) in protected_cells then
5.             grid[r][c] <- FREE
6.         else
7.             grid[r][c] <- RANDOM_CELL_TYPE(density)
8.         end if
9.     end for
10. end for
11. return grid
```

## A.4 Data Structure Operations

### Priority Queue Use

The backend uses Python’s `heapq` as a min-priority queue.

Stored tuple:

- `(f_score, tie_breaker, node)`

Why the tie-breaker matters:

- It prevents tuple-comparison issues when two nodes share the same `f_score`.

Push:

```text
PUSH(open_set, (f, counter, node))   -> O(log n)
```

Pop minimum:

```text
POP_MIN(open_set)                    -> O(log n)
```

### Lazy Deletion Strategy

Instead of decreasing keys in-place, the algorithm pushes improved entries and skips stale ones when popped:

```text
if popped_f > current_g + heuristic(current, goal) + epsilon:
    skip stale entry
```

This is a standard practical optimization for binary-heap A* implementations.

## A.5 Optimization Strategies Used

### Implemented Optimizations

1. Heuristic guidance in A*
   - Euclidean distance focuses search toward the goal.

2. Pruning invalid neighbors early
   - Out-of-bounds neighbors are discarded immediately.
   - Impassable cells are skipped immediately.

3. Lazy deletion in the heap
   - Avoids the cost and complexity of explicit decrease-key operations.

4. Constant-time overlay lookup in the frontend
   - `useMemo()` builds `optimalPathSet` for `O(1)` membership checks during rendering.

5. Reduced animation-state churn
   - The frontend accumulates explored nodes in a local `Set` and snapshots it, rather than recomputing everything from scratch on each frame.

### Not Implemented, but Relevant to the Assignment Prompt

1. Memoization / dynamic programming
   - Not used in the backend pathfinding algorithm.

2. Parallel execution
   - Not used.

3. Approximation for intractable cases
   - Not used; the current grid sizes are small enough for exact search.

4. Search-space pruning beyond blocked/out-of-bounds filtering
   - No advanced pruning such as dominance pruning, jump point search, or hierarchical abstraction is implemented.

---

# Part B: System Architecture and UML Guidance

## B.1 Architectural Style

The project follows a lightweight client-server architecture with a clear separation of responsibilities:

- Presentation layer: Next.js/React frontend
- Application/service layer: FastAPI route handling
- Algorithm layer: backend A* pathfinder
- Visualization layer: frontend animation and grid rendering

This is closest to a layered architecture with a client-server deployment model.

## B.2 High-Level Architecture Description

1. The user edits a terrain grid in the browser.
2. The frontend stores grid state, start node, goal node, chosen algorithm, and animation speed.
3. On `Calculate Path`, the frontend sends a JSON POST request to `/calculate-path`.
4. The backend validates start/goal coordinates and algorithm choice.
5. The backend executes A* search and returns:
   - explored node order
   - optimal path
   - metrics
6. The frontend animates explored nodes first, then the optimal path, and finally displays summary metrics.

## B.3 Class Diagram Placeholder

**[Placeholder: Insert Figure B1 - UML Class Diagram Here]**

Suggested classes/entities to include in the class diagram:

- `PathRequest`
  - Attributes: `grid`, `start`, `goal`, `algorithm`
  - Methods: validators

- `Metrics`
  - Attributes: `total_cost`, `nodes_expanded`

- `PathResponse`
  - Attributes: `explored_sequence`, `optimal_path`, `metrics`

- `AStarPathfinder`
  - Attributes: `grid`, `rows`, `cols`, `directions`
  - Methods: `heuristic()`, `_cell_cost()`, `_in_bounds()`, `_reconstruct_path()`, `search()`

- `UCSPathfinder`
  - Attributes: `grid`, `rows`, `cols`
  - Methods: `search()`

- `Home` React component
  - State: grid, start, goal, result, loading, error, animation state
  - Methods: `handleCalculate()`, `runAnimation()`, `handleStop()`, `handleReplay()`, `handleGridReset()`

- `DroneGrid` React component
  - State: local grid, local start/goal, paint mode, density
  - Methods: `applyPaint()`, `handleReset()`, `handleRandomize()`, `cellClass()`

Suggested relationships:

- `PathResponse` composes `Metrics`
- `Home` uses `DroneGrid`
- `/calculate-path` uses `PathRequest`, `AStarPathfinder`, `Metrics`, and `PathResponse`
- `UCSPathfinder` is a planned sibling strategy to `AStarPathfinder`

## B.4 Sequence Diagram Placeholder

**[Placeholder: Insert Figure B2 - Sequence Diagram Here]**

Recommended sequence scenario:

- User places start and goal
- User paints or randomizes terrain
- User clicks `Calculate Path`
- `Home.handleCalculate()` sends fetch request
- FastAPI route `calculate_path()` validates input
- `AStarPathfinder.search()` runs
- Backend returns JSON result
- Frontend stores result
- Frontend animates `explored_sequence`
- Frontend animates `optimal_path`
- Metrics card updates

Suggested participants:

- User
- `Home`
- `DroneGrid`
- Browser `fetch`
- FastAPI app
- `calculate_path()`
- `AStarPathfinder`

## B.5 Activity Diagram Placeholder

**[Optional Placeholder: Insert Figure B3 - Activity Diagram Here]**

Recommended control flow:

- Start
- Validate start/goal
- Send request
- Validate backend input
- Select algorithm
- Execute search loop
- Goal found?
- If yes, reconstruct path and return metrics
- If no, return empty path and failure metrics
- Animate results
- End

## B.6 Component / Package Diagram Placeholder

**[Placeholder: Insert Figure B4 - Component or Package Diagram Here]**

Suggested components/packages:

- `frontend/app/page.tsx`
- `frontend/app/DroneGrid.tsx`
- `backend/main.py`
- Browser runtime
- FastAPI framework
- React/Next.js framework

Dependencies to show:

- `page.tsx` depends on `DroneGrid.tsx`
- `page.tsx` depends on backend `/calculate-path`
- `backend/main.py` depends on FastAPI, Pydantic, `heapq`, `math`

## B.7 Architecture Diagram Placeholder

**[Placeholder: Insert Figure B5 - Architecture Diagram Here]**

Suggested architecture labels:

- Client: Next.js + React GUI
- Transport: HTTP/JSON
- Server: FastAPI backend
- Core AI service: A* pathfinding engine
- Data model: weighted grid, start, goal, metrics

---

# Part C: Implementation Artifacts and Code Documentation

## C.1 Annotated Code Snippet 1: Core A* Expansion Loop

Source reference: `backend/main.py:155-198`

```python
while open_set:
    f, _, current = heapq.heappop(open_set)

    # Skip outdated heap entries inserted before a better path was found.
    if f > g_score.get(current, math.inf) + self.heuristic(current, goal) + 1e-9:
        continue

    explored_sequence.append(list(current))
    nodes_expanded += 1

    if current == goal:
        path = self._reconstruct_path(came_from, current)
        return {
            "explored_sequence": explored_sequence,
            "optimal_path": path,
            "metrics": {
                "total_cost": g_score[current],
                "nodes_expanded": nodes_expanded,
            },
        }

    r, c = current
    for dr, dc, is_diagonal in self.directions:
        nr, nc = r + dr, c + dc
        neighbor = (nr, nc)
```

Why this snippet matters:

- It shows best-first expansion via a priority queue.
- It records full exploration history for visualization.
- It returns immediately on goal detection, which improves efficiency.

## C.2 Annotated Code Snippet 2: Cost Update and Frontier Push

Source reference: `backend/main.py:181-198`

```python
if not self._in_bounds(nr, nc):
    continue

step_cost = self._cell_cost(nr, nc)
if step_cost == math.inf:
    continue

# Planned improvement: multiply diagonal moves by sqrt(2)
# to align movement geometry with Euclidean heuristic.
# step_cost *= (math.sqrt(2) if is_diagonal else 1.0)

tentative_g = g_score[current] + step_cost

if tentative_g < g_score.get(neighbor, math.inf):
    came_from[neighbor] = current
    g_score[neighbor] = tentative_g
    h = self.heuristic(neighbor, goal)
    counter += 1
    heapq.heappush(open_set, (tentative_g + h, counter, neighbor))
```

Why this snippet matters:

- It captures the weighted nature of the problem.
- It shows pruning of invalid moves.
- It reveals the diagonal-cost TODO that affects theoretical correctness.

## C.3 Annotated Code Snippet 3: Error Handling and Request Validation

Source reference: `backend/main.py:237-283`

```python
@app.post("/calculate-path", response_model=PathResponse)
def calculate_path(request: PathRequest):
    grid = request.grid
    start = tuple(request.start)
    goal = tuple(request.goal)

    rows = len(grid)
    cols = len(grid[0])

    for label, coord in [("start", start), ("goal", goal)]:
        r, c = coord
        if not (0 <= r < rows and 0 <= c < cols):
            raise HTTPException(
                status_code=400,
                detail=f"{label} coordinate {list(coord)} is out of grid bounds ({rows}x{cols})",
            )
        if grid[r][c] == 3:
            raise HTTPException(
                status_code=400,
                detail=f"{label} coordinate {list(coord)} is on an impassable cell (wall/fire)",
            )

    algorithm = request.algorithm.lower()
```

Why this snippet matters:

- It demonstrates explicit input validation.
- It shows user-friendly error messaging.
- It is also the place where additional validation should be added for ragged grids and invalid cell codes.

## C.4 Annotated Code Snippet 4: Frontend Animation Engine

Source reference: `frontend/app/page.tsx:170-225`

```tsx
const runAnimation = useCallback(
  (data: PathResult) => {
    stopAnimation();
    clearOverlays();

    const { explored_sequence, optimal_path } = data;

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

    setAnimPhase("exploring");
    let exploreIdx = 0;
    const liveSet = new Set<string>();
```

Why this snippet matters:

- It demonstrates event-driven visualization rather than static output.
- It supports both instant rendering and animated playback.
- It separates exploration and path-drawing phases, which is good for AI demonstration value.

## C.5 Annotated Code Snippet 5: Grid Editing and Randomized Scenario Generation

Source reference: `frontend/app/DroneGrid.tsx:185-222` and `253-261`

```tsx
const applyPaint = useCallback(
  (row: number, col: number, isRightClick: boolean) => {
    if (disabled) return;

    if (isRightClick) {
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
```

Why this snippet matters:

- It shows direct manipulation of the search environment.
- It prevents invalid start/goal placement on impassable cells.
- It illustrates how GUI actions map into backend-compatible grid state.

## C.6 Execution Demonstrations and Test Cases

The following cases were executed against the audited backend implementation.

### Test Case 1: Reachable Path Around a Central Obstacle

Input grid:

```text
[
  [0, 0, 0],
  [0, 3, 0],
  [0, 0, 0]
]
start = (0, 0)
goal  = (2, 2)
```

Observed result:

```text
explored_sequence = [[0,0], [1,0], [2,1], [2,2]]
optimal_path      = [[0,0], [1,0], [2,1], [2,2]]
total_cost        = 3.0
nodes_expanded    = 4
```

Interpretation:

- The path successfully routes around the blocked center.
- The backend returns both the final path and the exploration trace for animation.

### Test Case 2: No Path Exists

Input grid:

```text
[
  [0, 3, 0],
  [3, 3, 3],
  [0, 3, 0]
]
start = (0, 0)
goal  = (2, 2)
```

Observed result:

```text
explored_sequence = [[0,0]]
optimal_path      = []
total_cost        = -1
nodes_expanded    = 1
```

Interpretation:

- The backend correctly reports a failure case.
- The frontend is designed to display a “No path exists” message when this occurs.

### Test Case 3: Weighted Terrain Detour

Input grid:

```text
[
  [0, 1, 2],
  [0, 1, 0],
  [0, 0, 0]
]
start = (0, 0)
goal  = (0, 2)
```

Observed result:

```text
explored_sequence = [[0,0], [1,0], [2,1], [1,2], [2,0], [2,2], [0,1], [1,1], [0,2]]
optimal_path      = [[0,0], [1,0], [2,1], [1,2], [0,2]]
total_cost        = 13.0
nodes_expanded    = 9
```

Interpretation:

- The algorithm accounts for terrain weight, not just geometric distance.
- The route avoids some expensive cells, although the current diagonal-cost model affects theoretical interpretation.

### Test Case 4: Invalid Coordinate Handling

Input:

```text
grid  = [[0,0],[0,0]]
start = [9,9]
goal  = [1,1]
algorithm = "astar"
```

Observed result:

```text
status_code = 400
detail = "start coordinate [9, 9] is out of grid bounds (2x2)"
```

### Test Case 5: Impassable Start Handling

Input:

```text
grid  = [[0,3],[0,0]]
start = [0,1]
goal  = [1,1]
algorithm = "astar"
```

Observed result:

```text
status_code = 400
detail = "start coordinate [0, 1] is on an impassable cell (wall/fire)"
```

### Test Case 6: Unsupported Algorithm Handling

Input:

```text
grid  = [[0]]
start = [0,0]
goal  = [0,0]
algorithm = "bogus"
```

Observed result:

```text
status_code = 400
detail = "Unknown algorithm 'bogus'. Use 'astar' or 'ucs'."
```

### Test Case 7: UCS Requested Before Implementation

Input:

```text
grid  = [[0,0],[0,0]]
start = [0,0]
goal  = [1,1]
algorithm = "ucs"
```

Observed result:

```text
status_code = 501
detail = "UCS not yet implemented — assigned to Salman"
```

## C.7 Code Quality and Verification Notes

### Backend Verification

- Syntax compilation passed when `PYTHONPYCACHEPREFIX` was redirected to `/tmp/pycache`.
- Direct function execution confirmed that the pathfinder runs and returns structured results.

### Frontend Verification

- `npm run lint` produced:
  - 1 error
  - 2 warnings
- `npm run build` failed because Google fonts could not be fetched in the restricted environment.

### What Was Not Available

- Formal automated test suite: not present in the repository
- API integration tests through `TestClient`: blocked because `httpx` is not installed in the Python environment

## C.8 Current Limitations

1. Only A* is implemented end-to-end.
2. The current heuristic/cost relationship weakens A* optimality guarantees.
3. Corner-cutting diagonals may violate expected physical obstacle semantics.
4. Input validation is incomplete for malformed backend requests.
5. There is no automated unit or integration test suite.
6. The frontend build is not fully self-contained because of external font fetching.
7. Performance scaling beyond the included grid sizes is not formally benchmarked.
8. The repository organization is not yet suitable for final GitHub submission.

## C.9 Potential Improvements

1. Fully implement Uniform Cost Search and compare it experimentally against A*.
2. Correct diagonal move cost using the `sqrt(2)` multiplier or switch to a heuristic consistent with the actual movement model.
3. Add optional “no corner cutting” rules for more realistic obstacle navigation.
4. Add strict backend validation for:
   - rectangular grids
   - allowed cell values only
   - integer coordinate types
5. Replace Google-hosted fonts with local assets or resilient fallbacks.
6. Add backend unit tests and API integration tests.
7. Add benchmark instrumentation for 20x20, 30x30, and 50x50 grids.
8. Move configuration such as API base URL into environment variables.
9. Replace the default frontend README with project-specific documentation.
10. Clean the repository structure before GitHub submission.

## C.10 Lessons Learned

1. A visually strong frontend can make AI algorithms much easier to explain and defend academically.
2. Correctness details in pathfinding often hide in the interaction between movement rules and heuristics.
3. Input validation matters even when the GUI generates “valid” requests, because APIs should remain robust on their own.
4. Reproducibility depends not only on source code, but also on repository hygiene, dependency completeness, and offline build behavior.

---

# Part D: Graphical User Interface Documentation

## D.1 GUI Overview

The GUI is implemented as a single-page dashboard with two main regions:

- Main content area:
  - interactive grid editor
  - terrain painting controls
  - randomized map generation

- Sidebar:
  - grid size selector
  - algorithm selector
  - animation speed selector
  - current start/goal summary
  - action buttons
  - animation progress
  - result metrics

## D.2 Screenshot Placeholders

### Screenshot D1: Main Interface

**[Placeholder: Insert Screenshot D1 - Main Interface Here]**

Recommended annotation points:

- Page title
- Grid editor
- Terrain toolbar
- Randomize and clear controls
- Sidebar configuration controls
- Metrics and progress cards

### Screenshot D2: Input Mechanisms

**[Placeholder: Insert Screenshot D2 - Start/Goal and Terrain Input Here]**

Show:

- Start placement
- Goal placement
- Smoke painting
- Debris painting
- Wall placement

### Screenshot D3: Randomized Scenario Setup

**[Placeholder: Insert Screenshot D3 - Randomized Grid Generation Here]**

Show:

- Density selector
- Randomized terrain map
- Start and goal retained after randomization

### Screenshot D4: Search Exploration Phase

**[Placeholder: Insert Screenshot D4 - Frontier Visualization Here]**

Show:

- Blue explored cells
- Progress badge or progress card
- Search in progress state

### Screenshot D5: Final Optimal Path

**[Placeholder: Insert Screenshot D5 - Final Path Visualization Here]**

Show:

- Final green path
- Complete state
- Metrics summary

### Screenshot D6: Error or Edge Case Display

**[Placeholder: Insert Screenshot D6 - Validation/Error State Here]**

Suggested cases:

- Missing start or goal
- No path found
- UCS selected but backend not implemented

## D.3 Event Handling and Interaction Logic

### Button and Control Behavior

- `Calculate Path`
  - Validates that both start and goal exist
  - Sends the request to the backend
  - Starts animation upon successful response

- `Stop Animation`
  - Clears the active timer
  - Stops the current animation phase

- `Replay Animation`
  - Replays the most recent backend result

- `Randomize`
  - Generates a fresh grid using density-weighted terrain sampling
  - Preserves start and goal coordinates as protected cells

- `Clear`
  - Resets local grid, start, goal, and parent overlays

### Input Validation Strategy

Frontend validation:

- Prevents calculation without both start and goal
- Prevents placing start or goal on wall cells
- Disables editing during active animation

Backend validation:

- Rejects out-of-bounds start or goal
- Rejects impassable start or goal
- Rejects unsupported algorithm names

Known validation gap:

- Does not reject ragged grids before indexing

### State Management

Frontend state categories:

- Problem configuration: grid size, algorithm, speed
- Grid state: terrain matrix, start, goal
- Request state: loading, result, error
- Animation state: phase, explored cells, path overlay, progress

### Interface Responsiveness

Positive design choices:

- Controls are disabled during animation to avoid conflicting edits.
- Progress is shown both numerically and visually.
- Instant mode supports immediate result rendering.

Known issue:

- A lint warning indicates that one effect-driven state reset should be refactored for React best practices.

## D.4 Console Alternative

Not applicable. This project provides a graphical web interface rather than a console interface.

---

# Submission Readiness Checklist

## Currently Satisfied

- Core AI functionality exists for A*
- GUI exists and is interactive
- Backend API exists
- Dependencies are listed
- Root README exists

## Still Needed Before Final Assignment Submission

1. Add UML diagrams to the placeholders in this report.
2. Capture and insert GUI screenshots into the placeholders in this report.
3. Decide whether UCS will be implemented or documented as future work only.
4. Clean the repository for GitHub:
   - initialize a proper root repository
   - remove nested Git structure confusion
   - add `.gitignore`
   - exclude `venv`, `node_modules`, `.next`, and build artifacts
5. Replace the default frontend README with project-specific instructions.
6. Optionally add tests and fix the highlighted lint/build issues.
7. Export this report to PDF for final submission.

---

# Suggested Appendix Material

The following can be added later as appendices without changing the main report structure:

- Appendix A: UML image files
- Appendix B: GUI screenshots
- Appendix C: Extended test tables
- Appendix D: GitHub repository link
- Appendix E: Installation and execution guide

---

# Final Remarks

This project already demonstrates a meaningful AI application with a working search backend and a pedagogically useful visualization interface. Its strongest contribution is the way it connects algorithmic pathfinding with interactive, user-driven experimentation. For the final Assignment 3 submission, the most important next step is not inventing more features, but polishing correctness claims, documenting current constraints honestly, and packaging the repository cleanly for reproducibility.
