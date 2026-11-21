# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Remind pull request authors to sign the CLA, and close the pull requests that never do.

The hourly sweep reads each open, non-draft pull request that is at least an hour old. When
the CLA Assistant's comment says the CLA is unsigned, it labels the pull request and posts
one reminder; when the CLA is still unsigned a day after that reminder, it closes the pull
request with a comment that says how to sign and that it can be reopened. When the CLA is
signed, it removes the label. It runs with the factory app's token, so every comment and
label comes from the app.
"""

import argparse
import json
import os
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

GRACE_PERIOD = timedelta(hours=1)
DEADLINE = timedelta(hours=24)
LABEL = "cla-unsigned"
LABEL_COLOR = "D4C5F9"
LABEL_DESCRIPTION = "The CLA is not signed; the factory closes the PR a day after reminding"
# Marks the reminder, so the sweep finds it again and measures the deadline from it.
REMINDER_MARKER = "<!-- factory-cla-check -->"
# The CLA Assistant edits one comment per pull request into its current conclusion. Logins
# are compared without the "[bot]" suffix REST adds and GraphQL leaves off.
CLA_BOT_LOGIN = "github-actions"
CLA_BOT_SIGNATURE = "CLA Assistant Lite bot"
CLA_SIGNED_TEXT = "All contributors have signed the CLA"
CLA_SIGN_SENTENCE = "I have read the CLA Document and I hereby sign the CLA"
PULL_REQUESTS_PER_PAGE = 100
COMMENTS_PER_PAGE = 100

# The CLA Assistant's comment names who still has to sign, and when a commit's author has
# no GitHub account, that posting the sentence is not enough; so both messages point to it.
HOW_TO_SIGN = (
    "The CLA Assistant's comment above names who still has to sign. For most contributors, "
    f"posting this comment is all it takes:\n\n> {CLA_SIGN_SENTENCE}"
)
REMINDER = (
    "The factory checked this pull request and the CLA is not signed yet. Every pull request "
    f"needs one. {HOW_TO_SIGN}\n\n"
    "A pull request whose CLA is still unsigned 24 hours from now is closed, and can be "
    f"reopened once it is signed.\n{REMINDER_MARKER}"
)
CLOSING = (
    "The factory closed this pull request because the CLA was still unsigned 24 hours after "
    f"the reminder. {HOW_TO_SIGN}\n\nThen reopen the pull request."
)

PULL_REQUESTS_QUERY = """
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: %d, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        isDraft
        createdAt
        author { login __typename }
        labels(first: 100) { nodes { name } }
        comments(first: %d) {
          totalCount
          nodes { databaseId author { login } body createdAt }
        }
      }
    }
  }
}
""" % (PULL_REQUESTS_PER_PAGE, COMMENTS_PER_PAGE)


def run_gh(*args: str, input_text: Optional[str] = None) -> str:
    completed_process = subprocess.run(
        ["gh", *args], capture_output=True, text=True, check=True, input=input_text
    )
    return completed_process.stdout


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def normalize_login(login: str) -> str:
    return login.removesuffix("[bot]")


def read_factory_login() -> str:
    factory_login = os.environ.get("FACTORY_GITHUB_LOGIN", "")
    if not factory_login:
        raise SystemExit(
            "Set the FACTORY_GITHUB_LOGIN repository variable to the factory app's bot login, "
            "such as arize-phoenix-factory[bot]."
        )
    return normalize_login(factory_login)


def list_open_pull_requests(*, repo: str) -> list[dict[str, Any]]:
    owner, name = repo.split("/")
    pull_requests: list[dict[str, Any]] = []
    cursor: Optional[str] = None
    while True:
        variables = {"owner": owner, "name": name, "cursor": cursor}
        page = json.loads(
            run_gh(
                "api",
                "graphql",
                "--input",
                "-",
                input_text=json.dumps({"query": PULL_REQUESTS_QUERY, "variables": variables}),
            )
        )["data"]["repository"]["pullRequests"]
        pull_requests.extend(page["nodes"])
        if not page["pageInfo"]["hasNextPage"]:
            return pull_requests
        cursor = page["pageInfo"]["endCursor"]


def read_all_comments(*, pr: dict[str, Any]) -> list[dict[str, Any]]:
    """The pull request's comments; the listing holds the first page, so page through the
    rest only when there are more."""
    if pr["comments"]["totalCount"] <= COMMENTS_PER_PAGE:
        first_page: list[dict[str, Any]] = pr["comments"]["nodes"]
        return first_page
    comment_lines = run_gh(
        "api",
        "--paginate",
        f"repos/{{owner}}/{{repo}}/issues/{pr['number']}/comments",
        "--jq",
        ".[] | {databaseId: .id, author: {login: .user.login}, body: .body, "
        "createdAt: .created_at}",
    )
    return [json.loads(line) for line in comment_lines.splitlines() if line]


def is_in_scope(*, pr: dict[str, Any], now: datetime) -> bool:
    author = pr["author"]
    if author is None or author["__typename"] == "Bot" or pr["isDraft"]:
        return False
    return parse_timestamp(pr["createdAt"]) <= now - GRACE_PERIOD


def is_written_by(*, comment: dict[str, Any], login: str) -> bool:
    author = comment["author"]
    return author is not None and normalize_login(author["login"]) == login


def read_cla_signed(*, comments: list[dict[str, Any]]) -> Optional[bool]:
    """Whether the CLA Assistant says every contributor signed; None when it never ran."""
    for comment in reversed(comments):
        if is_written_by(comment=comment, login=CLA_BOT_LOGIN) and (
            CLA_BOT_SIGNATURE in comment["body"]
        ):
            return CLA_SIGNED_TEXT in comment["body"]
    return None


def find_reminder(
    *, comments: list[dict[str, Any]], factory_login: str
) -> Optional[dict[str, Any]]:
    """The factory's own reminder; a marker anyone else posted does not count."""
    for comment in comments:
        if is_written_by(comment=comment, login=factory_login) and (
            REMINDER_MARKER in comment["body"]
        ):
            return comment
    return None


def remind(*, pr_number: int) -> None:
    # Create or update the label on use, so a repo never lacks it.
    run_gh(
        "label",
        "create",
        LABEL,
        "--color",
        LABEL_COLOR,
        "--description",
        LABEL_DESCRIPTION,
        "--force",
    )
    run_gh("pr", "edit", str(pr_number), "--add-label", LABEL)
    run_gh("pr", "comment", str(pr_number), "--body-file", "-", input_text=REMINDER)


def delete_comment(*, comment_id: int) -> None:
    run_gh("api", "--method", "DELETE", f"repos/{{owner}}/{{repo}}/issues/comments/{comment_id}")


def check_pull_request(*, pr: dict[str, Any], now: datetime, factory_login: str) -> str:
    """Bring the pull request's label and state in line with its CLA; return what was done."""
    pr_number = pr["number"]
    comments = read_all_comments(pr=pr)
    signed = read_cla_signed(comments=comments)
    has_label = any(label["name"] == LABEL for label in pr["labels"]["nodes"])
    reminder = find_reminder(comments=comments, factory_login=factory_login)
    if signed is None:
        return "unknown"
    if signed:
        if has_label:
            run_gh("pr", "edit", str(pr_number), "--remove-label", LABEL)
            # The reminder goes too, so a CLA that turns unsigned again (a new commit by an
            # unlinked author) gets a fresh reminder and deadline, while a label a maintainer
            # removed still leaves the reminder behind as the mark of an exemption.
            if reminder is not None:
                delete_comment(comment_id=reminder["databaseId"])
            return "label removed"
        return "signed"
    if reminder is None:
        remind(pr_number=pr_number)
        return "reminded"
    if not has_label:
        # A maintainer took the label off after the reminder, which exempts the pull request.
        return "exempt"
    if now - parse_timestamp(reminder["createdAt"]) < DEADLINE:
        return "waiting"
    run_gh("pr", "close", str(pr_number), "--comment", CLOSING)
    return "closed"


def sweep(*, repo: str, now: datetime, factory_login: str) -> None:
    for pr in list_open_pull_requests(repo=repo):
        if is_in_scope(pr=pr, now=now):
            result = check_pull_request(pr=pr, now=now, factory_login=factory_login)
            print(f"#{pr['number']}: {result}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=os.environ.get("GH_REPO"), help="owner/name")
    args = parser.parse_args()
    if not args.repo:
        raise SystemExit("Pass --repo or set GH_REPO.")
    sweep(repo=args.repo, now=datetime.now(timezone.utc), factory_login=read_factory_login())


if __name__ == "__main__":
    main()
