import argparse
from types import ModuleType, SimpleNamespace
from typing import Any
from unittest.mock import Mock

import deploy as preview_deploy
import pytest

WORKSPACE_ID = "11111111-2222-4333-8444-555555555555"


@pytest.fixture
def preview(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    monkeypatch.setenv("RAILWAY_WORKSPACE_ID", WORKSPACE_ID)
    monkeypatch.setenv("GH_REPO", "Arize-ai/phoenix")
    return preview_deploy


def test_cleanup_ignores_matching_name_without_ownership_marker(
    preview: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    railway = Mock()
    monkeypatch.setattr(preview, "railway", railway)
    monkeypatch.setattr(preview, "preview_wanted", lambda pr: False)
    monkeypatch.setattr(
        preview,
        "list_workspace_projects",
        lambda: [
            {
                "id": "unowned",
                "name": "phoenix-preview-pr-17",
                "description": "",
                "workspaceId": WORKSPACE_ID,
            },
            {
                "id": "other-workspace",
                "name": "phoenix-preview-pr-17",
                "description": "factory-preview:Arize-ai/phoenix#17",
                "workspaceId": "other-workspace",
            },
        ],
    )

    assert preview.run_cleanup(argparse.Namespace(pr=17)) == 0
    railway.assert_not_called()


def test_cleanup_rechecks_label_after_resolving_project(
    preview: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    railway = Mock()
    monkeypatch.setattr(preview, "railway", railway)
    monkeypatch.setattr(preview, "preview_wanted", Mock(side_effect=[False, True]))
    monkeypatch.setattr(
        preview, "find_project", lambda pr: preview.PreviewProject("owned", "production")
    )

    assert preview.run_cleanup(argparse.Namespace(pr=17)) == 0
    railway.assert_not_called()


def test_comparison_links_each_engine_and_reports_seed_failures(preview: ModuleType) -> None:
    def result(name: str, outcome: str = "preview: seed finished") -> Any:
        return preview.PreviewResult(name, f"https://{name}.example.com", "SUCCESS", outcome, "")

    results = [
        result("base-sqlite"),
        result("base-postgres", "preview: seed failed with exit 1"),
        result("head-sqlite"),
        result("head-postgres"),
    ]
    comment = preview.format_comment(
        args=SimpleNamespace(
            base_sha="bbbbbbbb", head_sha="cccccccc", run_url="run", seed="1 line"
        ),
        results=results,
        project=preview.PreviewProject("owned", "production"),
        grafana="grafana.example.com",
        mcp="mcp.example.com",
    )

    sqlite, postgres = (
        line for line in comment.splitlines() if line.startswith(("| sqlite", "| postgres"))
    )
    assert "base-sqlite.example.com" in sqlite and "head-sqlite.example.com" in sqlite
    assert "base-postgres.example.com) · success, seed failed with exit 1" in postgres
    assert "head-postgres.example.com) · success, seed finished" in postgres
    assert [result.succeeded for result in results] == [True, False, True, True]


def test_wait_for_deployment_ignores_success_for_an_older_image(
    preview: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        preview,
        "list_deployments",
        lambda **kwargs: [
            {"id": "older", "status": "SUCCESS", "meta": {"image": "old"}},
            {"id": "new", "status": "FAILED", "meta": {"image": "expected"}},
        ],
    )

    assert preview.wait_for_deployment(
        environment_id="env", service_id="service", image="expected"
    ) == (
        "new",
        "FAILED",
    )
