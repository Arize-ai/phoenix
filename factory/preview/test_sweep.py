import argparse
import json
from subprocess import CalledProcessError
from typing import Any
from unittest.mock import Mock

import preview_project
import pytest
import sweep

WORKSPACE_ID = "11111111-2222-4333-8444-555555555555"


@pytest.fixture(autouse=True)
def set_workspace(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RAILWAY_WORKSPACE_ID", WORKSPACE_ID)
    monkeypatch.setenv("GH_REPO", "Arize-ai/phoenix")


def test_cleanup_ignores_matching_name_without_ownership_marker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    railway = Mock()
    monkeypatch.setattr(sweep, "railway", railway)
    monkeypatch.setattr(sweep, "preview_wanted", lambda pr: False)
    monkeypatch.setattr(
        preview_project,
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

    assert sweep.run_cleanup(argparse.Namespace(pr=17)) == 0
    railway.assert_not_called()


def test_cleanup_rechecks_label_after_resolving_project(monkeypatch: pytest.MonkeyPatch) -> None:
    railway = Mock()
    monkeypatch.setattr(sweep, "railway", railway)
    monkeypatch.setattr(sweep, "preview_wanted", Mock(side_effect=[False, True]))
    monkeypatch.setattr(sweep, "find_owned_project", lambda pr: {"id": "owned"})

    assert sweep.run_cleanup(argparse.Namespace(pr=17)) == 0
    railway.assert_not_called()


def owned_project(*, pr_number: int) -> dict[str, Any]:
    return {
        "id": f"project-{pr_number}",
        "workspaceId": WORKSPACE_ID,
        "name": f"phoenix-preview-pr-{pr_number}",
        "description": f"factory-preview:Arize-ai/phoenix#{pr_number}",
        "environments": {"edges": []},
    }


def test_sweep_finds_abandoned_projects_without_a_deployment(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        sweep,
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
    monkeypatch.setattr(sweep, "preview_wanted", wanted)

    assert sweep.run_discover_cleanup(argparse.Namespace()) == 0
    captured = capsys.readouterr()
    assert json.loads(captured.out) == [21]
    assert [call.args[0] for call in wanted.call_args_list] == [17, 19, 21]
    assert "Could not verify PR #19" in captured.err


def test_cleanup_retries_interrupted_project_deletion(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sweep, "preview_wanted", lambda pr: False)
    monkeypatch.setattr(
        preview_project, "list_workspace_projects", lambda: [owned_project(pr_number=17)]
    )
    railway = Mock(
        side_effect=[preview_project.RailwayError("connection failed"), {"projectDelete": True}]
    )
    monkeypatch.setattr(sweep, "railway", railway)
    comment = Mock()
    monkeypatch.setattr(sweep, "upsert_comment", comment)

    with pytest.raises(preview_project.RailwayError, match="connection failed"):
        sweep.run_cleanup(argparse.Namespace(pr=17))
    comment.assert_not_called()

    assert sweep.run_cleanup(argparse.Namespace(pr=17)) == 0
    assert [call.kwargs["id"] for call in railway.call_args_list] == ["project-17", "project-17"]
    comment.assert_called_once_with(
        pr_number=17, body="The Factory Preview Railway project was removed."
    )
