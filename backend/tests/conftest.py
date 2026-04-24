import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def simple_open_grid():
    return [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ]


@pytest.fixture
def canonical_4x4_grid():
    return [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 2, 0],
        [0, 0, 0, 0],
    ]


@pytest.fixture
def grid_with_wall_diagonal():
    return [
        [0, 3, 0],
        [0, 0, 0],
        [0, 3, 0],
    ]


@pytest.fixture
def narrow_corridor_grid():
    return [[0, 0, 0, 0, 0]]
