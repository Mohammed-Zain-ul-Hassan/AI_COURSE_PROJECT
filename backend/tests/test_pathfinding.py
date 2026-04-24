import math

import pytest

from backend.ai_core.pathfinding import AStarPathfinder, UCSPathfinder


class TestAStarCorrectness:
    def test_straight_line_path_cost(self, narrow_corridor_grid):
        result = AStarPathfinder(narrow_corridor_grid).search((0, 0), (0, 4))
        assert result["metrics"]["total_cost"] == pytest.approx(4.0, abs=1e-6)

    def test_single_diagonal_path_cost(self):
        grid = [[0, 0], [0, 0]]
        result = AStarPathfinder(grid).search((0, 0), (1, 1))
        assert result["metrics"]["total_cost"] == pytest.approx(math.sqrt(2), abs=1e-6)

    def test_canonical_4x4_optimal_cost(self, canonical_4x4_grid):
        result = AStarPathfinder(canonical_4x4_grid).search((0, 0), (3, 3))
        assert result["metrics"]["total_cost"] == pytest.approx(2 + 2 * math.sqrt(2), abs=1e-6)

    def test_start_equals_goal(self, simple_open_grid):
        result = AStarPathfinder(simple_open_grid).search((1, 1), (1, 1))
        assert len(result["optimal_path"]) == 1
        assert result["optimal_path"] == [[1, 1]]
        assert result["metrics"]["total_cost"] == pytest.approx(0.0, abs=1e-6)

    def test_unreachable_goal(self):
        grid = [
            [0, 3, 0],
            [3, 3, 3],
            [0, 3, 0],
        ]
        result = AStarPathfinder(grid).search((0, 0), (2, 2))
        assert result["optimal_path"] == []
        assert result["metrics"]["total_cost"] == -1

    def test_octile_heuristic_admissibility(self, canonical_4x4_grid):
        result = AStarPathfinder(canonical_4x4_grid).search((0, 0), (3, 3))
        total_cells = len(canonical_4x4_grid) * len(canonical_4x4_grid[0])
        assert result["metrics"]["nodes_expanded"] < total_cells


class TestUCSCorrectness:
    def test_ucs_finds_optimal_cost(self, canonical_4x4_grid):
        astar_result = AStarPathfinder(canonical_4x4_grid).search((0, 0), (3, 3))
        ucs_result = UCSPathfinder(canonical_4x4_grid).search((0, 0), (3, 3))
        assert ucs_result["metrics"]["total_cost"] == pytest.approx(
            astar_result["metrics"]["total_cost"], abs=1e-6
        )

    def test_ucs_straight_line(self, narrow_corridor_grid):
        result = UCSPathfinder(narrow_corridor_grid).search((0, 0), (0, 4))
        assert result["metrics"]["total_cost"] == pytest.approx(4.0, abs=1e-6)

    def test_ucs_diagonal(self):
        grid = [[0, 0], [0, 0]]
        result = UCSPathfinder(grid).search((0, 0), (1, 1))
        assert result["metrics"]["total_cost"] == pytest.approx(math.sqrt(2), abs=1e-6)


class TestAStarVsUCS:
    def test_astar_expands_no_more_than_ucs(self, canonical_4x4_grid):
        astar_result = AStarPathfinder(canonical_4x4_grid).search((0, 0), (3, 3))
        ucs_result = UCSPathfinder(canonical_4x4_grid).search((0, 0), (3, 3))
        assert astar_result["metrics"]["nodes_expanded"] <= ucs_result["metrics"]["nodes_expanded"]

    def test_astar_strictly_better_on_open_grid(self):
        grid = [[0 for _ in range(10)] for _ in range(10)]
        astar_result = AStarPathfinder(grid).search((0, 0), (9, 9))
        ucs_result = UCSPathfinder(grid).search((0, 0), (9, 9))
        assert astar_result["metrics"]["nodes_expanded"] < ucs_result["metrics"]["nodes_expanded"]

    @pytest.mark.parametrize(
        "grid_fixture_name",
        ["simple_open_grid", "canonical_4x4_grid", "grid_with_wall_diagonal"],
    )
    def test_both_return_same_optimal_cost(self, request, grid_fixture_name):
        grid = request.getfixturevalue(grid_fixture_name)
        start = (0, 0)
        goal = (len(grid) - 1, len(grid[0]) - 1)
        astar_result = AStarPathfinder(grid).search(start, goal)
        ucs_result = UCSPathfinder(grid).search(start, goal)
        assert astar_result["metrics"]["total_cost"] == pytest.approx(
            ucs_result["metrics"]["total_cost"], abs=1e-6
        )
