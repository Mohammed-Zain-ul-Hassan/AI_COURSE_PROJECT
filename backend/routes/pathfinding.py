from fastapi import APIRouter, HTTPException

from backend.ai_core.pathfinding import AStarPathfinder, UCSPathfinder
from backend.schemas.pathfinding import Metrics, PathRequest, PathResponse

router = APIRouter()


@router.post("/calculate-path", response_model=PathResponse)
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
