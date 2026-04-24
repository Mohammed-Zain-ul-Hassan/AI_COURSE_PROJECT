import heapq
import math
from typing import Optional

from backend.schemas.common import CELL_COSTS


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
