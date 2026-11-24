import argparse
from subprocess import CalledProcessError
from typing import Any
from unittest.mock import Mock

import pytest
import review

HEAD_SHA = "1" * 40


def start_args(*, automatic: bool = True, head_sha: str = HEAD_SHA) -> argparse.Namespace:
    return argparse.Namespace(
        pr=42,
        repo="Arize-ai/phoenix",
        head_sha=head_sha,
        automatic=automatic,
        requested_by="contributor",
        dry_run=False,
        budget_cents=1000,
    )


@pytest.fixture
def ready_pr() -> dict[str, Any]:
    return {
        "number": 42,
        "state": "OPEN",
        "isDraft": False,
        "labels": [],
        "headRefOid": HEAD_SHA,
        "isCrossRepository": True,
    }


@pytest.fixture
def github_and_session(monkeypatch: pytest.MonkeyPatch, ready_pr: dict[str, Any]) -> Mock:
    calls = Mock()
    calls.read_pr.return_value = ready_pr
    calls.read_repo_permission.return_value = "read"
    calls.scan_admission.return_value = None
    calls.read_factory_login.return_value = "factory[bot]"
    calls.create_app_token.return_value.refresh.return_value = "app-token"
    calls.start_session.return_value = "session"
    calls.post_status_comment.return_value = 123
    for name in (
        "read_pr",
        "read_repo_permission",
        "scan_admission",
        "read_factory_login",
        "create_app_token",
        "start_session",
        "post_status_comment",
        "run_gh",
        "write_github_outputs",
        "set_verdict_label",
        "comment_on_pr",
    ):
        monkeypatch.setattr(review, name, getattr(calls, name))
    monkeypatch.setattr(review.anthropic, "Anthropic", Mock())
    return calls


def test_automatic_review_screens_and_labels_a_ready_fork(github_and_session: Mock) -> None:
    review.run_start(args=start_args())

    github_and_session.read_repo_permission.assert_not_called()
    names = [call[0] for call in github_and_session.mock_calls]
    assert names.index("scan_admission") < names.index("run_gh") < names.index("start_session")
    github_and_session.run_gh.assert_called_once_with(
        "api",
        "--method",
        "POST",
        "repos/{owner}/{repo}/issues/42/labels",
        "--raw-field",
        "labels[]=factory-review",
        "--silent",
    )
    assert github_and_session.start_session.call_args.kwargs["pr"]["headRefOid"] == HEAD_SHA
    assert github_and_session.write_github_outputs.call_args.kwargs["started"] == "true"


@pytest.mark.parametrize(
    "change",
    [
        {"state": "CLOSED"},
        {"isDraft": True},
        {"labels": [{"name": "factory-review"}]},
        {"labels": [{"name": "factory-approved"}]},
    ],
)
def test_automatic_review_skips_unready_and_reviewed_prs(
    github_and_session: Mock, ready_pr: dict[str, Any], change: dict[str, Any]
) -> None:
    ready_pr.update(change)
    review.run_start(args=start_args())

    github_and_session.scan_admission.assert_not_called()
    github_and_session.run_gh.assert_not_called()
    github_and_session.start_session.assert_not_called()


def test_automatic_review_blocks_a_stale_event(github_and_session: Mock) -> None:
    review.run_start(args=start_args(head_sha="2" * 40))

    github_and_session.scan_admission.assert_not_called()
    github_and_session.run_gh.assert_not_called()
    github_and_session.start_session.assert_not_called()


def test_automatic_review_respects_admission_rejection(github_and_session: Mock) -> None:
    github_and_session.scan_admission.return_value = "admission rejected the PR"
    review.run_start(args=start_args())

    github_and_session.scan_admission.assert_called_once()
    github_and_session.run_gh.assert_not_called()
    github_and_session.start_session.assert_not_called()
    github_and_session.write_github_outputs.assert_called_once_with(started="false")


def test_automatic_review_yields_to_a_manual_request_during_admission(
    github_and_session: Mock, ready_pr: dict[str, Any]
) -> None:
    github_and_session.read_pr.side_effect = [
        ready_pr,
        {**ready_pr, "labels": [{"name": "factory-review"}]},
    ]
    review.run_start(args=start_args())

    github_and_session.run_gh.assert_not_called()
    github_and_session.start_session.assert_not_called()


def test_failed_automatic_start_releases_label(github_and_session: Mock) -> None:
    github_and_session.start_session.side_effect = CalledProcessError(1, ["start"])
    with pytest.raises(CalledProcessError):
        review.run_start(args=start_args())

    label_add, label_remove = github_and_session.run_gh.call_args_list
    assert label_add.args[:3] == ("api", "--method", "POST")
    assert label_remove.args == ("pr", "edit", "42", "--remove-label", "factory-review")


def test_manual_review_still_requires_write_access(github_and_session: Mock) -> None:
    review.run_start(args=start_args(automatic=False))

    github_and_session.read_repo_permission.assert_called_once_with(login="contributor")
    github_and_session.scan_admission.assert_not_called()
    github_and_session.start_session.assert_not_called()
    assert "needs write access" in github_and_session.comment_on_pr.call_args.kwargs["body"]
