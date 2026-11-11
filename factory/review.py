# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "anthropic==1.12.1",
#     "PyJWT[crypto]==2.15.1",
# ]
# ///
"""Run one Phoenix pull request through the factory's review lane.

`start` checks that the PR is open and that whoever asked has write access, then creates a
Managed Agents session with the pr-reviewer agent, kicked off with the PR number and the
commit to review, and posts one status comment on the PR. `watch` waits for the session to
end, finds the review it posted, turns that comment into the review's verdict, which it
also sets as one of the VERDICT_LABELS, and resolves the earlier factory review threads
the review reports as fixed or no longer applicable. Agent, environment and vault IDs come from
claude-lock.json, which `ant apply` writes.
"""

import argparse
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, NamedTuple, Optional

import anthropic
from dispatch import (
    ENVIRONMENT_LOCK_KEY,
    LOCK_FILE_PATH,
    STARTING_PERMISSIONS,
    WORKFLOW_LOGIN,
    create_app_token,
    format_cost,
    format_mention,
    format_session_link,
    post_status_comment,
    read_lock_id,
    read_repo_permission,
    read_vault_ids,
    report_on_status_comment,
    run_gh,
    wait_for_session,
    write_github_outputs,
)
from github_app import GitHubAppToken

REVIEW_LABEL = "factory-review"
REVIEW_AGENT_LOCK_KEY = "./agents/pr-reviewer.md"


class Marker(StrEnum):
    """The emoji that starts each scorecard cell, Needs attention bullet and the heading of a
    review summary, per agents/pr-reviewer.md § Review summary. Each differs from the others
    in shape and color, and always sits next to a word that says the same thing."""

    CLEAN = "✅"
    ATTENTION = "⚠️"
    FIX = "❌"
    CLOSE = "🚫"


# The marker each scorecard Result takes. Blocking and Non-blocking hold counts, so they are
# keyed by whether the count is zero.
SCORECARD_MARKERS: dict[str, dict[str, Marker]] = {
    "Fit": {"Pass": Marker.CLEAN, "Partial": Marker.FIX, "Fail": Marker.FIX},
    "Checks": {"Pass": Marker.CLEAN, "Not run": Marker.ATTENTION, "Fail": Marker.FIX},
    "Tests": {"Pass": Marker.CLEAN, "Not needed": Marker.CLEAN, "Fail": Marker.FIX},
    "Blocking": {"0": Marker.CLEAN, "1+": Marker.FIX},
    "Non-blocking": {"0": Marker.CLEAN, "1+": Marker.ATTENTION},
    "Risk": {
        "None": Marker.CLEAN,
        "Low": Marker.ATTENTION,
        "Medium": Marker.ATTENTION,
        "High": Marker.ATTENTION,
    },
    "Depth": {"Glance": Marker.CLEAN, "Focused": Marker.CLEAN, "Deep": Marker.ATTENTION},
}


class VerdictLabel(NamedTuple):
    name: str
    color: str
    description: str
    marker: Marker


# The label each verdict leaves on the PR, so maintainers can filter the review queue by it.
# A PR carries at most one of them, for the factory's latest review.
VERDICT_LABELS = {
    "Approve": VerdictLabel(
        "factory-approved", "0E8A16", "The factory review recommends approving", Marker.CLEAN
    ),
    "Request changes": VerdictLabel(
        "factory-request-changes",
        "D93F0B",
        "The factory review recommends requesting changes",
        Marker.FIX,
    ),
    "Close": VerdictLabel(
        "factory-close", "B60205", "The factory review recommends closing", Marker.CLOSE
    ),
}
# The verdict in the review summary's heading, its first line, per agents/pr-reviewer.md.
# The marker is optional so reviews posted before markers existed still parse.
VERDICT_PATTERN = re.compile(
    rf"## (?:(?P<marker>{'|'.join(re.escape(marker) for marker in Marker)}) )?"
    rf"Factory review of \S+: (?P<verdict>{'|'.join(VERDICT_LABELS)})"
)


def read_pr(*, pr_number: int) -> dict[str, Any]:
    return json.loads(
        run_gh(
            "pr",
            "view",
            str(pr_number),
            "--json",
            "number,state,isCrossRepository,baseRefName,headRefName,headRefOid,"
            "headRepository,headRepositoryOwner",
        )
    )


def comment_on_pr(*, pr_number: int, body: str, token: Optional[str]) -> None:
    run_gh("pr", "comment", str(pr_number), "--body-file", "-", token=token, input_text=body)


def remove_review_label(*, pr_number: int, token: Optional[str]) -> None:
    run_gh("pr", "edit", str(pr_number), "--remove-label", REVIEW_LABEL, token=token)


def set_verdict_label(*, pr_number: int, verdict: Optional[str], token: Optional[str]) -> None:
    """Leave the PR with the label for `verdict` and no other verdict label; None clears them."""
    pr_labels = json.loads(run_gh("pr", "view", str(pr_number), "--json", "labels", token=token))
    current_names = {label["name"] for label in pr_labels["labels"]}
    wanted = VERDICT_LABELS[verdict] if verdict is not None else None
    stale_names = [
        label.name
        for label in VERDICT_LABELS.values()
        if label != wanted and label.name in current_names
    ]
    edit_args: list[str] = []
    if wanted is not None and wanted.name not in current_names:
        # Create or update the label on use, so a repo never lacks one the factory applies.
        run_gh(
            "label",
            "create",
            wanted.name,
            "--color",
            wanted.color,
            "--description",
            wanted.description,
            "--force",
            token=token,
        )
        edit_args += ["--add-label", wanted.name]
    if stale_names:
        edit_args += ["--remove-label", ",".join(stale_names)]
    if edit_args:
        run_gh("pr", "edit", str(pr_number), *edit_args, token=token)


def read_factory_login() -> str:
    factory_login = os.environ.get("FACTORY_GITHUB_LOGIN", "")
    if not factory_login:
        raise SystemExit(
            "Set the FACTORY_GITHUB_LOGIN repository variable, not a secret, to the factory "
            "app's bot login, such as arize-phoenix-factory[bot]."
        )
    return factory_login


def find_admission_problem(
    *, pr: dict[str, Any], requester_login: str, requester_permission: str
) -> Optional[str]:
    if requester_permission not in STARTING_PERMISSIONS:
        return f"`{requester_login}` needs write access to this repository to start it"
    if pr["state"] != "OPEN":
        return f"the pull request is {pr['state'].lower()}"
    return None


def describe_head(*, pr: dict[str, Any]) -> str:
    if not pr["isCrossRepository"]:
        return f"branch {pr['headRefName']} of this repository"
    if not pr["headRepository"] or not pr["headRepositoryOwner"]:
        return f"branch {pr['headRefName']} of a deleted fork"
    owner_login = pr["headRepositoryOwner"]["login"]
    repo_name = pr["headRepository"]["name"]
    return f"branch {pr['headRefName']} of the fork {owner_login}/{repo_name}"


def start_session(
    *,
    client: anthropic.Anthropic,
    repo: str,
    pr: dict[str, Any],
    github_token: str,
    factory_login: str,
    budget_cents: int,
) -> str:
    lock = json.loads(LOCK_FILE_PATH.read_text())
    head_sha = pr["headRefOid"]
    open_threads: list[ReviewThread] = []
    try:
        open_threads = read_open_factory_threads(
            repo=repo, pr_number=pr["number"], factory_login=factory_login, token=github_token
        )
    except subprocess.CalledProcessError as error:
        print(f"::warning::gh failed while listing review threads: {error}: {error.stderr}")
    except (json.JSONDecodeError, KeyError, TypeError) as error:
        print(f"::warning::Unexpected GitHub response while listing review threads: {error!r}")
    # Keep untrusted PR text (title, body, comments) out of the prompt; the agent reads it
    # through the GitHub MCP server.
    kickoff_text = (
        f"Review pull request #{pr['number']} in {repo}. Review commit {head_sha}, the head of "
        f"{describe_head(pr=pr)}, against base branch {pr['baseRefName']}. "
        f"Read the PR with pull_request_read. Fetch its commits with "
        f"`git fetch origin {pr['baseRefName']} pull/{pr['number']}/head` and check out "
        f"{head_sha} before you run anything." + format_open_threads(threads=open_threads)
    )
    session = client.beta.sessions.create(
        agent=read_lock_id(lock=lock, lock_key=REVIEW_AGENT_LOCK_KEY),
        environment_id=read_lock_id(lock=lock, lock_key=ENVIRONMENT_LOCK_KEY),
        vault_ids=read_vault_ids(lock=lock),
        title=f"review: {repo}#{pr['number']}",
        metadata={"repo": repo, "pr": str(pr["number"]), "lane": "review", "sha": head_sha},
        budget={
            "type": "limit",
            "max_list_cost": {"amount": str(budget_cents), "currency": "USD"},
        },
        resources=[
            {
                "type": "github_repository",
                "url": f"https://github.com/{repo}",
                "authorization_token": github_token,
                # The PR may come from a fork, so the agent fetches pull/N/head itself.
                "checkout": {"type": "branch", "name": pr["baseRefName"]},
            }
        ],
        # No graded outcome: a posted review can't be taken back, so a grader's revision
        # cycles could only edit or repost it.
        initial_events=[
            {"type": "user.message", "content": [{"type": "text", "text": kickoff_text}]},
        ],
    )
    return session.id


def find_factory_review(
    *, pr_number: int, started_at: str, factory_login: str
) -> Optional[dict[str, Any]]:
    """Return the first review the factory submitted since `started_at`, on any commit.

    Matching by time rather than by commit finds the review when the agent had to review a
    newer head, and never picks up a review from an earlier run. The concurrency group
    keeps one review session per PR, so a review after `started_at` is this session's.
    """
    review_lines = run_gh(
        "api",
        "--paginate",
        f"repos/{{owner}}/{{repo}}/pulls/{pr_number}/reviews",
        "--jq",
        f'.[] | select(.user.login == "{factory_login}" and .submitted_at >= "{started_at}") '
        "| {html_url, body, commit_id}",
    ).splitlines()
    reviews = [json.loads(review_line) for review_line in review_lines if review_line]
    return reviews[0] if reviews else None


class ReviewThread(NamedTuple):
    id: str
    comment_id: Optional[int]
    review_id: Optional[int]


# The review summary's line naming the earlier threads whose finding the reviewer found
# fixed or no longer applicable, per agents/pr-reviewer.md.
RESOLVED_THREADS_PATTERN = re.compile(r"^\*\*Resolved threads:\*\* (.*)$", re.MULTILINE)
THREAD_ID_PATTERN = re.compile(r"PRRT_[A-Za-z0-9_-]+")


def read_unresolved_threads(
    *, repo: str, pr_number: int, token: Optional[str]
) -> list[ReviewThread]:
    """Every unresolved review thread on the PR, with the review its first comment belongs to."""
    owner, name = repo.split("/")
    query = """
    query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              isResolved
              comments(first: 1) { nodes { databaseId pullRequestReview { databaseId } } }
            }
          }
        }
      }
    }"""
    threads: list[ReviewThread] = []
    cursor: Optional[str] = None
    while True:
        variables = ["-F", f"owner={owner}", "-F", f"name={name}", "-F", f"number={pr_number}"]
        if cursor is not None:
            variables += ["-F", f"cursor={cursor}"]
        response = json.loads(
            run_gh("api", "graphql", "-f", f"query={query}", *variables, token=token)
        )
        connection = response["data"]["repository"]["pullRequest"]["reviewThreads"]
        for node in connection["nodes"]:
            if node["isResolved"]:
                continue
            first_comments = node["comments"]["nodes"]
            first_comment = first_comments[0] if first_comments else None
            review = first_comment["pullRequestReview"] if first_comment else None
            threads.append(
                ReviewThread(
                    id=node["id"],
                    comment_id=first_comment["databaseId"] if first_comment else None,
                    review_id=review["databaseId"] if review else None,
                )
            )
        if not connection["pageInfo"]["hasNextPage"]:
            return threads
        cursor = connection["pageInfo"]["endCursor"]


def read_factory_review_ids(
    *, pr_number: int, factory_login: str, token: Optional[str]
) -> set[int]:
    id_lines = run_gh(
        "api",
        "--paginate",
        f"repos/{{owner}}/{{repo}}/pulls/{pr_number}/reviews",
        "--jq",
        f'.[] | select(.user.login == "{factory_login}") | .id',
        token=token,
    ).split()
    return {int(id_line) for id_line in id_lines}


def read_open_factory_threads(
    *, repo: str, pr_number: int, factory_login: str, token: Optional[str]
) -> list[ReviewThread]:
    """The unresolved threads that earlier factory reviews opened on the PR."""
    factory_review_ids = read_factory_review_ids(
        pr_number=pr_number, factory_login=factory_login, token=token
    )
    return [
        thread
        for thread in read_unresolved_threads(repo=repo, pr_number=pr_number, token=token)
        if thread.review_id in factory_review_ids
    ]


def format_open_threads(*, threads: list[ReviewThread]) -> str:
    """The kickoff's list of earlier factory threads for the reviewer to re-check."""
    if not threads:
        return ""
    thread_lines = "\n".join(f"- {thread.id} (comment {thread.comment_id})" for thread in threads)
    return (
        " The factory's earlier reviews left these threads open; re-check each against the "
        "code you review and name the ones whose finding is fixed or no longer applies on the "
        "summary's Resolved threads line:\n" + thread_lines
    )


def parse_resolved_thread_ids(*, review_body: str) -> list[str]:
    """The thread IDs the review's Resolved threads line names; none when the line is absent."""
    line_match = RESOLVED_THREADS_PATTERN.search(review_body)
    if line_match is None:
        return []
    return THREAD_ID_PATTERN.findall(line_match.group(1))


def select_resolvable_threads(
    *, requested_ids: list[str], open_factory_threads: list[ReviewThread]
) -> list[ReviewThread]:
    """The requested threads that really are open threads of an earlier factory review."""
    requested = set(requested_ids)
    return [thread for thread in open_factory_threads if thread.id in requested]


def resolve_thread(*, thread_id: str, token: Optional[str]) -> None:
    mutation = (
        "mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) "
        "{ thread { isResolved } } }"
    )
    run_gh("api", "graphql", "-f", f"query={mutation}", "-F", f"id={thread_id}", token=token)


def resolve_reported_threads(
    *, repo: str, pr_number: int, review_body: str, factory_login: str, token: Optional[str]
) -> int:
    """Resolve the earlier factory threads the review reports as fixed or no longer
    applicable; return how many."""
    resolvable_threads = select_resolvable_threads(
        requested_ids=parse_resolved_thread_ids(review_body=review_body),
        open_factory_threads=read_open_factory_threads(
            repo=repo, pr_number=pr_number, factory_login=factory_login, token=token
        ),
    )
    for thread in resolvable_threads:
        resolve_thread(thread_id=thread.id, token=token)
    return len(resolvable_threads)


def normalize_markers(text: str) -> str:
    """Add the emoji variation selector models sometimes drop, so "⚠" reads as "⚠️"."""
    return text.replace(Marker.ATTENTION, "⚠").replace("⚠", Marker.ATTENTION)


def read_verdict(*, review_body: str) -> Optional[str]:
    heading = normalize_markers(review_body.lstrip().split("\n", 1)[0].rstrip())
    verdict_match = VERDICT_PATTERN.fullmatch(heading)
    return verdict_match.group("verdict") if verdict_match else None


def expected_marker(*, column: str, result: str) -> Optional[Marker]:
    markers = SCORECARD_MARKERS.get(column)
    if markers is None:
        return None
    if column in ("Blocking", "Non-blocking"):
        return markers["0" if result == "0" else "1+"] if result.isdigit() else None
    return markers.get(result)


def find_marker_mismatches(*, review_body: str) -> list[str]:
    """Describe each place the summary's markers disagree with SCORECARD_MARKERS and
    VERDICT_LABELS, so the job log shows when the reviewer drifted from the template."""
    lines = normalize_markers(review_body).strip().splitlines()
    mismatches: list[str] = []
    heading_match = VERDICT_PATTERN.fullmatch(lines[0].rstrip()) if lines else None
    if heading_match:
        verdict_marker = VERDICT_LABELS[heading_match.group("verdict")].marker
        if heading_match.group("marker") != verdict_marker:
            mismatches.append(
                f"heading: want {verdict_marker}, got {heading_match.group('marker')}"
            )
    columns = list(SCORECARD_MARKERS)
    header = "| " + " | ".join(columns) + " |"
    if header not in lines or lines.index(header) + 2 >= len(lines):
        return mismatches + ["scorecard: not found"]
    row = lines[lines.index(header) + 2]
    cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
    if len(cells) != len(columns):
        return mismatches + [f"scorecard: want {len(columns)} cells, got {len(cells)}"]
    for column, cell in zip(columns, cells):
        marker, _, result = cell.partition(" ")
        if marker not in tuple(Marker):
            marker, result = "", cell
        wanted = expected_marker(column=column, result=result)
        if wanted is None:
            mismatches.append(f"{column}: unknown result {cell!r}")
        elif marker != wanted:
            mismatches.append(f"{column}: want {wanted} {result}, got {cell!r}")
    return mismatches


def watch_session(
    *,
    client: anthropic.Anthropic,
    app_token: GitHubAppToken,
    repo: str,
    session_id: str,
    pr_number: int,
    started_at: str,
    factory_login: str,
    watch_minutes: int,
) -> tuple[str, Optional[str]]:
    """Return the report to comment on the PR and the review's verdict, if it named one."""
    session, idle_event = wait_for_session(
        client=client,
        app_token=app_token,
        session_id=session_id,
        previous_idle_event_id=None,
        deadline=time.monotonic() + watch_minutes * 60,
    )
    if session is None:
        return (
            f"The factory's **review** session {format_session_link(session_id=session_id)} "
            f"is still running after {watch_minutes} minutes."
        ), None
    stop_reason = idle_event.stop_reason.type if idle_event else "terminated"
    # The PR comment is for the maintainer; how the session ran goes to the job log.
    print(f"stop_reason={stop_reason} cost={format_cost(session=session)}")
    review = find_factory_review(
        pr_number=pr_number, started_at=started_at, factory_login=factory_login
    )

    if review is None:
        return (
            f"The factory's **review** session {format_session_link(session_id=session_id)} "
            f"ended without posting a review (stop reason: `{stop_reason}`)."
        ), None
    try:
        resolved_count = resolve_reported_threads(
            repo=repo,
            pr_number=pr_number,
            review_body=review["body"] or "",
            factory_login=factory_login,
            token=app_token.refresh(),
        )
        print(f"resolved_threads={resolved_count}")
    except subprocess.CalledProcessError as error:
        # The verdict matters more than tidy threads; a maintainer can resolve them by hand.
        print(f"::warning::gh failed while resolving review threads: {error}: {error.stderr}")
    except (json.JSONDecodeError, KeyError, TypeError) as error:
        print(f"::warning::Unexpected GitHub response while resolving review threads: {error!r}")
    reviewed_sha = review["commit_id"][:10]
    session_link = format_session_link(session_id=session_id)
    verdict = read_verdict(review_body=review["body"] or "")
    for mismatch in find_marker_mismatches(review_body=review["body"] or ""):
        print(f"::warning::Review summary marker mismatch: {mismatch}")
    if verdict is None:
        return (
            f"The factory posted [its review of {reviewed_sha}]({review['html_url']}), but the "
            f"review's heading names no verdict (session {session_link})."
        ), None
    return (
        f"The factory recommends {VERDICT_LABELS[verdict].marker} **{verdict}** for "
        f"{reviewed_sha} and labeled this pull "
        f"request `{VERDICT_LABELS[verdict].name}`. [Read the review]({review['html_url']}) "
        f"· session {session_link}"
    ), verdict


def run_start(*, args: argparse.Namespace) -> None:
    pr = read_pr(pr_number=args.pr)
    # A workflow's GITHUB_TOKEN is not a maintainer, so turn away runs it starts.
    requester_login = args.requested_by
    requester_permission = (
        "none" if requester_login == WORKFLOW_LOGIN else read_repo_permission(login=requester_login)
    )
    admission_problem = find_admission_problem(
        pr=pr, requester_login=requester_login, requester_permission=requester_permission
    )
    print(f"head_sha={pr['headRefOid']} admission_problem={admission_problem}")
    if args.dry_run:
        return
    client = anthropic.Anthropic()
    app_token = create_app_token(client=client, repo=args.repo)
    if admission_problem is not None:
        comment_on_pr(
            pr_number=args.pr,
            body=(
                f"The factory skipped reviewing this pull request: {admission_problem}."
                f"{format_mention(login=requester_login)}"
            ),
            token=app_token.refresh(),
        )
        remove_review_label(pr_number=args.pr, token=app_token.refresh())
        write_github_outputs(started="false")
        return

    # Fail before starting a session that the watch step could not check.
    factory_login = read_factory_login()
    # A verdict from an earlier review describes an older commit, so drop it until this one ends.
    set_verdict_label(pr_number=args.pr, verdict=None, token=app_token.refresh())
    # Taken before the session exists, so every review it posts is submitted at or after it.
    started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    session_id = start_session(
        client=client,
        repo=args.repo,
        pr=pr,
        github_token=app_token.refresh(),
        factory_login=factory_login,
        budget_cents=args.budget_cents,
    )
    print(f"session_id={session_id}")
    status_comment_id = post_status_comment(
        number=args.pr,
        body=(
            f"The factory is reviewing {pr['headRefOid'][:10]} "
            f"(session {format_session_link(session_id=session_id)}). "
            f"It reports back here when the session ends."
            f"{format_mention(login=requester_login)}"
        ),
        token=app_token.refresh(),
    )
    write_github_outputs(
        started="true",
        requested_by=requester_login,
        session_id=session_id,
        started_at=started_at,
        status_comment_id=str(status_comment_id),
    )


def run_watch(*, args: argparse.Namespace) -> None:
    # Report on the PR even when watching fails; the error still fails the job.
    report = (
        f"The factory lost track of session {format_session_link(session_id=args.session_id)}; "
        "see the workflow run."
    )
    verdict: Optional[str] = None
    client = anthropic.Anthropic()
    app_token: Optional[GitHubAppToken] = None
    try:
        factory_login = read_factory_login()
        app_token = create_app_token(client=client, repo=args.repo)
        app_token.follow_session(session_id=args.session_id)
        report, verdict = watch_session(
            client=client,
            app_token=app_token,
            repo=args.repo,
            session_id=args.session_id,
            pr_number=args.pr,
            started_at=args.started_at,
            factory_login=factory_login,
            watch_minutes=args.watch_minutes,
        )
    finally:
        # The workflow's failure report skips a failed watch step, so when the app's
        # credentials are what failed, report with GITHUB_TOKEN instead.
        report_token: Optional[str] = None
        try:
            report_token = app_token.refresh() if app_token is not None else None
        except Exception as error:
            print(f"::warning::Reporting with GITHUB_TOKEN; the app token failed: {error}")
        try:
            # A verdict means the factory posted a review, which already notified the PR's
            # subscribers. Any other report is the only word that the run ended.
            report_on_status_comment(
                number=args.pr,
                comment_id=args.status_comment_id,
                body=report + format_mention(login=args.requested_by),
                token=report_token,
                notify=verdict is None,
            )
            set_verdict_label(pr_number=args.pr, verdict=verdict, token=report_token)
        finally:
            # Free the label even when reporting fails, so re-adding it runs the PR again.
            remove_review_label(pr_number=args.pr, token=report_token)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, help="owner/name, e.g. Arize-ai/phoenix")
    parser.add_argument("--pr", type=int, required=True)
    subparsers = parser.add_subparsers(dest="command", required=True)

    start_parser = subparsers.add_parser("start", help="Check the PR and start its review")
    start_parser.add_argument(
        "--requested-by", required=True, help="Login of whoever labeled or dispatched the PR"
    )
    start_parser.add_argument(
        "--budget-cents", type=int, default=1000, help="Session spend cap, USD cents"
    )
    start_parser.add_argument("--dry-run", action="store_true", help="Print the checks and exit")

    watch_parser = subparsers.add_parser("watch", help="Follow a review session to its report")
    watch_parser.add_argument("--session-id", required=True)
    watch_parser.add_argument(
        "--requested-by", default="", help="Login the run answers to, named in the report"
    )
    watch_parser.add_argument(
        "--started-at", required=True, help="UTC time the start step created the session"
    )
    watch_parser.add_argument(
        "--status-comment-id", type=int, help="The start step's comment, edited into the report"
    )
    watch_parser.add_argument("--watch-minutes", type=int, default=100)

    args = parser.parse_args()
    if args.command == "start":
        run_start(args=args)
    else:
        run_watch(args=args)


if __name__ == "__main__":
    main()
