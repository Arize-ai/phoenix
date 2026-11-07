# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "anthropic==1.12.1",
#     "PyJWT[crypto]==2.15.1",
# ]
# ///

import argparse
import base64
import json
import os
import re
import subprocess
from typing import Any, Optional

import anthropic
from cla_check import read_cla_signed
from dispatch import (
    ENVIRONMENT_LOCK_KEY,
    FACTORY_DIR,
    LOCK_FILE_PATH,
    STARTING_PERMISSIONS,
    WORKFLOW_LOGIN,
    create_app_token,
    format_mention,
    format_session_link,
    post_status_comment,
    read_lock_id,
    read_noreply_email,
    read_repo_permission,
    read_vault_ids,
    report_on_status_comment,
    run_gh,
    watch_session,
    write_github_outputs,
)
from github_app import GitHubAppToken
from review import comment_on_pr, read_factory_login

FINISH_LABEL = "factory-finish"
# The job and workflow names in cla.yml, which runs on pull_request_target from the base.
CLA_CHECK_NAME = "CLAAssistant"
CLA_WORKFLOW_NAME = "CLA Assistant"
# Stays on a PR the factory pushed to, so Factory Guard treats every later head as factory
# work; `github.actor` would only cover the app's own pushes.
FINISHED_LABEL = "factory-finished"
FINISHED_LABEL_COLOR = "5319E7"
FINISHED_LABEL_DESCRIPTION = "The factory pushed commits to this pull request"
FINISH_AGENT_LOCK_KEY = "./agents/pr-finisher.md"
FINISH_OUTCOME = (
    "Pull request #{pr_number} links an issue, has every review finding fixed, passes the "
    "checks for the areas it touches and carries one comment to its author describing what "
    "changed; or it is closed with the reason and its issue is labeled `factory` for the "
    "issue lane."
)
PR_FIELDS = (
    "number,url,state,isDraft,isCrossRepository,baseRefName,headRefName,headRefOid,"
    "title,body,author,comments,closingIssuesReferences"
)


def read_pr(*, pr_number: int, token: Optional[str] = None) -> dict[str, Any]:
    pr: dict[str, Any] = json.loads(
        run_gh("pr", "view", str(pr_number), "--json", PR_FIELDS, token=token)
    )
    return pr


def find_open_pr(*, pr_number: int) -> Optional[dict[str, Any]]:
    pr = json.loads(
        run_gh("pr", "view", str(pr_number), "--json", "number,url,headRefOid,isDraft,state")
    )
    return pr if pr["state"] == "OPEN" else None


def add_finished_label(*, pr_number: int, token: Optional[str]) -> None:
    run_gh(
        "label",
        "create",
        FINISHED_LABEL,
        "--color",
        FINISHED_LABEL_COLOR,
        "--description",
        FINISHED_LABEL_DESCRIPTION,
        "--force",
        token=token,
    )
    run_gh("pr", "edit", str(pr_number), "--add-label", FINISHED_LABEL, token=token)


def remove_finish_label(*, pr_number: int, token: Optional[str]) -> None:
    run_gh("pr", "edit", str(pr_number), "--remove-label", FINISH_LABEL, token=token)


def find_admission_problem(
    *,
    pr: dict[str, Any],
    copy: Optional[dict[str, Any]],
    requester_login: str,
    requester_permission: str,
) -> Optional[str]:
    """`copy` is an earlier run's open copy of a fork PR; with one, a closed original is
    admissible and the run continues on the copy."""
    if requester_permission not in STARTING_PERMISSIONS:
        return f"`{requester_login}` needs write access to this repository to start it"
    if pr["state"] != "OPEN" and copy is None:
        return f"the pull request is {pr['state'].lower()}"
    # Someone who pushed a branch to this repository has write access, so a same-repo PR
    # passes without a CLA check.
    if not pr["isCrossRepository"]:
        return None
    # The Assistant comments only when someone has to sign, so its check is the record every
    # fork PR has; the comments are the fallback.
    cla_signed = read_cla_status(pr_number=pr["number"])
    if cla_signed is None:
        cla_signed = read_cla_signed(comments=pr["comments"])
    if cla_signed is None:
        return "the CLA Assistant has not checked it yet; try again once its check has run"
    if not cla_signed:
        return "its CLA is not signed; the factory starts once the CLA Assistant says it is"
    if copy is None and changes_guarded_paths(pr=pr):
        return (
            "it changes automation or agent-instruction files, which Factory Guard fails on a "
            "factory branch; a maintainer has to finish it by hand"
        )
    return None


# The paths factory-guard.yml fails a factory PR for. Copying a fork PR that changes one of
# them would only open a PR that can never pass that check, and would hand fork-written
# factory config to factory-sync.yml's plan job, which holds the workspace's API key.
GUARDED_PATH_PATTERN = re.compile(
    r"^(\.github|\.cursor|\.claude|\.agents|factory|plugins)/|(^|/)(AGENTS|CLAUDE)\.md$"
)


def changes_guarded_paths(*, pr: dict[str, Any]) -> bool:
    # Paged through the REST API: `gh pr view --json files` stops at 100 files.
    paths = run_gh(
        "api",
        "--paginate",
        f"repos/{{owner}}/{{repo}}/pulls/{pr['number']}/files",
        "--jq",
        ".[] | .filename, (.previous_filename // empty)",
    ).split()
    return any(GUARDED_PATH_PATTERN.search(path) for path in paths)


def read_cla_status(*, pr_number: int) -> Optional[bool]:
    """None when the check is missing or still pending."""
    checks = json.loads(run_gh("pr", "checks", str(pr_number), "--json", "name,bucket,workflow"))
    buckets = {
        check["bucket"]
        for check in checks
        if check["name"] == CLA_CHECK_NAME and check["workflow"] == CLA_WORKFLOW_NAME
    }
    # A fork PR can add a workflow whose job shares these names, but it cannot remove the
    # real run, so a failing or pending run outweighs a passing one.
    if "fail" in buckets:
        return False
    if "pending" in buckets or "pass" not in buckets:
        return None
    return True


def copy_branch_name(*, pr_number: int) -> str:
    return f"factory/pr-{pr_number}"


def find_copy(*, pr_number: int) -> Optional[dict[str, Any]]:
    """An earlier run's open copy of a fork PR."""
    pr_list = json.loads(
        run_gh(
            "pr",
            "list",
            "--head",
            copy_branch_name(pr_number=pr_number),
            "--state",
            "open",
            "--json",
            "number,isCrossRepository",
        )
    )
    # `--head` matches the branch name on any fork too, and anyone can name a fork branch
    # `factory/pr-N`; only a branch in this repository is the factory's copy.
    for candidate in pr_list:
        if not candidate["isCrossRepository"]:
            return read_pr(pr_number=candidate["number"])
    return None


def run_git_as_app(*args: str, token: str) -> None:
    """Run git against github.com with the app token in a header set through the environment,
    so the token is in neither argv nor the error a failed command raises."""
    basic = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    env = {
        **os.environ,
        "GIT_CONFIG_COUNT": "1",
        "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
        "GIT_CONFIG_VALUE_0": f"AUTHORIZATION: basic {basic}",
    }
    try:
        subprocess.run(["git", *args], check=True, env=env)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"git {args[0]} exited with {error.returncode}") from None


def copy_fork_pr(*, repo: str, pr: dict[str, Any], token: str) -> dict[str, Any]:
    """Push the fork PR's head to a branch here, open a PR from it, close the original.

    The commits are pushed as they are, so their authorship is the contributor's, and the
    runner only moves objects: it never checks out or runs the fork's code.
    """
    pr_number = pr["number"]
    branch = copy_branch_name(pr_number=pr_number)
    remote = f"https://github.com/{repo}.git"
    run_git_as_app("fetch", "--quiet", remote, f"pull/{pr_number}/head", token=token)
    run_git_as_app("push", "--quiet", remote, f"FETCH_HEAD:refs/heads/{branch}", token=token)
    body = (pr["body"] or "").rstrip() + (
        f"\n\n---\nContinued from #{pr_number} by the factory. The commits are "
        f"@{pr['author']['login']}'s; the factory adds its own on top."
    )
    copy_url = run_gh(
        "pr",
        "create",
        "--head",
        branch,
        "--base",
        pr["baseRefName"],
        "--title",
        pr["title"],
        "--body-file",
        "-",
        "--draft",
        token=token,
        input_text=body,
    ).strip()
    copy_number = int(copy_url.rsplit("/", 1)[1])
    run_gh(
        "pr",
        "close",
        str(pr_number),
        "--comment",
        f"The factory is finishing this pull request as #{copy_number}, on a branch in this "
        "repository, because it cannot push to a fork. Your commits and their authorship are "
        "kept there, and the factory adds its own on top. Follow along on that pull request.",
        token=token,
    )
    return read_pr(pr_number=copy_number, token=token)


def start_session(
    *,
    client: anthropic.Anthropic,
    repo: str,
    pr: dict[str, Any],
    requester_login: str,
    github_token: str,
    git_author_name: str,
    git_author_email: str,
    budget_cents: int,
) -> str:
    lock = json.loads(LOCK_FILE_PATH.read_text())
    rubric_text = (FACTORY_DIR / "rubrics" / "finish.md").read_text()
    issue_numbers = [issue["number"] for issue in pr["closingIssuesReferences"]]
    issue_text = (
        "It links issue " + ", ".join(f"#{number}" for number in issue_numbers) + "."
        if issue_numbers
        else "It links no issue."
    )
    # Only numbers, branch names and maintainer-set values go in the prompt; the agent
    # reads the untrusted PR text itself through the GitHub MCP server.
    kickoff_text = (
        f"Finish pull request #{pr['number']} in {repo}. {issue_text} The repo is checked out "
        f"on its branch {pr['headRefName']}, which targets {pr['baseRefName']}. Read it with "
        f"pull_request_read. `{requester_login}` asked for this run. "
        f"Commit as {git_author_name} <{git_author_email}>: before your first commit, run "
        f'`git config user.name "{git_author_name}"` and '
        f'`git config user.email "{git_author_email}"`.'
    )
    session = client.beta.sessions.create(
        agent=read_lock_id(lock=lock, lock_key=FINISH_AGENT_LOCK_KEY),
        environment_id=read_lock_id(lock=lock, lock_key=ENVIRONMENT_LOCK_KEY),
        vault_ids=read_vault_ids(lock=lock),
        title=f"finish: {repo}#{pr['number']}",
        metadata={"repo": repo, "pr": str(pr["number"]), "lane": "finish"},
        budget={
            "type": "limit",
            "max_list_cost": {"amount": str(budget_cents), "currency": "USD"},
        },
        resources=[
            {
                "type": "github_repository",
                "url": f"https://github.com/{repo}",
                "authorization_token": github_token,
                "checkout": {"type": "branch", "name": pr["headRefName"]},
            }
        ],
        initial_events=[
            {"type": "user.message", "content": [{"type": "text", "text": kickoff_text}]},
            {
                "type": "user.define_outcome",
                "description": FINISH_OUTCOME.format(pr_number=pr["number"]),
                "rubric": {"type": "text", "content": rubric_text},
                "max_iterations": 3,
            },
        ],
    )
    return session.id


def run_start(*, args: argparse.Namespace) -> None:
    pr = read_pr(pr_number=args.pr)
    # A workflow's GITHUB_TOKEN is not a maintainer, so turn away runs it starts.
    requester_login = args.requested_by
    requester_permission = (
        "none" if requester_login == WORKFLOW_LOGIN else read_repo_permission(login=requester_login)
    )
    copy = find_copy(pr_number=args.pr) if pr["isCrossRepository"] else None
    admission_problem = find_admission_problem(
        pr=pr,
        copy=copy,
        requester_login=requester_login,
        requester_permission=requester_permission,
    )
    print(
        f"head_sha={pr['headRefOid']} fork={pr['isCrossRepository']} "
        f"copy={copy['number'] if copy else None} admission_problem={admission_problem}"
    )
    if args.dry_run:
        return
    client = anthropic.Anthropic()
    app_token = create_app_token(client=client, repo=args.repo)
    if admission_problem is not None:
        comment_on_pr(
            pr_number=args.pr,
            body=(
                f"The factory skipped finishing this pull request: {admission_problem}."
                f"{format_mention(login=requester_login)}"
            ),
            token=app_token.refresh(),
        )
        remove_finish_label(pr_number=args.pr, token=app_token.refresh())
        write_github_outputs(started="false")
        return

    # Fail before starting a session that the watch step could not check.
    factory_login = read_factory_login()
    if pr["isCrossRepository"]:
        if copy is None:
            copy = copy_fork_pr(repo=args.repo, pr=pr, token=app_token.refresh())
            print(f"copied to #{copy['number']} on {copy['headRefName']}")
        else:
            print(f"continuing the earlier copy #{copy['number']}")
        # The run reports on the copy, so the label on the original has done its job.
        remove_finish_label(pr_number=args.pr, token=app_token.refresh())
        pr = copy
    # Before the session can push, so no head of the PR is ever CI'd as a human's work.
    add_finished_label(pr_number=pr["number"], token=app_token.refresh())
    session_id = start_session(
        client=client,
        repo=args.repo,
        pr=pr,
        requester_login=requester_login,
        github_token=app_token.refresh(),
        git_author_name=factory_login,
        git_author_email=read_noreply_email(login=factory_login),
        budget_cents=args.budget_cents,
    )
    print(f"session_id={session_id}")
    status_comment_id = post_status_comment(
        number=pr["number"],
        body=(
            f"The factory is finishing this pull request from {pr['headRefOid'][:10]} "
            f"(session {format_session_link(session_id=session_id)}). "
            f"It reports back here when the session ends."
            f"{format_mention(login=requester_login)}"
        ),
        token=app_token.refresh(),
    )
    write_github_outputs(
        started="true",
        requested_by=requester_login,
        pr=str(pr["number"]),
        session_id=session_id,
        status_comment_id=str(status_comment_id),
    )


def run_watch(*, args: argparse.Namespace) -> None:
    # Report on the PR even when watching fails; the error still fails the job.
    report = (
        f"The factory lost track of session {format_session_link(session_id=args.session_id)}; "
        "see the workflow run."
    )
    client = anthropic.Anthropic()
    app_token: Optional[GitHubAppToken] = None
    try:
        app_token = create_app_token(client=client, repo=args.repo)
        app_token.follow_session(session_id=args.session_id)
        report = watch_session(
            client=client,
            session_id=args.session_id,
            lane="finish",
            find_pr=lambda: find_open_pr(pr_number=args.pr),
            app_token=app_token,
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
        report_on_status_comment(
            number=args.pr,
            comment_id=args.status_comment_id,
            body=report + format_mention(login=args.requested_by),
            token=report_token,
            notify=True,
        )
        # A closed PR keeps its labels, and `gh pr edit` works on it either way.
        remove_finish_label(pr_number=args.pr, token=report_token)


def main() -> None:
    parser = argparse.ArgumentParser(description="Finish a labeled pull request")
    parser.add_argument("--repo", required=True, help="owner/name, e.g. Arize-ai/phoenix")
    parser.add_argument("--pr", type=int, required=True)
    subparsers = parser.add_subparsers(dest="command", required=True)

    start_parser = subparsers.add_parser("start", help="Check the PR and start its session")
    start_parser.add_argument(
        "--requested-by", required=True, help="Login of whoever labeled or dispatched the PR"
    )
    start_parser.add_argument(
        "--budget-cents", type=int, default=2500, help="Session spend cap, USD cents"
    )
    start_parser.add_argument("--dry-run", action="store_true", help="Print the checks and exit")

    watch_parser = subparsers.add_parser("watch", help="Follow a session to a mergeable PR")
    watch_parser.add_argument("--session-id", required=True)
    watch_parser.add_argument(
        "--requested-by", default="", help="Login the run answers to, named in the report"
    )
    watch_parser.add_argument(
        "--status-comment-id", type=int, help="The start step's comment, edited into the report"
    )
    watch_parser.add_argument("--watch-minutes", type=int, default=270)

    args = parser.parse_args()
    if args.command == "start":
        run_start(args=args)
    else:
        run_watch(args=args)


if __name__ == "__main__":
    main()
