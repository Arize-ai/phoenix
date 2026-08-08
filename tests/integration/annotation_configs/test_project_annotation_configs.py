# pyright: reportPrivateUsage=false
from __future__ import annotations

from secrets import token_hex
from typing import Any

import httpx
import pytest

from .._helpers import _VIEWER, _AppInfo, _GetUser, _httpx_client


def _create_project(client: httpx.Client) -> dict[str, Any]:
    resp = client.post("v1/projects", json={"name": f"proj_{token_hex(8)}"})
    resp.raise_for_status()
    data: dict[str, Any] = resp.json()["data"]
    return data


def _create_config(client: httpx.Client) -> dict[str, Any]:
    resp = client.post(
        "v1/annotation_configs",
        json={
            "name": f"cfg_{token_hex(8)}",
            "type": "CATEGORICAL",
            "description": "Human review rubric",
            "optimization_direction": "MAXIMIZE",
            "values": [
                {"label": "helpful", "score": 1},
                {"label": "not_helpful", "score": 0},
            ],
        },
    )
    resp.raise_for_status()
    data: dict[str, Any] = resp.json()["data"]
    return data


class TestProjectAnnotationConfigs:
    """Integration tests for the project ↔ annotation-config membership REST endpoints."""

    def test_assign_is_idempotent_and_lists(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        project = _create_project(client)
        config = _create_config(client)
        config_id = config["id"]
        base = f"v1/projects/{project['id']}/annotation_configs"
        item = f"{base}/{config_id}"

        # Assign returns 200 and echoes the assigned config.
        resp = client.put(item)
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["id"] == config_id
        assert resp.json()["data"]["name"] == config["name"]
        assert resp.json()["data"]["type"] == "CATEGORICAL"

        # Re-assigning an already-assigned config is an idempotent no-op that still returns 200.
        resp = client.put(item)
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["id"] == config_id

        # The config now shows up in the project's list.
        resp = client.get(base)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert [item["id"] for item in body["data"]] == [config_id]
        assert body["next_cursor"] is None

    def test_assign_by_name(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        project = _create_project(client)
        config = _create_config(client)

        # Both identifiers accept a name as well as a GlobalID.
        item = f"v1/projects/{project['name']}/annotation_configs/{config['name']}"
        resp = client.put(item)
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["id"] == config["id"]

    def test_unassign(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        project = _create_project(client)
        config = _create_config(client)
        config_id = config["id"]
        base = f"v1/projects/{project['id']}/annotation_configs"
        item = f"{base}/{config_id}"

        client.put(item).raise_for_status()

        # Unassign removes the link without deleting the config.
        resp = client.delete(item)
        assert resp.status_code == 204, resp.text
        assert client.get(base).json()["data"] == []
        # The underlying config still exists.
        assert client.get(f"v1/annotation_configs/{config_id}").status_code == 200

    def test_unassign_missing_is_idempotent(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        project = _create_project(client)
        config = _create_config(client)

        # Unassigning a config that was never assigned is a no-op (204).
        item = f"v1/projects/{project['id']}/annotation_configs/{config['id']}"
        resp = client.delete(item)
        assert resp.status_code == 204, resp.text

    def test_bulk_replace_adds_and_removes(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        project = _create_project(client)
        base = f"v1/projects/{project['id']}/annotation_configs"
        config_a = _create_config(client)
        config_b = _create_config(client)
        config_c = _create_config(client)

        # Start with A assigned.
        client.put(f"{base}/{config_a['id']}").raise_for_status()

        # Replace the set with {B, C}: A is removed, B and C are added.
        body = {"annotation_config_ids": [config_b["id"], config_c["id"]]}
        resp = client.put(base, json=body)
        assert resp.status_code == 200, resp.text
        assert {item["id"] for item in resp.json()["data"]} == {config_b["id"], config_c["id"]}

        resp = client.get(base)
        assert {item["id"] for item in resp.json()["data"]} == {config_b["id"], config_c["id"]}

        # An empty array clears all assignments.
        resp = client.put(base, json={"annotation_config_ids": []})
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"] == []
        assert client.get(base).json()["data"] == []

    def test_assign_nonexistent_project_returns_404(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        config = _create_config(client)
        item = f"v1/projects/{token_hex(8)}/annotation_configs/{config['id']}"
        resp = client.put(item)
        assert resp.status_code == 404, resp.text

    def test_assign_nonexistent_config_returns_404(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        project = _create_project(client)
        item = f"v1/projects/{project['id']}/annotation_configs/{token_hex(8)}"
        resp = client.put(item)
        assert resp.status_code == 404, resp.text

    def test_bulk_replace_unknown_config_returns_422(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app, _app.admin_secret)
        project = _create_project(client)
        base = f"v1/projects/{project['id']}/annotation_configs"

        # A malformed (non-GlobalID) value in the body is a 422.
        resp = client.put(base, json={"annotation_config_ids": ["not-a-global-id"]})
        assert resp.status_code == 422, resp.text

        # A well-formed GlobalID that refers to a nonexistent config is also a 422.
        config = _create_config(client)
        client.delete(f"v1/annotation_configs/{config['id']}").raise_for_status()
        resp = client.put(base, json={"annotation_config_ids": [config["id"]]})
        assert resp.status_code == 422, resp.text

    @pytest.mark.parametrize(
        "method",
        ["put_single", "delete_single", "put_bulk"],
    )
    def test_viewer_is_forbidden_from_writes(
        self,
        method: str,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        admin = _httpx_client(_app, _app.admin_secret)
        project = _create_project(admin)
        config = _create_config(admin)

        viewer = _get_user(_app, _VIEWER)
        viewer_client = _httpx_client(_app, viewer)

        base = f"v1/projects/{project['id']}/annotation_configs"
        if method == "put_single":
            resp = viewer_client.put(f"{base}/{config['id']}")
        elif method == "delete_single":
            resp = viewer_client.delete(f"{base}/{config['id']}")
        else:
            resp = viewer_client.put(base, json={"annotation_config_ids": [config["id"]]})
        assert resp.status_code == 403, resp.text
