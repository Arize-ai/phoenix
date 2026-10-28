"""Run one Phoenix pull request through the factory's review lane.

`start` checks that the PR is open and that whoever asked has write access, then creates a
Managed Agents session with the pr-reviewer agent, kicked off with the PR number and the
commit to review. `watch` waits for the session to end, finds the review it posted, and
reports that review's verdict on the PR. Agent, environment and vault IDs come from
claude-lock.json, which `ant apply` writes.
"""

import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
from dispatch import (
    ENVIRONMENT_LOCK_KEY,
    LOCK_FILE_PATH,
    STARTING_PERMISSIONS,
    WORKFLOW_LOGIN,
    create_app_token,
    format_cost,
    format_session_link,
    read_lock_id,
    read_repo_permission,
    read_vault_ids,
    run_gh,
    wait_for_session,
    write_github_outputs,
)
from github_app import GitHubAppToken

REVIEW_LABEL = "factory-review"
REVIEW_AGENT_LOCK_KEY = "./agents/pr-reviewer.md"
# The verdict in the review summary's heading, its first line, per agents/pr-reviewer.md.
VERDICT_PATTERN = re.compile(r"## Factory review of \S+: (Approve|Request changes|Close)")


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
    budget_cents: int,
) -> str:
    lock = json.loads(LOCK_FILE_PATH.read_text())
    head_sha = pr["headRefOid"]
    # Keep untrusted PR text (title, body, comments) out of the prompt; the agent reads it
    # through the GitHub MCP server.
    kickoff_text = (
        f"Review pull request #{pr['number']} in {repo}. Review commit {head_sha}, the head of "
        f"{describe_head(pr=pr)}, against base branch {pr['baseRefName']}. "
        f"Read the PR with pull_request_read. Fetch its commits with "
        f"`git fetch origin {pr['baseRefName']} pull/{pr['number']}/head` and check out "
        f"{head_sha} before you run anything."
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


def read_verdict(*, review_body: str) -> Optional[str]:
    heading = review_body.lstrip().split("\n", 1)[0].rstrip()
    verdict_match = VERDICT_PATTERN.fullmatch(heading)
    return verdict_match.group(1) if verdict_match else None


def watch_session(
    *,
    client: anthropic.Anthropic,
    app_token: GitHubAppToken,
    session_id: str,
    pr_number: int,
    started_at: str,
    factory_login: str,
    watch_minutes: int,
) -> str:
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
        )
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
        )
    reviewed_sha = review["commit_id"][:10]
    verdict = read_verdict(review_body=review["body"] or "")
    if verdict is None:
        return (
            f"The factory posted [its review of {reviewed_sha}]({review['html_url']}), but the "
            "review's heading names no verdict."
        )
    return (
        f"The factory recommends **{verdict}** for {reviewed_sha}. "
        f"[Read the review]({review['html_url']})."
    )


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
            body=f"The factory skipped reviewing this pull request: {admission_problem}.",
            token=app_token.refresh(),
        )
        remove_review_label(pr_number=args.pr, token=app_token.refresh())
        write_github_outputs(started="false")
        return

    # Fail before starting a session that the watch step could not check.
    read_factory_login()
    # Taken before the session exists, so every review it posts is submitted at or after it.
    started_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    session_id = start_session(
        client=client,
        repo=args.repo,
        pr=pr,
        github_token=app_token.refresh(),
        budget_cents=args.budget_cents,
    )
    print(f"session_id={session_id}")
    comment_on_pr(
        pr_number=args.pr,
        body=(
            f"The factory started a **review** of {pr['headRefOid'][:10]} "
            f"(session {format_session_link(session_id=session_id)}). "
            f"It reports back here when the session ends."
        ),
        token=app_token.refresh(),
    )
    write_github_outputs(started="true", session_id=session_id, started_at=started_at)


def run_watch(*, args: argparse.Namespace) -> None:
    # Report on the PR even when watching fails; the error still fails the job.
    report = (
        f"The factory lost track of session {format_session_link(session_id=args.session_id)}; "
        "see the workflow run."
    )
    client = anthropic.Anthropic()
    app_token: Optional[GitHubAppToken] = None
    try:
        factory_login = read_factory_login()
        app_token = create_app_token(client=client, repo=args.repo)
        app_token.follow_session(session_id=args.session_id)
        report = watch_session(
            client=client,
            app_token=app_token,
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
        comment_on_pr(pr_number=args.pr, body=report, token=report_token)
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
        "--started-at", required=True, help="UTC time the start step created the session"
    )
    watch_parser.add_argument("--watch-minutes", type=int, default=100)

    args = parser.parse_args()
    if args.command == "start":
        run_start(args=args)
    else:
        run_watch(args=args)


if __name__ == "__main__":
    main()
