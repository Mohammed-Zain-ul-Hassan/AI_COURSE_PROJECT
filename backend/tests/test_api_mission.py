class TestMissionAPI:
    def test_mission_valid_minimal_payload(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[0, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
                "base": [0, 0],
                "victims": [
                    {"id": "V1", "location": [3, 3], "priority": 1},
                    {"id": "V2", "location": [2, 2], "priority": 2},
                ],
                "battery_limit": 50,
            },
        )
        body = response.json()
        assert response.status_code == 200
        assert body["success"] is False
        assert "STUB" in body["message"]

    def test_mission_invalid_priority(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[0, 0], [0, 0]],
                "base": [0, 0],
                "victims": [{"id": "V1", "location": [1, 1], "priority": 5}],
                "battery_limit": 10,
            },
        )
        assert response.status_code == 422

    def test_mission_invalid_priority_zero(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[0, 0], [0, 0]],
                "base": [0, 0],
                "victims": [{"id": "V1", "location": [1, 1], "priority": 0}],
                "battery_limit": 10,
            },
        )
        assert response.status_code == 422

    def test_mission_duplicate_victim_ids(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[0, 0], [0, 0]],
                "base": [0, 0],
                "victims": [
                    {"id": "V1", "location": [0, 1], "priority": 1},
                    {"id": "V1", "location": [1, 0], "priority": 2},
                ],
                "battery_limit": 10,
            },
        )
        assert response.status_code == 422

    def test_mission_victim_on_wall(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[0, 0], [0, 3]],
                "base": [0, 0],
                "victims": [{"id": "V1", "location": [1, 1], "priority": 1}],
                "battery_limit": 10,
            },
        )
        assert response.status_code == 422

    def test_mission_base_on_wall(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[3, 0], [0, 0]],
                "base": [0, 0],
                "victims": [{"id": "V1", "location": [1, 1], "priority": 1}],
                "battery_limit": 10,
            },
        )
        assert response.status_code == 422

    def test_mission_base_out_of_bounds(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[0, 0], [0, 0]],
                "base": [99, 99],
                "victims": [{"id": "V1", "location": [1, 1], "priority": 1}],
                "battery_limit": 10,
            },
        )
        assert response.status_code == 422

    def test_mission_empty_victims(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[0, 0], [0, 0]],
                "base": [0, 0],
                "victims": [],
                "battery_limit": 10,
            },
        )
        assert response.status_code == 422

    def test_mission_zero_battery(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[0, 0], [0, 0]],
                "base": [0, 0],
                "victims": [{"id": "V1", "location": [1, 1], "priority": 1}],
                "battery_limit": 0,
            },
        )
        assert response.status_code == 422

    def test_mission_response_contains_all_required_fields(self, client):
        response = client.post(
            "/solve-mission-csp",
            json={
                "grid": [[0, 0], [0, 0]],
                "base": [0, 0],
                "victims": [{"id": "V1", "location": [1, 1], "priority": 1}],
                "battery_limit": 10,
            },
        )
        body = response.json()
        assert response.status_code == 200
        for key in [
            "success",
            "message",
            "rescue_order",
            "skipped_victims",
            "legs",
            "full_path",
            "total_cost",
            "battery_used",
            "battery_remaining",
            "solver_stats",
        ]:
            assert key in body
