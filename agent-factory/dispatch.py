"""Start an agent-factory session for one Phoenix issue.

Routes the issue to a lane from its triage labels, then creates a Managed Agents
session that mounts the repo and grades the lane's rubric as the session outcome.
Agent, environment and vault IDs come from claude-lock.json, which `ant apply` writes.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

import anthropic

FACTORY_DIR = Path(__file__).resolve().parent
LOCK_FILE_PATH = FACTORY_DIR / "claude-lock.json"
ENVIRONMENT_LOCK_KEY = "./environments/phoenix-dev.yaml"
VAULT_LOCK_KEY = "./vaults/github.yaml"
REPO_MOUNT_PATH = "/workspace/phoenix"

LANE_AGENT_LOCK_KEYS = {
    "docs": "./agents/docs-writer.md",
    "bug": "./agents/bug-fixer.md",
    "feature": "./agents/feature-builder.md",
}
LANE_OUTCOMES = {
    "docs": "A draft PR that makes the documentation change issue #{issue_number} asks for.",
    "bug": (
        "A draft PR that fixes issue #{issue_number} with a regression test, or, if the bug "
        "cannot be reproduced, a comment on the issue explaining what was tried."
    ),
    "feature": (
        "A draft PR that implements issue #{issue_number}, or, if it needs a product "
        "decision first, a comment on the issue listing the open questions."
    ),
}


def select_lane(*, label_names: list[str]) -> Optional[str]:
    """Pick the factory lane from the issue's triage labels, or None if it is untyped."""
    if "documentation" in label_names:
        return "docs"
    if "bug" in label_names:
        return "bug"
    if "enhancement" in label_names:
        return "feature"
    return None


def read_lock_id(*, lock: dict, lock_key: str) -> str:
    """Return the resource ID that `ant apply` recorded for a factory file."""
    try:
        return lock["resources"][lock_key]["id"]
    except KeyError:
        raise SystemExit(
            f"{lock_key} is missing from {LOCK_FILE_PATH.name}; run `ant apply` first."
        ) from None


def start_session(
    *,
    client: anthropic.Anthropic,
    lane: str,
    repo: str,
    issue_number: int,
    label_names: list[str],
    github_token: str,
    budget_cents: int,
) -> str:
    """Create the lane's session, kicked off with the issue and the lane's outcome."""
    lock = json.loads(LOCK_FILE_PATH.read_text())
    rubric_text = (FACTORY_DIR / "rubrics" / f"{lane}.md").read_text()
    # Only the issue number and maintainer-set labels go in the prompt; the agent
    # reads the untrusted issue text itself through the GitHub MCP server.
    kickoff_text = (
        f"Work on GitHub issue #{issue_number} in {repo}. "
        f"Its triage labels are: {', '.join(label_names)}. "
        f"Read it with issue_read. Use branch factory/issue-{issue_number}."
    )
    session = client.beta.sessions.create(
        agent=read_lock_id(lock=lock, lock_key=LANE_AGENT_LOCK_KEYS[lane]),
        environment_id=read_lock_id(lock=lock, lock_key=ENVIRONMENT_LOCK_KEY),
        vault_ids=[read_lock_id(lock=lock, lock_key=VAULT_LOCK_KEY)],
        title=f"{lane}: {repo}#{issue_number}",
        metadata={"repo": repo, "issue": str(issue_number), "lane": lane},
        budget={
            "type": "limit",
            "max_list_cost": {"amount": str(budget_cents), "currency": "USD"},
        },
        resources=[
            {
                "type": "github_repository",
                "url": f"https://github.com/{repo}",
                "authorization_token": github_token,
                "mount_path": REPO_MOUNT_PATH,
                "checkout": {"type": "branch", "name": "main"},
            }
        ],
        initial_events=[
            {"type": "user.message", "content": [{"type": "text", "text": kickoff_text}]},
            {
                "type": "user.define_outcome",
                "description": LANE_OUTCOMES[lane].format(issue_number=issue_number),
                "rubric": {"type": "text", "content": rubric_text},
                "max_iterations": 3,
            },
        ],
    )
    return session.id


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, help="owner/name, e.g. Arize-ai/phoenix")
    parser.add_argument("--issue", type=int, required=True)
    parser.add_argument("--labels", required=True, help="JSON list of the issue's label names")
    parser.add_argument(
        "--budget-cents", type=int, default=2000, help="Session spend cap, USD cents"
    )
    parser.add_argument("--dry-run", action="store_true", help="Print the lane and exit")
    args = parser.parse_args()

    label_names: list[str] = json.loads(args.labels)
    lane = select_lane(label_names=label_names)
    if lane is None:
        print("untyped: the issue has no bug, enhancement or documentation label", file=sys.stderr)
        sys.exit(2)
    print(f"lane={lane}")
    if args.dry_run:
        return

    session_id = start_session(
        client=anthropic.Anthropic(),
        lane=lane,
        repo=args.repo,
        issue_number=args.issue,
        label_names=label_names,
        github_token=os.environ["FACTORY_GITHUB_TOKEN"],
        budget_cents=args.budget_cents,
    )
    print(f"session_id={session_id}")
    if github_output_path := os.environ.get("GITHUB_OUTPUT"):
        with open(github_output_path, "a") as github_output:
            github_output.write(f"lane={lane}\nsession_id={session_id}\n")


if __name__ == "__main__":
    main()
