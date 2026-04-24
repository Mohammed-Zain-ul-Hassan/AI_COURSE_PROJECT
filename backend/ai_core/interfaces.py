def a_star_search(grid, start, goal, allow_diagonal=True, hazard_cost=None) -> dict:
    """
    Contract for A* search implementations.

    Expected return keys:
    - path
    - cost
    - nodes_expanded
    - explored_sequence
    - success
    """
    raise NotImplementedError


def uniform_cost_search(grid, start, goal, allow_diagonal=True, hazard_cost=None) -> dict:
    """
    Contract for Uniform Cost Search implementations.

    Expected return keys:
    - path
    - cost
    - nodes_expanded
    - explored_sequence
    - success
    """
    raise NotImplementedError


class CSPMissionPlanner:
    """
    Contract for CSP mission planners.

    solve() returns a dict matching MissionCSPResponse.
    """

    def __init__(self, *args, **kwargs):
        raise NotImplementedError

    def solve(self) -> dict:
        raise NotImplementedError
