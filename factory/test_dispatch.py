import argparse
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock

import anthropic
import dispatch
import pytest

REPO = "Arize-ai/phoenix"


@pytest.fixture
def github(monkeypatch: pytest.MonkeyPatch) -> Mock:
    github = Mock()
    monkeypatch.setattr(dispatch, "run_gh", github)
    return github


def parent_response(*, number: int | None, body: str = "", repo: str = REPO) -> str:
    parent = (
        {"number": number, "body": body, "repository": {"nameWithOwner": repo}}
        if number is not None
        else None
    )
    return json.dumps({"data": {"repository": {"issue": {"parent": parent}}}})


@pytest.mark.parametrize(
    "body",
    [
        "Uses version-online-evals; no configuration here.",
        "Example:\n```text\nTarget branch: example\n```",
        "~~~\nTarget branch: example\n~~~",
        "    Target branch: example",
        "> Target branch: example",
        "- Target branch: example",
    ],
)
def test_parse_ignores_prose_and_examples(body: str) -> None:
    assert dispatch.parse_target_branch(body=body) is None


@pytest.mark.parametrize(
    "body",
    [
        "Target branch:",
        "Target branch: one two",
        "Target branch: `feature`",
        "Target branch: $(touch /tmp/untrusted)",
        "Target branch: feature;echo injected",
        "Target branch: feature\nTarget branch: other",
        "Target branch: feature\nTarget branch: feature",
        "Target branch feature",
        "target branch: feature",
    ],
)
def test_parse_rejects_malformed_or_duplicate_configuration(body: str) -> None:
    with pytest.raises(ValueError):
        dispatch.parse_target_branch(body=body)


def test_issue_override_does_not_read_parent(github: Mock) -> None:
    github.return_value = "{}"
    assert (
        dispatch.resolve_target_branch(
            repo=REPO, issue_number=10, body="Target branch: feature/own"
        )
        == "feature/own"
    )
    github.assert_called_once_with("api", f"repos/{REPO}/git/ref/heads/feature%2Fown")


def test_nearest_parent_overrides_grandparent(github: Mock) -> None:
    github.side_effect = [parent_response(number=20, body="Target branch: feature/parent"), "{}"]
    assert dispatch.resolve_target_branch(repo=REPO, issue_number=10, body="") == "feature/parent"
    assert github.call_count == 2
    assert "number=10" in github.call_args_list[0].args


def test_inherits_through_multiple_parents(github: Mock) -> None:
    github.side_effect = [
        parent_response(number=20, repo="Arize-ai/roadmap"),
        parent_response(number=30, body="Target branch: version-online-evals"),
        "{}",
    ]
    assert (
        dispatch.resolve_target_branch(repo=REPO, issue_number=10, body="- [ ] #30")
        == "version-online-evals"
    )
    assert "name=roadmap" in github.call_args_list[1].args
    assert github.call_args.args == ("api", f"repos/{REPO}/git/ref/heads/version-online-evals")


def test_uses_repository_default_after_ancestry(github: Mock) -> None:
    github.side_effect = [
        parent_response(number=20),
        parent_response(number=None),
        '{"defaultBranchRef":{"name":"develop"}}',
        "{}",
    ]
    assert dispatch.resolve_target_branch(repo=REPO, issue_number=10, body="") == "develop"
    assert github.call_args_list[-2].args == ("repo", "view", REPO, "--json", "defaultBranchRef")
    assert github.call_args.args == ("api", f"repos/{REPO}/git/ref/heads/develop")


def test_nonexistent_branch_does_not_fall_back(github: Mock) -> None:
    github.side_effect = subprocess.CalledProcessError(1, ["gh"], stderr="HTTP 404")
    with pytest.raises(ValueError, match="does not exist"):
        dispatch.resolve_target_branch(repo=REPO, issue_number=10, body="Target branch: missing")
    assert github.call_count == 1


@pytest.mark.parametrize("branch", ["feature..bad", "feature.lock", "feature/", "feature//bad"])
def test_invalid_git_ref_is_rejected_before_api(github: Mock, branch: str) -> None:
    with pytest.raises(ValueError, match="invalid target branch"):
        dispatch.resolve_target_branch(repo=REPO, issue_number=10, body=f"Target branch: {branch}")
    github.assert_not_called()


def test_invalid_parent_declaration_is_not_skipped(github: Mock) -> None:
    github.return_value = parent_response(number=20, body="Target branch: bad value")
    with pytest.raises(ValueError, match=f"{REPO}#20"):
        dispatch.resolve_target_branch(repo=REPO, issue_number=10, body="")
    assert github.call_count == 1


def test_parent_cycle_is_rejected(github: Mock) -> None:
    github.side_effect = [parent_response(number=20), parent_response(number=10)]
    with pytest.raises(ValueError, match="cycle"):
        dispatch.resolve_target_branch(repo=REPO, issue_number=10, body="")


def test_ancestry_is_bounded(github: Mock, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dispatch, "MAX_ISSUE_ANCESTRY", 2)
    github.side_effect = [parent_response(number=20), parent_response(number=30)]
    with pytest.raises(ValueError, match="ancestry exceeds"):
        dispatch.resolve_target_branch(repo=REPO, issue_number=10, body="")


def test_inaccessible_parent_does_not_fall_back(github: Mock) -> None:
    github.return_value = '{"data":{"repository":null}}'
    with pytest.raises(ValueError, match="cannot read parent"):
        dispatch.resolve_target_branch(repo=REPO, issue_number=10, body="")
    assert github.call_count == 1


def test_missing_default_branch_fails_clearly(github: Mock) -> None:
    github.side_effect = [parent_response(number=None), '{"defaultBranchRef":null}']
    with pytest.raises(ValueError, match="has no default branch"):
        dispatch.resolve_target_branch(repo=REPO, issue_number=10, body="")


@pytest.mark.parametrize("requester_permission", ["write", "read"])
def test_dry_run_preserves_admission_and_does_not_start_session(
    github: Mock,
    monkeypatch: pytest.MonkeyPatch,
    requester_permission: str,
) -> None:
    issue = {
        "number": 10,
        "state": "OPEN",
        "author": {"login": "maintainer"},
        "assignees": [],
        "labels": [{"name": "enhancement"}],
        "body": "Target branch: feature/own",
        "closedByPullRequestsReferences": [],
    }
    github.side_effect = [json.dumps(issue), "[]", requester_permission, "{}"]
    client_constructor = Mock(side_effect=AssertionError("dry run started a client"))
    monkeypatch.setattr(anthropic, "Anthropic", client_constructor)
    monkeypatch.delenv("FACTORY_GITHUB_LOGIN", raising=False)
    dispatch.run_start(
        args=argparse.Namespace(
            issue=10,
            repo=REPO,
            lane=None,
            requested_by="maintainer",
            dry_run=True,
        )
    )
    if requester_permission == "write":
        assert github.call_args.args == ("api", f"repos/{REPO}/git/ref/heads/feature%2Fown")
    else:
        assert github.call_count == 3
    client_constructor.assert_not_called()


@pytest.fixture
def session_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Mock:
    lock_path = tmp_path / "claude-lock.json"
    lock_path.write_text(
        json.dumps(
            {
                "resources": {
                    key: {"id": key}
                    for key in [
                        *dispatch.LANE_AGENT_LOCK_KEYS.values(),
                        dispatch.ENVIRONMENT_LOCK_KEY,
                        dispatch.VAULT_LOCK_KEY,
                        dispatch.GRAFANA_VAULT_LOCK_KEY,
                        dispatch.DATADOG_VAULT_LOCK_KEY,
                    ]
                }
            }
        )
    )
    monkeypatch.setattr(dispatch, "LOCK_FILE_PATH", lock_path)
    client = Mock()
    client.beta.sessions.create.return_value.id = "session-test"
    return client


@pytest.mark.parametrize("lane", ["bug", "feature", "docs"])
def test_target_propagates_to_session(session_client: Mock, lane: str) -> None:
    assert (
        dispatch.start_session(
            client=session_client,
            lane=lane,
            repo=REPO,
            issue_number=10,
            label_names=[],
            target_branch="feature/online-evals",
            snapshot={"body": "request"},
            github_token="test-token",
            git_author_name="factory",
            git_author_email="bot@example.com",
            budget_cents=100,
        )
        == "session-test"
    )
    request = session_client.beta.sessions.create.call_args.kwargs
    assert request["resources"][0]["checkout"] == {"type": "branch", "name": "feature/online-evals"}
    assert request["metadata"]["target_branch"] == "feature/online-evals"
    kickoff = request["initial_events"][0]["content"][0]["text"]
    assert 'Target branch: "feature/online-evals"' in kickoff
    assert "against `main`" not in request["initial_events"][1]["rubric"]["content"]


@pytest.mark.parametrize("missing_branch", [False, True])
def test_start_uses_screened_body_and_resolves_before_session(
    github: Mock,
    session_client: Mock,
    monkeypatch: pytest.MonkeyPatch,
    missing_branch: bool,
) -> None:
    issue: dict[str, Any] = {
        "number": 10,
        "state": "OPEN",
        "author": {"login": "maintainer"},
        "assignees": [],
        "labels": [{"name": "enhancement"}],
        "body": "Target branch: stale",
        "closedByPullRequestsReferences": [],
    }

    def read_github(*args: str, **kwargs: Any) -> str:
        if args[:2] == ("issue", "view"):
            return json.dumps(issue)
        if args[:2] == ("pr", "list"):
            return "[]"
        if args[0] == "api" and args[1].endswith("/permission"):
            return "write"
        if args[0] == "api" and "/git/ref/heads/" in args[1]:
            assert args[1].endswith("/screened")
            if missing_branch:
                raise subprocess.CalledProcessError(1, ["gh"], stderr="HTTP 404")
            return "{}"
        if args[:2] == ("api", "users/factory"):
            return "42"
        if args[0] == "api" and args[1].endswith("/comments"):
            return "100"
        raise AssertionError(args)

    def admit_issue(**kwargs: Any) -> None:
        kwargs["subject"]["_factory_snapshot"] = {"body": "Target branch: screened"}

    github.side_effect = read_github
    monkeypatch.setattr(dispatch, "scan_admission", admit_issue)
    monkeypatch.setattr(anthropic, "Anthropic", lambda: session_client)
    monkeypatch.setattr(
        dispatch, "create_app_token", lambda **kwargs: SimpleNamespace(refresh=lambda: "test-token")
    )
    monkeypatch.setenv("FACTORY_GITHUB_LOGIN", "factory")
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)
    args = argparse.Namespace(
        issue=10, repo=REPO, lane=None, requested_by="maintainer", dry_run=False, budget_cents=100
    )
    if missing_branch:
        with pytest.raises(SystemExit, match="Cannot resolve factory target branch"):
            dispatch.run_start(args=args)
        session_client.beta.sessions.create.assert_not_called()
    else:
        dispatch.run_start(args=args)
        request = session_client.beta.sessions.create.call_args.kwargs
        assert request["resources"][0]["checkout"]["name"] == "screened"


def test_watch_does_not_ready_or_merge_pr_with_wrong_base(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        metadata={"target_branch": "feature/online-evals"},
        outcome_evaluations=[SimpleNamespace(result="satisfied")],
        usage=None,
    )
    client = Mock()
    client.beta.sessions.retrieve.return_value = session
    monkeypatch.setattr(
        dispatch,
        "wait_for_session",
        lambda **kwargs: (session, SimpleNamespace(stop_reason=SimpleNamespace(type="end_turn"))),
    )
    required_checks = Mock(side_effect=AssertionError("wrong-base PR entered CI"))
    monkeypatch.setattr(dispatch, "wait_for_required_checks", required_checks)
    report = dispatch.watch_session(
        client=client,
        session_id="session-test",
        lane="feature",
        app_token=Mock(),
        watch_minutes=1,
        auto_merge=True,
        find_pr=lambda: {"number": 10, "url": "https://example.com/pr/10", "baseRefName": "main"},
    )
    assert "admitted target branch is feature/online-evals" in report
    assert "**flawed**" in report
    required_checks.assert_not_called()
