"""GitHub references associated with one managed-agent session."""

import json
import re
from collections.abc import Callable, Iterable, Mapping
from typing import Any, Literal

MAX_METADATA_PAIRS = 16
MAX_METADATA_VALUE_LENGTH = 512
ArtifactKind = Literal["issue", "pr"]
ArtifactResolver = Callable[[int], tuple[ArtifactKind, list[int]]]


class ArtifactMetadataError(ValueError):
    pass


def read_linked_issue_numbers(*, pr: Mapping[str, Any], repo: str) -> list[int]:
    return [
        issue["number"]
        for issue in pr.get("closingIssuesReferences", [])
        if str(issue.get("url", "")).casefold()
        == f"https://github.com/{repo}/issues/{issue['number']}".casefold()
    ]


def read_references(*, metadata: Mapping[str, str], plural: str, singular: str) -> list[int]:
    try:
        value = json.loads(metadata.get(plural, "[]"))
    except json.JSONDecodeError:
        raise ArtifactMetadataError(f"{plural} must be a JSON array of positive integers") from None
    if not isinstance(value, list) or any(
        type(number) is not int or number <= 0 for number in value
    ):
        raise ArtifactMetadataError(f"{plural} must be a JSON array of positive integers")
    numbers = set(value)
    if legacy := metadata.get(singular):
        if not legacy.isdecimal() or int(legacy) <= 0:
            raise ArtifactMetadataError(f"{singular} must be a positive integer")
        numbers.add(int(legacy))
    return sorted(numbers)


def merge_references(
    *,
    metadata: Mapping[str, str],
    issues: Iterable[int] = (),
    prs: Iterable[int] = (),
) -> dict[str, str]:
    merged = {key: value for key, value in metadata.items() if key not in {"issue", "pr"}}
    for plural, singular, additions in [("issues", "issue", issues), ("prs", "pr", prs)]:
        numbers = set(read_references(metadata=metadata, plural=plural, singular=singular))
        for number in additions:
            if type(number) is not int or number <= 0:
                raise ArtifactMetadataError(f"{plural} must contain positive integers")
            numbers.add(number)
        encoded = json.dumps(sorted(numbers), separators=(",", ":"))
        if len(encoded) > MAX_METADATA_VALUE_LENGTH:
            raise ArtifactMetadataError(f"{plural} exceeds the 512-character metadata limit")
        merged[plural] = encoded
    if len(merged) > MAX_METADATA_PAIRS:
        raise ArtifactMetadataError("Artifact metadata exceeds the 16-pair limit")
    return merged


def read_result_numbers(*, event: Any, repo: str) -> set[int] | None:
    numbers: set[int] = set()
    url_pattern = re.compile(
        rf"https://(?:github\.com/{re.escape(repo)}/(?:issues|pull)|"
        rf"api\.github\.com/repos/{re.escape(repo)}/(?:issues|pulls))/(\d+)",
        re.IGNORECASE,
    )
    for block in event.content or []:
        if block.type != "text":
            continue
        try:
            result = json.loads(block.text)
        except json.JSONDecodeError:
            result = block.text.strip()
        if isinstance(result, dict):
            if result.get("error") or result.get("isError"):
                return None
            values = [result.get("url"), result.get("html_url")]
            number = result.get("number")
            if type(number) is int and number > 0:
                numbers.add(number)
        else:
            values = [result]
        for value in values:
            if isinstance(value, str) and (match := url_pattern.fullmatch(value)):
                numbers.add(int(match.group(1)))
    return numbers


class SessionArtifactObserver:
    def __init__(self) -> None:
        self.seen_results: set[str] = set()
        self.has_reconciled_initial_prs = False

    def sync(self, *, client: Any, session: Any, resolve_artifact: ArtifactResolver) -> Any:
        repo = session.metadata.get("repo")
        if not repo:
            return session
        streams = [
            client.beta.sessions.events.list(
                session.id,
                types=["agent.mcp_tool_use", "agent.mcp_tool_result"],
                order="asc",
            )
        ]
        for thread in client.beta.sessions.threads.list(session.id):
            if thread.parent_thread_id is not None:
                streams.append(
                    client.beta.sessions.threads.events.list(thread.id, session_id=session.id)
                )
        calls: dict[str, Any] = {}
        results: dict[str, Any] = {}
        for stream in streams:
            for event in stream:
                if event.type == "agent.mcp_tool_use":
                    calls[event.id] = event
                elif event.type == "agent.mcp_tool_result":
                    results[event.id] = event
        candidates: set[int] = set()
        observed_results: set[str] = set()
        for result in results.values():
            if result.id in self.seen_results:
                continue
            call = calls.get(result.mcp_tool_use_id)
            if call is None:
                continue
            observed_results.add(result.id)
            if result.is_error or call.mcp_server_name != "github":
                continue
            if call.name not in {
                "create_pull_request",
                "update_pull_request",
                "issue_write",
                "add_issue_comment",
                "pull_request_review_write",
                "add_comment_to_pending_review",
                "add_reply_to_pull_request_comment",
            }:
                continue
            owner, name = repo.split("/", 1)
            if (
                str(call.input.get("owner", "")).casefold(),
                str(call.input.get("repo", "")).casefold(),
            ) != (owner.casefold(), name.casefold()):
                continue
            numbers = read_result_numbers(event=result, repo=repo)
            if numbers is None:
                continue
            for key in ("issue_number", "pullNumber", "pull_number"):
                number = call.input.get(key)
                if type(number) is int and number > 0:
                    numbers.add(number)
            if not numbers and (
                call.name == "create_pull_request"
                or call.name == "issue_write"
                and call.input.get("method") == "create"
            ):
                raise ArtifactMetadataError("Successful GitHub creation has no artifact reference")
            candidates.update(numbers)
        if not self.has_reconciled_initial_prs:
            candidates.update(
                read_references(metadata=session.metadata, plural="prs", singular="pr")
            )
        issues: set[int] = set()
        prs: set[int] = set()
        for number in sorted(candidates):
            kind, linked_issues = resolve_artifact(number)
            if kind == "pr":
                prs.add(number)
                issues.update(linked_issues)
            else:
                issues.add(number)
        merged = merge_references(metadata=session.metadata, issues=issues, prs=prs)
        if merged != session.metadata:
            patch: dict[str, str | None] = {
                key: value for key, value in merged.items() if session.metadata.get(key) != value
            }
            patch.update({key: None for key in ("issue", "pr") if key in session.metadata})
            session = client.beta.sessions.update(session.id, metadata=patch)
        self.seen_results.update(observed_results)
        self.has_reconciled_initial_prs = True
        return session
