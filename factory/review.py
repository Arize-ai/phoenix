"""Run one Phoenix pull request through the factory's review lane.

`start` checks that the PR is open and that whoever asked has write access, then creates a
Managed Agents session with the pr-reviewer agent, kicked off with the PR number and the
commit to review and graded against rubrics/review.md. `watch` waits for the session to end,
checks that it left a review on that commit, and reports the result on the PR. Agent,
environment and vault IDs come from claude-lock.json, which `ant apply` writes.
"""

import argparse
import json
import os
import time
from typing import Any, Optional

import anthropic
from dispatch import (
    ENVIRONMENT_LOCK_KEY,
    FACTORY_DIR,
    LOCK_FILE_PATH,
    STARTING_PERMISSIONS,
    WORKFLOW_LOGIN,
    format_cost,
    format_session_link,
    read_lock_id,
    read_repo_permission,
    read_vault_ids,
    run_gh,
    wait_for_session,
    write_github_outputs,
)

REVIEW_LABEL = "factory-review"
REVIEW_AGENT_LOCK_KEY = "./agents/pr-reviewer.md"
REVIEW_RUBRIC_PATH = FACTORY_DIR / "rubrics" / "review.md"
REVIEW_OUTCOME = (
    "One review on pull request #{pr_number} in {repo}, submitted as a comment on commit "
    "{head_sha}, with verified findings as inline comments and the review summary as its body."
)


def read_pr(*, pr_number: int) -> dict[str, Any]:
    return json.loads(
        run_gh(
            "pr",
            "view",
            str(pr_number),
            "--json",
            "number,state,url,isDraft,isCrossRepository,baseRefName,headRefName,headRefOid,"
            "headRepository,headRepositoryOwner,author",
        )
    )


def comment_on_pr(*, pr_number: int, body: str) -> None:
    run_gh("pr", "comment", str(pr_number), "--body-file", "-", input_text=body)


def remove_review_label(*, pr_number: int) -> None:
    """Remove the trigger label so a maintainer can re-add it to review the PR again."""
    run_gh("pr", "edit", str(pr_number), "--remove-label", REVIEW_LABEL)


def find_admission_problem(
    *, pr: dict[str, Any], requester_login: str, requester_permission: str
) -> Optional[str]:
    """Return why the PR shouldn't be reviewed now, or None if it can."""
    if requester_permission not in STARTING_PERMISSIONS:
        return f"`{requester_login}` needs write access to this repository to start it"
    if pr["state"] != "OPEN":
        return f"the pull request is {pr['state'].lower()}"
    return None


def describe_head(*, pr: dict[str, Any]) -> str:
    """Name where the PR's commits live, so the agent knows it is reviewing a fork."""
    if not pr["isCrossRepository"]:
        return f"branch {pr['headRefName']} of this repository"
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
    """Create the review session, kicked off with the PR number and the commit to review."""
    lock = json.loads(LOCK_FILE_PATH.read_text())
    head_sha = pr["headRefOid"]
    # Only values GitHub reports about the PR go in the prompt; the agent reads the untrusted
    # title, body, comments and diff itself through the GitHub MCP server.
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
                # The PR's commits may be on a fork, so the agent fetches pull/N/head itself.
                "checkout": {"type": "branch", "name": pr["baseRefName"]},
            }
        ],
        initial_events=[
            {"type": "user.message", "content": [{"type": "text", "text": kickoff_text}]},
            {
                "type": "user.define_outcome",
                "description": REVIEW_OUTCOME.format(
                    pr_number=pr["number"], repo=repo, head_sha=head_sha[:10]
                ),
                "rubric": {"type": "text", "content": REVIEW_RUBRIC_PATH.read_text()},
                "max_iterations": 2,
            },
        ],
    )
    return session.id


def find_factory_review(*, pr_number: int, head_sha: str, factory_login: str) -> Optional[str]:
    """Return the URL of the machine account's review of `head_sha`, if it posted one."""
    review_lines = run_gh(
        "api", "--paginate", f"repos/{{owner}}/{{repo}}/pulls/{pr_number}/reviews", "--jq", ".[]"
    ).splitlines()
    for review_line in reversed([line for line in review_lines if line]):
        review = json.loads(review_line)
        if review["user"]["login"] == factory_login and review["commit_id"] == head_sha:
            return review["html_url"]
    return None


def watch_session(
    *,
    client: anthropic.Anthropic,
    session_id: str,
    pr_number: int,
    head_sha: str,
    factory_login: str,
    watch_minutes: int,
) -> str:
    """Wait for the review session to end and return the PR comment that reports it."""
    session, idle_event = wait_for_session(
        client=client,
        session_id=session_id,
        previous_idle_event_id=None,
        deadline=time.monotonic() + watch_minutes * 60,
    )
    if session is None:
        return (
            f"🏭 The factory's **review** session {format_session_link(session_id=session_id)} "
            f"is still running after {watch_minutes} minutes."
        )
    latest_outcome = session.outcome_evaluations[-1] if session.outcome_evaluations else None
    outcome_result = latest_outcome.result if latest_outcome else "not graded"
    stop_reason = idle_event.stop_reason.type if idle_event else "terminated"
    review_url = find_factory_review(
        pr_number=pr_number, head_sha=head_sha, factory_login=factory_login
    )

    # Same outcomes as the build lanes: `success` is for a human to read, `flawed` means
    # the agent did the wrong thing, `blocked` means the run lacked budget, time or access.
    if stop_reason != "end_turn":
        run_outcome = "blocked"
    elif review_url is not None and outcome_result == "satisfied":
        run_outcome = "success"
    else:
        run_outcome = "flawed"
    if review_url is None:
        status_line = f"ended without posting a review of {head_sha[:10]}"
    else:
        status_line = f"posted [its review of {head_sha[:10]}]({review_url})"

    report_lines = [
        f"🏭 The factory's **review** session {format_session_link(session_id=session_id)} "
        f"{status_line}.",
        "",
        f"Outcome: **{run_outcome}** · rubric: `{outcome_result}` · "
        f"stop reason: `{stop_reason}` · "
        f"cost: {format_cost(session=client.beta.sessions.retrieve(session_id))}",
    ]
    if latest_outcome is not None and outcome_result != "satisfied" and latest_outcome.explanation:
        report_lines += [
            "",
            "<details><summary>Grader explanation</summary>",
            "",
            latest_outcome.explanation,
            "",
            "</details>",
        ]
    return "\n".join(report_lines)


def run_start(*, args: argparse.Namespace) -> None:
    pr = read_pr(pr_number=args.pr)
    # A run that a workflow dispatched with its GITHUB_TOKEN answers to nobody with write
    # access, so it is turned away; a maintainer labels or dispatches the PR instead.
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
    if admission_problem is not None:
        comment_on_pr(
            pr_number=args.pr,
            body=f"🏭 The factory skipped reviewing this pull request: {admission_problem}.",
        )
        remove_review_label(pr_number=args.pr)
        write_github_outputs(started="false")
        return

    session_id = start_session(
        client=anthropic.Anthropic(),
        repo=args.repo,
        pr=pr,
        github_token=os.environ["FACTORY_GITHUB_TOKEN"],
        budget_cents=args.budget_cents,
    )
    print(f"session_id={session_id}")
    comment_on_pr(
        pr_number=args.pr,
        body=(
            f"🏭 The factory started a **review** of {pr['headRefOid'][:10]} "
            f"(session {format_session_link(session_id=session_id)}). "
            f"It reports back here when the session ends."
        ),
    )
    write_github_outputs(started="true", session_id=session_id, head_sha=pr["headRefOid"])


def run_watch(*, args: argparse.Namespace) -> None:
    factory_login = os.environ.get("FACTORY_LOGIN", "")
    if not factory_login:
        raise SystemExit(
            "Set the FACTORY_LOGIN repository variable, not a secret, to the machine account login."
        )
    # Report on the PR even when watching fails; the error still fails the job.
    report = (
        f"🏭 The factory lost track of session {format_session_link(session_id=args.session_id)}; "
        "see the workflow run."
    )
    try:
        report = watch_session(
            client=anthropic.Anthropic(),
            session_id=args.session_id,
            pr_number=args.pr,
            head_sha=args.head_sha,
            factory_login=factory_login,
            watch_minutes=args.watch_minutes,
        )
    finally:
        comment_on_pr(pr_number=args.pr, body=report)
        remove_review_label(pr_number=args.pr)


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
    watch_parser.add_argument("--head-sha", required=True, help="The commit the session reviews")
    watch_parser.add_argument("--watch-minutes", type=int, default=100)

    args = parser.parse_args()
    if args.command == "start":
        run_start(args=args)
    else:
        run_watch(args=args)


if __name__ == "__main__":
    main()
