from pydantic import BaseModel, field_validator

from .common import Coordinate


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
        expected_row_length = len(v[0])
        for row_index, row in enumerate(v):
            if len(row) != expected_row_length:
                raise ValueError(
                    "grid rows must all have the same length "
                    f"(expected {expected_row_length}, got {len(row)} at row {row_index})"
                )
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
