"""
Disaster Response Drone - Pathfinding API
AI2002 Academic Project

Author: Zain (initial scaffold) | Optimization: Salman
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import heapq
import math
from typing import Optional

app = FastAPI(
    title="Drone Pathfinding API",
    description="Anisotropic A* Pathfinding for Disaster Response Drone Simulation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Cell cost mapping
# ---------------------------------------------------------------------------
CELL_COSTS = {
    0: 1,       # Free airspace
    1: 5,       # Smoke
    2: 10,      # Debris
    3: math.inf,  # Fire / Building (impassable)
}

# ---------------------------------------------------------------------------
# Pydantic models (API contract)
# ---------------------------------------------------------------------------

class PathRequest(BaseModel):
    grid: list[list[int]]       # 2D array of cell types (0-3)
    start: list[int]            # [row, col]
    goal: list[int]             # [row, col]
    algorithm: str = "astar"    # "astar" | "ucs"

    @field_validator("grid")
    @classmethod
    def grid_must_be_nonempty(cls, v):
        if not v or not v[0]:
            raise ValueError("Grid must be a non-empty 2D array")
        return v

    @field_validator("start", "goal")
    @classmethod
    def coords_must_be_pair(cls, v):
        if len(v) != 2:
            raise ValueError("start and goal must be [row, col] pairs")
        return v


class Metrics(BaseModel):
    total_cost: float
    nodes_expanded: int


class PathResponse(BaseModel):
    explored_sequence: list[list[int]]   # order nodes were popped from open set
    optimal_path: list[list[int]]        # final path from start → goal
    metrics: Metrics


# ---------------------------------------------------------------------------
# A* Algorithm
# ---------------------------------------------------------------------------

class AStarPathfinder:
    """
    8-connected (Moore neighborhood) A* pathfinder with full expansion tracking.

    Scaffold by Zain.
    TODO (Salman): tie-breaking on f-score, diagonal cost correction (√2 factor),
                   performance profiling for large grids.
    """

    def __init__(self, grid: list[list[int]]):
        self.grid = grid
        self.rows = len(grid)
        self.cols = len(grid[0])

        # All 8 directions: (dr, dc, is_diagonal)
        self.directions = [
            (-1,  0, False),  # N
            ( 1,  0, False),  # S
            ( 0, -1, False),  # W
            ( 0,  1, False),  # E
            (-1, -1, True),   # NW
            (-1,  1, True),   # NE
            ( 1, -1, True),   # SW
            ( 1,  1, True),   # SE
        ]

    # ------------------------------------------------------------------
    # Heuristic — Euclidean distance (admissible for 8-directional grids)
    # TODO (Salman): benchmark Chebyshev vs Euclidean for this cost model
    # ------------------------------------------------------------------
    def heuristic(self, node: tuple[int, int], goal: tuple[int, int]) -> float:
        dr = node[0] - goal[0]
        dc = node[1] - goal[1]
        return math.sqrt(dr * dr + dc * dc)

    def _cell_cost(self, row: int, col: int) -> float:
        """Return traversal cost for entering a cell."""
        return CELL_COSTS.get(self.grid[row][col], math.inf)

    def _in_bounds(self, row: int, col: int) -> bool:
        return 0 <= row < self.rows and 0 <= col < self.cols

    def _reconstruct_path(
        self, came_from: dict, current: tuple[int, int]
    ) -> list[list[int]]:
        path = []
        while current is not None:
            path.append(list(current))
            current = came_from.get(current)
        path.reverse()
        return path

    # ------------------------------------------------------------------
    # Core search
    # ------------------------------------------------------------------
    def search(
        self, start: tuple[int, int], goal: tuple[int, int]
    ) -> dict:
        """
        Run A* from start to goal.

        Returns dict with explored_sequence, optimal_path, and metrics.
        """
        # Priority queue entries: (f_score, tie_breaker, node)
        open_set: list = []
        counter = 0  # tie-breaker to avoid comparing tuples when f scores equal

        g_score: dict[tuple, float] = {start: 0.0}
        came_from: dict[tuple, Optional[tuple]] = {start: None}

        h = self.heuristic(start, goal)
        heapq.heappush(open_set, (h, counter, start))

        explored_sequence: list[list[int]] = []
        nodes_expanded = 0

        while open_set:
            f, _, current = heapq.heappop(open_set)

            # Skip stale entries (lazy deletion)
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

                if not self._in_bounds(nr, nc):
                    continue

                step_cost = self._cell_cost(nr, nc)
                if step_cost == math.inf:
                    continue

                # TODO (Salman): apply √2 multiplier for diagonal moves
                # step_cost *= (math.sqrt(2) if is_diagonal else 1.0)

                tentative_g = g_score[current] + step_cost

                if tentative_g < g_score.get(neighbor, math.inf):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g
                    h = self.heuristic(neighbor, goal)
                    counter += 1
                    heapq.heappush(open_set, (tentative_g + h, counter, neighbor))

        # No path found
        return {
            "explored_sequence": explored_sequence,
            "optimal_path": [],
            "metrics": {"total_cost": -1, "nodes_expanded": nodes_expanded},
        }


# ---------------------------------------------------------------------------
# UCS stub — Salman implements
# ---------------------------------------------------------------------------

class UCSPathfinder:
    """
    Uniform Cost Search (Dijkstra's) — no heuristic.

    TODO (Salman): implement full UCS for comparison against A*.
    """

    def __init__(self, grid: list[list[int]]):
        self.grid = grid
        self.rows = len(grid)
        self.cols = len(grid[0])

    def search(self, start: tuple, goal: tuple) -> dict:
        raise NotImplementedError("UCS not yet implemented — assigned to Salman")


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "drone-pathfinder"}


@app.post("/calculate-path", response_model=PathResponse)
def calculate_path(request: PathRequest):
    grid = request.grid
    start = tuple(request.start)
    goal = tuple(request.goal)

    rows = len(grid)
    cols = len(grid[0])

    # Validate coordinates
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

    if algorithm == "astar":
        pathfinder = AStarPathfinder(grid)
        result = pathfinder.search(start, goal)
    elif algorithm == "ucs":
        raise HTTPException(
            status_code=501,
            detail="UCS not yet implemented — assigned to Salman",
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown algorithm '{algorithm}'. Use 'astar' or 'ucs'.",
        )

    return PathResponse(
        explored_sequence=result["explored_sequence"],
        optimal_path=result["optimal_path"],
        metrics=Metrics(
            total_cost=result["metrics"]["total_cost"],
            nodes_expanded=result["metrics"]["nodes_expanded"],
        ),
    )
