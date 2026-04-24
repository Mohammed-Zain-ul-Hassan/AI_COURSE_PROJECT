class TestPathfindingAPI:
    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_calculate_path_astar_success(self, client, canonical_4x4_grid):
        response = client.post(
            "/calculate-path",
            json={
                "grid": canonical_4x4_grid,
                "start": [0, 0],
                "goal": [3, 3],
                "algorithm": "astar",
            },
        )
        body = response.json()
        assert response.status_code == 200
        assert "explored_sequence" in body
        assert "optimal_path" in body
        assert "metrics" in body

    def test_calculate_path_ucs_success(self, client):
        response = client.post(
            "/calculate-path",
            json={
                "grid": [[0, 0], [0, 0]],
                "start": [0, 0],
                "goal": [1, 1],
                "algorithm": "ucs",
            },
        )
        assert response.status_code == 200

    def test_calculate_path_invalid_start(self, client):
        response = client.post(
            "/calculate-path",
            json={
                "grid": [[0, 0], [0, 0]],
                "start": [9, 9],
                "goal": [1, 1],
                "algorithm": "astar",
            },
        )
        assert response.status_code == 400

    def test_calculate_path_invalid_goal(self, client):
        response = client.post(
            "/calculate-path",
            json={
                "grid": [[0, 0], [0, 0]],
                "start": [0, 0],
                "goal": [9, 9],
                "algorithm": "astar",
            },
        )
        assert response.status_code == 400

    def test_calculate_path_start_on_wall(self, client):
        response = client.post(
            "/calculate-path",
            json={
                "grid": [[3, 0], [0, 0]],
                "start": [0, 0],
                "goal": [1, 1],
                "algorithm": "astar",
            },
        )
        assert response.status_code == 400

    def test_calculate_path_goal_on_wall(self, client):
        response = client.post(
            "/calculate-path",
            json={
                "grid": [[0, 0], [0, 3]],
                "start": [0, 0],
                "goal": [1, 1],
                "algorithm": "astar",
            },
        )
        assert response.status_code == 400

    def test_calculate_path_unknown_algorithm(self, client):
        response = client.post(
            "/calculate-path",
            json={
                "grid": [[0, 0], [0, 0]],
                "start": [0, 0],
                "goal": [1, 1],
                "algorithm": "bfs",
            },
        )
        assert response.status_code == 400

    def test_calculate_path_malformed_request(self, client):
        response = client.post("/calculate-path", json={})
        assert response.status_code == 422

    def test_calculate_path_ragged_grid(self, client):
        response = client.post(
            "/calculate-path",
            json={
                "grid": [[0, 0, 0], [0]],
                "start": [0, 0],
                "goal": [1, 0],
                "algorithm": "astar",
            },
        )
        assert response.status_code == 422
