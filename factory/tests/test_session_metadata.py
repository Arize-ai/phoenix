from types import SimpleNamespace
from typing import Any

import pytest

from factory.session_metadata import (
    ArtifactMetadataError,
    SessionArtifactObserver,
    merge_references,
    read_linked_issue_numbers,
)


def tool_call(*, event_id: str, name: str, **inputs: Any) -> SimpleNamespace:
    return SimpleNamespace(
        type="agent.mcp_tool_use",
        id=event_id,
        name=name,
        mcp_server_name="github",
        input={"owner": "Arize-ai", "repo": "phoenix", **inputs},
    )


def tool_result(
    *, event_id: str, call_id: str, text: str, is_error: bool = False
) -> SimpleNamespace:
    return SimpleNamespace(
        type="agent.mcp_tool_result",
        id=event_id,
        mcp_tool_use_id=call_id,
        is_error=is_error,
        content=[SimpleNamespace(type="text", text=text)],
    )


class SessionAPI:
    def __init__(self, metadata: dict[str, str]) -> None:
        self.session = SimpleNamespace(id="session", metadata=metadata)
        self.primary: list[Any] = []
        self.children: dict[str, list[Any]] = {}
        self.updates: list[dict[str, str | None]] = []
        self.events = SimpleNamespace(list=lambda *args, **kwargs: iter(self.primary))
        self.threads = SimpleNamespace(
            list=lambda *args: [
                SimpleNamespace(id=thread_id, parent_thread_id="primary")
                for thread_id in self.children
            ],
            events=SimpleNamespace(list=lambda thread_id, **kwargs: iter(self.children[thread_id])),
        )
        self.client = SimpleNamespace(beta=SimpleNamespace(sessions=self))

    def update(self, session_id: str, *, metadata: dict[str, str | None]) -> SimpleNamespace:
        assert session_id == self.session.id
        self.updates.append(metadata)
        for key, value in metadata.items():
            if value is None:
                self.session.metadata.pop(key, None)
            else:
                self.session.metadata[key] = value
        return self.session


def resolve_artifact(number: int) -> tuple[str, list[int]]:
    return ("pr", [number + 100]) if number >= 10 else ("issue", [])


def test_plural_references_merge_legacy_and_preserve_unrelated_metadata() -> None:
    original = {
        "repo": "Arize-ai/phoenix",
        "issue": "1",
        "pr": "10",
        "lane": "finish",
        "sha": "abc",
    }
    merged = merge_references(metadata=original, issues=[2, 1], prs=[11, 10])
    assert merged == {
        "repo": "Arize-ai/phoenix",
        "issues": "[1,2]",
        "prs": "[10,11]",
        "lane": "finish",
        "sha": "abc",
    }
    assert original["issue"] == "1"
    assert merge_references(metadata=merged, issues=[1], prs=[10]) == merged


@pytest.mark.parametrize(
    "metadata",
    [
        {"issues": "[true]"},
        {"prs": "[0]"},
        {"issues": "{}"},
        {"issue": "oops"},
    ],
)
def test_invalid_references_are_not_silently_discarded(metadata: dict[str, str]) -> None:
    with pytest.raises(ArtifactMetadataError):
        merge_references(metadata=metadata)


def test_overflow_preserves_existing_references() -> None:
    original = {"issues": "[1]", "prs": "[]"}
    with pytest.raises(ArtifactMetadataError, match="512-character"):
        merge_references(metadata=original, issues=range(2, 1000))
    assert original == {"issues": "[1]", "prs": "[]"}
    with pytest.raises(ArtifactMetadataError, match="16-pair"):
        merge_references(metadata={f"key{number}": "value" for number in range(16)})


def test_linked_issues_are_scoped_to_the_metadata_repository() -> None:
    assert read_linked_issue_numbers(
        pr={
            "closingIssuesReferences": [
                {"number": 1, "url": "https://github.com/Arize-ai/phoenix/issues/1"},
                {"number": 2, "url": "https://github.com/other/repo/issues/2"},
            ]
        },
        repo="Arize-ai/phoenix",
    ) == [1]


def test_observer_collects_multiple_created_artifacts_and_child_thread_mutations() -> None:
    api = SessionAPI({"repo": "Arize-ai/phoenix", "issue": "1", "lane": "bug"})
    api.primary = [
        tool_call(event_id="pr-a", name="create_pull_request"),
        tool_result(event_id="r-a", call_id="pr-a", text='{"number":10}'),
        tool_call(event_id="pr-b", name="create_pull_request"),
        tool_result(
            event_id="r-b",
            call_id="pr-b",
            text='{"url":"https://github.com/Arize-ai/phoenix/pull/11"}',
        ),
    ]
    api.children["child"] = [
        tool_call(event_id="issue-a", name="issue_write", method="create"),
        tool_result(
            event_id="r-c",
            call_id="issue-a",
            text='{"url":"https://api.github.com/repos/Arize-ai/phoenix/issues/2"}',
        ),
    ]
    observer = SessionArtifactObserver()
    observer.sync(client=api.client, session=api.session, resolve_artifact=resolve_artifact)
    assert api.session.metadata == {
        "repo": "Arize-ai/phoenix",
        "lane": "bug",
        "issues": "[1,2,110,111]",
        "prs": "[10,11]",
    }
    assert api.updates[0]["issue"] is None
    observer.sync(client=api.client, session=api.session, resolve_artifact=resolve_artifact)
    assert len(api.updates) == 1
    api.primary += [
        tool_call(event_id="issue-b", name="issue_write", method="create"),
        tool_result(event_id="r-d", call_id="issue-b", text='{"number":3}'),
    ]
    observer.sync(client=api.client, session=api.session, resolve_artifact=resolve_artifact)
    assert api.session.metadata["issues"] == "[1,2,3,110,111]"
    assert api.session.metadata["prs"] == "[10,11]"
    restarted = SessionArtifactObserver()
    restarted.sync(client=api.client, session=api.session, resolve_artifact=resolve_artifact)
    assert len(api.updates) == 2


def test_pending_tool_results_are_recorded_on_a_later_poll() -> None:
    api = SessionAPI({"repo": "Arize-ai/phoenix"})
    api.primary = [tool_call(event_id="pr", name="create_pull_request")]
    observer = SessionArtifactObserver()
    observer.sync(client=api.client, session=api.session, resolve_artifact=resolve_artifact)
    assert api.session.metadata["prs"] == "[]"
    api.primary.append(tool_result(event_id="result", call_id="pr", text='{"number":10}'))
    observer.sync(client=api.client, session=api.session, resolve_artifact=resolve_artifact)
    assert api.session.metadata["prs"] == "[10]"


def test_failed_foreign_and_search_results_do_not_become_associations() -> None:
    api = SessionAPI({"repo": "Arize-ai/phoenix"})
    api.primary = [
        tool_call(event_id="failed", name="issue_write", method="create"),
        tool_result(event_id="r-f", call_id="failed", text='{"number":1}', is_error=True),
        tool_call(event_id="foreign", name="issue_write", method="create", repo="other"),
        tool_result(event_id="r-x", call_id="foreign", text='{"number":2}'),
        tool_call(event_id="search", name="search_issues"),
        tool_result(event_id="r-s", call_id="search", text='{"number":3}'),
    ]
    SessionArtifactObserver().sync(
        client=api.client, session=api.session, resolve_artifact=resolve_artifact
    )
    assert api.session.metadata["issues"] == "[]"
    assert api.session.metadata["prs"] == "[]"


def test_updates_classify_pr_comments_and_refresh_closing_issues() -> None:
    api = SessionAPI({"repo": "Arize-ai/phoenix", "prs": "[10]", "issues": "[1]"})
    api.primary = [
        tool_call(event_id="comment", name="add_issue_comment", issue_number=11),
        tool_result(event_id="r-comment", call_id="comment", text='{"id":99}'),
    ]
    SessionArtifactObserver().sync(
        client=api.client, session=api.session, resolve_artifact=resolve_artifact
    )
    assert api.session.metadata["issues"] == "[1,110,111]"
    assert api.session.metadata["prs"] == "[10,11]"


def test_unidentifiable_successful_creation_fails_explicitly() -> None:
    api = SessionAPI({"repo": "Arize-ai/phoenix"})
    api.primary = [
        tool_call(event_id="create", name="issue_write", method="create"),
        tool_result(event_id="result", call_id="create", text="created"),
    ]
    with pytest.raises(ArtifactMetadataError, match="no artifact reference"):
        SessionArtifactObserver().sync(
            client=api.client, session=api.session, resolve_artifact=resolve_artifact
        )
    assert api.session.metadata == {"repo": "Arize-ai/phoenix"}


def test_update_failure_keeps_result_retryable() -> None:
    api = SessionAPI({"repo": "Arize-ai/phoenix"})
    api.primary = [
        tool_call(event_id="create", name="issue_write", method="create"),
        tool_result(event_id="result", call_id="create", text='{"number":1}'),
    ]
    observer = SessionArtifactObserver()
    update = api.update

    def fail_update(*args: Any, **kwargs: Any) -> Any:
        raise TimeoutError("test timeout")

    api.update = fail_update
    with pytest.raises(TimeoutError):
        observer.sync(client=api.client, session=api.session, resolve_artifact=resolve_artifact)
    assert observer.seen_results == set()
    api.update = update
    observer.sync(client=api.client, session=api.session, resolve_artifact=resolve_artifact)
    assert api.session.metadata["issues"] == "[1]"


def test_wait_for_session_updates_metadata_before_returning_idle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import importlib
    import time
    from pathlib import Path

    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1]))
    dispatch = importlib.import_module("dispatch")
    api = SessionAPI({"repo": "Arize-ai/phoenix", "issue": "1"})
    api.session.status = "idle"
    api.session.outcome_evaluations = []
    api.retrieve = lambda *args: api.session
    api.primary = [
        tool_call(event_id="issue-create", name="issue_write", method="create"),
        tool_result(event_id="created", call_id="issue-create", text='{"number":2}'),
    ]
    idle = SimpleNamespace(id="idle", stop_reason=SimpleNamespace(type="end_turn"))
    monkeypatch.setattr(dispatch, "read_latest_idle_event", lambda **kwargs: idle)
    monkeypatch.setattr(dispatch, "run_gh", lambda *args, **kwargs: '{"number":2}')
    session, event = dispatch.wait_for_session(
        client=api.client,
        app_token=SimpleNamespace(refresh=lambda: "test-token"),
        session_id="session",
        previous_idle_event_id=None,
        deadline=time.monotonic() + 60,
    )
    assert event is idle
    assert session.metadata == {"repo": "Arize-ai/phoenix", "issues": "[1,2]", "prs": "[]"}


@pytest.mark.parametrize("entrypoint", ["dispatch", "review", "finish", "log_scan"])
def test_creation_paths_seed_plural_metadata(
    entrypoint: str, monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> None:
    import importlib
    from datetime import datetime, timezone
    from pathlib import Path

    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1]))
    module = importlib.import_module(entrypoint)
    lock = tmp_path / "lock.json"
    lock.write_text("{}")
    monkeypatch.setattr(module, "LOCK_FILE_PATH", lock)
    monkeypatch.setattr(module, "read_lock_id", lambda **kwargs: "resource")
    monkeypatch.setattr(module, "read_vault_ids", lambda **kwargs: [])
    captured: dict[str, Any] = {}

    def create_session(**params: Any) -> SimpleNamespace:
        captured.update(params)
        return SimpleNamespace(id="new-session")

    client = SimpleNamespace(beta=SimpleNamespace(sessions=SimpleNamespace(create=create_session)))
    common = {
        "client": client,
        "repo": "Arize-ai/phoenix",
        "github_token": "test",
        "budget_cents": 100,
    }
    pr = {
        "number": 10,
        "headRefOid": "sha",
        "headRefName": "branch",
        "baseRefName": "main",
        "baseRefOid": "base-sha",
        "isCrossRepository": False,
        "headRepositoryOwner": {"login": "Arize-ai"},
        "headRepository": {"name": "phoenix"},
        "_factory_snapshot": {},
        "closingIssuesReferences": [
            {"number": 1, "url": "https://github.com/Arize-ai/phoenix/issues/1"},
            {"number": 2, "url": "https://github.com/Arize-ai/phoenix/issues/2"},
        ],
    }
    if entrypoint == "dispatch":
        module.start_session(
            **common,
            lane="bug",
            issue_number=1,
            label_names=[],
            snapshot={},
            git_author_name="factory",
            git_author_email="factory@example.com",
        )
        assert captured["metadata"] == {
            "repo": "Arize-ai/phoenix",
            "lane": "bug",
            "issues": "[1]",
            "prs": "[]",
        }
    elif entrypoint == "review":
        monkeypatch.setattr(module, "read_open_factory_threads", lambda **kwargs: [])
        module.start_session(**common, pr=pr, factory_login="factory")
        assert captured["metadata"] == {
            "repo": "Arize-ai/phoenix",
            "lane": "review",
            "sha": "sha",
            "issues": "[1,2]",
            "prs": "[10]",
        }
    elif entrypoint == "finish":
        module.start_session(
            **common,
            pr=pr,
            source_pr_number=9,
            requester_login="alex",
            git_author_name="factory",
            git_author_email="factory@example.com",
        )
        assert captured["metadata"] == {
            "repo": "Arize-ai/phoenix",
            "lane": "finish",
            "sha": "sha",
            "issues": "[1,2]",
            "prs": "[9,10]",
        }
    else:
        module.start_triage_session(
            **common,
            source=module.CLOUD,
            kickoff_text="test",
            window_end=datetime.now(timezone.utc),
        )
        assert captured["metadata"] == {
            "repo": "Arize-ai/phoenix",
            "lane": "cloud-triage",
            "issues": "[]",
            "prs": "[]",
        }


def test_later_pr_body_updates_append_new_closing_issues_without_dropping_old_links() -> None:
    api = SessionAPI({"repo": "Arize-ai/phoenix", "prs": "[10]", "issues": "[1]"})
    linked = [2]

    def resolve_updated_pr(number: int) -> tuple[str, list[int]]:
        assert number == 10
        return "pr", linked

    observer = SessionArtifactObserver()
    observer.sync(client=api.client, session=api.session, resolve_artifact=resolve_updated_pr)
    linked = [3, 4]
    api.primary = [
        tool_call(event_id="update-pr", name="update_pull_request", pullNumber=10),
        tool_result(event_id="updated", call_id="update-pr", text='{"number":10}'),
    ]
    observer.sync(client=api.client, session=api.session, resolve_artifact=resolve_updated_pr)
    assert api.session.metadata["issues"] == "[1,2,3,4]"
    assert api.session.metadata["prs"] == "[10]"


def test_error_payloads_do_not_associate_mutation_targets() -> None:
    api = SessionAPI({"repo": "Arize-ai/phoenix"})
    api.primary = [
        tool_call(event_id="update", name="issue_write", method="update", issue_number=2),
        tool_result(event_id="failed", call_id="update", text='{"error":"denied"}'),
    ]
    SessionArtifactObserver().sync(
        client=api.client, session=api.session, resolve_artifact=resolve_artifact
    )
    assert api.session.metadata["issues"] == "[]"
