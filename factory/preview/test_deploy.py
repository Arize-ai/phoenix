from types import SimpleNamespace
from typing import Any

import deploy
import preview_project
import pytest
from settings import PreviewSettings


def test_comparison_links_each_engine_and_reports_seed_failures() -> None:
    def result(name: str, outcome: str = "preview: seed finished") -> Any:
        return deploy.PreviewResult(
            f"phoenix-{name}", f"https://{name}.example.com", "SUCCESS", outcome, ""
        )

    results = [
        result("base-sqlite"),
        result("base-postgres", "preview: seed failed with exit 1"),
        result("head-sqlite"),
        result("head-postgres"),
    ]
    comment = deploy.format_comment(
        args=SimpleNamespace(
            base_sha="bbbbbbbb", head_sha="cccccccc", run_url="run", seed="1 line"
        ),
        results=results,
        settings=PreviewSettings(),
        project=deploy.PreviewProject("owned", "production"),
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
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        deploy,
        "list_deployments",
        lambda **kwargs: [
            {"id": "older", "status": "SUCCESS", "meta": {"image": "old"}},
            {"id": "new", "status": "FAILED", "meta": {"image": "expected"}},
        ],
    )

    assert deploy.wait_for_deployment(
        environment_id="env", service_id="service", image="expected"
    ) == (
        "new",
        "FAILED",
    )


def test_comment_omits_unselected_revisions_and_engines() -> None:
    comment = deploy.format_comment(
        args=SimpleNamespace(
            base_sha="bbbbbbbb", head_sha="cccccccc", run_url="run", seed="1 line"
        ),
        results=[
            deploy.PreviewResult(
                "phoenix-head-postgres",
                "https://head.example.com",
                "SUCCESS",
                "preview: seed finished",
                "",
            )
        ],
        settings=PreviewSettings(include_baseline=False, database="postgres"),
        project=deploy.PreviewProject("owned", "production"),
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
def test_plan_rejects_unrelated_destructive_changes(summary: str, kind: str) -> None:
    with pytest.raises(deploy.RailwayError, match="outside the disabled previews"):
        deploy.allow_preview_removals(
            settings=PreviewSettings(include_baseline=False, database="sqlite"),
            changes=[{"summary": summary, "kind": kind, "severity": "destructive"}],
        )


def test_plan_allows_removing_disabled_instances_and_databases() -> None:
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
    assert deploy.allow_preview_removals(
        changes=changes, settings=PreviewSettings(include_baseline=False, database="sqlite")
    )


def test_deploy_skips_a_plan_for_outdated_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        preview_project,
        "run_gh",
        lambda *args: (
            '{"state":"OPEN","labels":[{"name":"factory-preview"}],'
            '"headRefOid":"current","body":"Preview database: sqlite"}'
        ),
    )
    assert deploy.preview_wanted(
        17, head_sha="current", settings=PreviewSettings(database="sqlite")
    )
    assert not deploy.preview_wanted(
        17, head_sha="current", settings=PreviewSettings(database="both")
    )
