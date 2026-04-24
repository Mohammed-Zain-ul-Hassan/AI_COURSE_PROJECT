import csv
import math
import statistics
import sys
import time
from pathlib import Path

from backend.ai_core.pathfinding import AStarPathfinder, UCSPathfinder


RESULTS_CSV = Path("backend/benchmarks/results.csv")
RESULTS_MD = Path("backend/benchmarks/results.md")


def build_open_grid(rows: int, cols: int) -> list[list[int]]:
    return [[0 for _ in range(cols)] for _ in range(rows)]


def build_sparse_obstacles_grid() -> list[list[int]]:
    grid = build_open_grid(10, 10)
    for row, col in [(2, 3), (3, 3), (4, 3), (5, 3), (6, 3)]:
        grid[row][col] = 1
    return grid


def build_wall_column_grid() -> list[list[int]]:
    grid = build_open_grid(20, 20)
    for row in range(16):
        grid[row][10] = 3
    return grid


def build_hazard_block_grid() -> list[list[int]]:
    grid = build_open_grid(15, 15)
    for row in range(5, 10):
        for col in range(5, 10):
            grid[row][col] = 2
    return grid


BENCHMARK_CASES = [
    {
        "name": "10x10 open",
        "grid": build_open_grid(10, 10),
        "start": [0, 0],
        "goal": [9, 9],
    },
    {
        "name": "10x10 sparse obstacles",
        "grid": build_sparse_obstacles_grid(),
        "start": [0, 0],
        "goal": [9, 9],
    },
    {
        "name": "20x20 open",
        "grid": build_open_grid(20, 20),
        "start": [0, 0],
        "goal": [19, 19],
    },
    {
        "name": "20x20 with walls",
        "grid": build_wall_column_grid(),
        "start": [0, 0],
        "goal": [19, 19],
    },
    {
        "name": "15x15 hazards",
        "grid": build_hazard_block_grid(),
        "start": [0, 0],
        "goal": [14, 14],
    },
    {
        "name": "30x30 open",
        "grid": build_open_grid(30, 30),
        "start": [0, 0],
        "goal": [29, 29],
    },
]


def run_once(pathfinder_cls, grid: list[list[int]], start: list[int], goal: list[int]) -> dict:
    pathfinder = pathfinder_cls(grid)
    return pathfinder.search(tuple(start), tuple(goal))


def median_runtime_ms(pathfinder_cls, grid: list[list[int]], start: list[int], goal: list[int]) -> float:
    timings = []
    for _ in range(3):
        start_time = time.perf_counter()
        run_once(pathfinder_cls, grid, start, goal)
        end_time = time.perf_counter()
        timings.append((end_time - start_time) * 1000.0)
    return statistics.median(timings)


def build_markdown_table(rows: list[dict]) -> str:
    lines = [
        "| Grid | A* Cost | A* Nodes | A* Time (ms) | UCS Cost | UCS Nodes | UCS Time (ms) | Node Ratio (UCS/A*) |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in rows:
        lines.append(
            "| {case_name} | {astar_cost:.6f} | {astar_nodes} | {astar_runtime_ms:.3f} | "
            "{ucs_cost:.6f} | {ucs_nodes} | {ucs_runtime_ms:.3f} | {node_ratio:.2f} |".format(**row)
        )
    return "\n".join(lines)


def write_csv(rows: list[dict]) -> None:
    with RESULTS_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["case_name", "algorithm", "total_cost", "nodes_expanded", "runtime_ms"])
        for row in rows:
            writer.writerow(
                [
                    row["case_name"],
                    "astar",
                    f"{row['astar_cost']:.6f}",
                    row["astar_nodes"],
                    f"{row['astar_runtime_ms']:.3f}",
                ]
            )
            writer.writerow(
                [
                    row["case_name"],
                    "ucs",
                    f"{row['ucs_cost']:.6f}",
                    row["ucs_nodes"],
                    f"{row['ucs_runtime_ms']:.3f}",
                ]
            )


def main() -> int:
    benchmark_rows = []

    try:
        for case in BENCHMARK_CASES:
            astar_result = run_once(AStarPathfinder, case["grid"], case["start"], case["goal"])
            ucs_result = run_once(UCSPathfinder, case["grid"], case["start"], case["goal"])

            astar_cost = float(astar_result["metrics"]["total_cost"])
            ucs_cost = float(ucs_result["metrics"]["total_cost"])
            astar_nodes = int(astar_result["metrics"]["nodes_expanded"])
            ucs_nodes = int(ucs_result["metrics"]["nodes_expanded"])
            astar_runtime_ms = median_runtime_ms(AStarPathfinder, case["grid"], case["start"], case["goal"])
            ucs_runtime_ms = median_runtime_ms(UCSPathfinder, case["grid"], case["start"], case["goal"])

            assert math.isclose(
                astar_cost, ucs_cost, rel_tol=1e-6, abs_tol=1e-6
            ), (
                f"Cost mismatch in case '{case['name']}': "
                f"A*={astar_cost}, UCS={ucs_cost}"
            )
            assert astar_nodes <= ucs_nodes, (
                f"Node expansion ordering violated in case '{case['name']}': "
                f"A*={astar_nodes}, UCS={ucs_nodes}"
            )

            node_ratio = float("inf") if astar_nodes == 0 else ucs_nodes / astar_nodes
            benchmark_rows.append(
                {
                    "case_name": case["name"],
                    "astar_cost": astar_cost,
                    "astar_nodes": astar_nodes,
                    "astar_runtime_ms": astar_runtime_ms,
                    "ucs_cost": ucs_cost,
                    "ucs_nodes": ucs_nodes,
                    "ucs_runtime_ms": ucs_runtime_ms,
                    "node_ratio": node_ratio,
                }
            )
    except AssertionError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    write_csv(benchmark_rows)
    markdown_table = build_markdown_table(benchmark_rows)
    RESULTS_MD.write_text(markdown_table + "\n", encoding="utf-8")
    print(markdown_table)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
