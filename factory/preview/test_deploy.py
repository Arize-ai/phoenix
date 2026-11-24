import argparse
import json
from subprocess import CalledProcessError
from types import ModuleType, SimpleNamespace
from typing import Any
from unittest.mock import Mock

import deploy as preview_deploy
import pytest
from settings import PreviewSettings

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
    monkeypatch.setattr(preview, "find_owned_project", lambda pr: {"id": "owned"})

    assert preview.run_cleanup(argparse.Namespace(pr=17)) == 0
    railway.assert_not_called()


def test_comparison_links_each_engine_and_reports_seed_failures(preview: ModuleType) -> None:
    def result(name: str, outcome: str = "preview: seed finished") -> Any:
        return preview.PreviewResult(
            f"phoenix-{name}", f"https://{name}.example.com", "SUCCESS", outcome, ""
        )

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
        settings=PreviewSettings(),
        project=preview.PreviewProject("owned", "production"),
        grafana="grafana.example.com",
        mcp="mcp.example.com",
    )

    sqlite, postgres = (
        line for line in comment.splitlines() if line.startswith(("| sqlite", "| postgres"))
    )
    assert sqlite == (
        "| sqlite | [Open](https://base-sqlite.example.com) · success, seed finished "
        "| [Open](https://head-sqlite.example.com) · success, seed finished |"
    )
    assert postgres == (
        "| postgres | [Open](https://base-postgres.example.com) · success, seed failed with exit 1 "
        "| [Open](https://head-postgres.example.com) · success, seed finished |"
    )
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


def test_comment_omits_unselected_revisions_and_engines(preview: ModuleType) -> None:
    comment = preview.format_comment(
        args=SimpleNamespace(
            base_sha="bbbbbbbb", head_sha="cccccccc", run_url="run", seed="1 line"
        ),
        results=[
            preview.PreviewResult(
                "phoenix-head-postgres",
                "https://head.example.com",
                "SUCCESS",
                "preview: seed finished",
                "",
            )
        ],
        settings=PreviewSettings(include_baseline=False, database="postgres"),
        project=preview.PreviewProject("owned", "production"),
        grafana="grafana.example.com",
        mcp="mcp.example.com",
    )

    assert "Baseline: off. Database: postgres." in comment
    assert "| postgres | [Open](https://head.example.com)" in comment
    assert "Target commit" not in comment
    assert "bbbbbbb" not in comment
    assert "| sqlite" not in comment


@pytest.mark.parametrize(
    ("summary", "kind"),
    [
        ("Delete volume lgtm-data", "resource.delete"),
        ("Delete service phoenix-head-sqlite", "resource.delete"),
        ("Delete database phoenix-head-postgres-db", "variable.delete"),
    ],
)
def test_plan_rejects_unrelated_destructive_changes(
    preview: ModuleType, summary: str, kind: str
) -> None:
    with pytest.raises(preview.RailwayError, match="outside the disabled previews"):
        preview.allow_preview_removals(
            settings=PreviewSettings(include_baseline=False, database="sqlite"),
            changes=[{"summary": summary, "kind": kind, "severity": "destructive"}],
        )


def test_plan_allows_removing_disabled_instances_and_databases(preview: ModuleType) -> None:
    changes = [
        {"summary": summary, "kind": "resource.delete", "severity": "destructive"}
        for summary in (
            "Delete service phoenix-base-sqlite",
            "Delete service phoenix-base-postgres",
            "Delete database phoenix-base-postgres-db",
            "Delete service phoenix-head-postgres",
            "Delete database phoenix-head-postgres-db",
        )
    ]
    assert preview.allow_preview_removals(
        changes=changes, settings=PreviewSettings(include_baseline=False, database="sqlite")
    )


def test_deploy_skips_a_plan_for_outdated_settings(
    preview: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        preview,
        "run_gh",
        lambda *args: (
            '{"state":"OPEN","labels":[{"name":"factory-preview"}],'
            '"headRefOid":"current","body":"Preview database: sqlite"}'
        ),
    )
    assert preview.preview_wanted(
        17, head_sha="current", settings=PreviewSettings(database="sqlite")
    )
    assert not preview.preview_wanted(
        17, head_sha="current", settings=PreviewSettings(database="both")
    )


def owned_project(*, pr_number: int) -> dict[str, Any]:
    return {
        "id": f"project-{pr_number}",
        "workspaceId": WORKSPACE_ID,
        "name": f"phoenix-preview-pr-{pr_number}",
        "description": f"factory-preview:Arize-ai/phoenix#{pr_number}",
        "environments": {"edges": []},
    }


def test_sweep_finds_abandoned_projects_without_a_deployment(
    preview: ModuleType, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        preview,
        "list_workspace_projects",
        lambda: [
            owned_project(pr_number=17),
            {**owned_project(pr_number=18), "description": "some other project"},
            owned_project(pr_number=19),
            {**owned_project(pr_number=20), "workspaceId": "different-workspace"},
            owned_project(pr_number=21),
        ],
    )
    wanted = Mock(side_effect=[True, CalledProcessError(1, ["gh"]), False])
    monkeypatch.setattr(preview, "preview_wanted", wanted)

    assert preview.run_discover_cleanup(argparse.Namespace()) == 0
    captured = capsys.readouterr()
    assert json.loads(captured.out) == [21]
    assert [call.args[0] for call in wanted.call_args_list] == [17, 19, 21]
    assert "Could not verify PR #19" in captured.err


def test_cleanup_retries_interrupted_project_deletion(
    preview: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(preview, "preview_wanted", lambda pr: False)
    monkeypatch.setattr(preview, "list_workspace_projects", lambda: [owned_project(pr_number=17)])
    railway = Mock(side_effect=[preview.RailwayError("connection failed"), {"projectDelete": True}])
    monkeypatch.setattr(preview, "railway", railway)
    comment = Mock()
    monkeypatch.setattr(preview, "upsert_comment", comment)

    with pytest.raises(preview.RailwayError, match="connection failed"):
        preview.run_cleanup(argparse.Namespace(pr=17))
    comment.assert_not_called()

    assert preview.run_cleanup(argparse.Namespace(pr=17)) == 0
    assert [call.kwargs["id"] for call in railway.call_args_list] == ["project-17", "project-17"]
    comment.assert_called_once_with(
        pr_number=17, body="The Factory Preview Railway project was removed."
    )
