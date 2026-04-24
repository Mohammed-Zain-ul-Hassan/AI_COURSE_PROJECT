import math
from enum import Enum

Coordinate = tuple[int, int]


class Algorithm(str, Enum):
    astar = "astar"
    ucs = "ucs"


class CellType(str, Enum):
    free = "free"
    smoke = "smoke"
    debris = "debris"
    wall = "wall"


CELL_COSTS = {
    0: 1,       # Free airspace
    1: 5,       # Smoke
    2: 10,      # Debris
    3: math.inf,  # Fire / Building (impassable)
}
