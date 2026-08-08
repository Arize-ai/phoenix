"""Shared helpers for the Phoenix board (project #42) scripts.

Nothing here is specific to a person, ticket, or sprint number: the roster, the
sprint calendar, and the field IDs are all resolved live from GitHub.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import subprocess
import time
from typing import Any, Iterable

ORG = os.environ.get("PHOENIX_PROJECT_ORG", "Arize-ai")
PROJECT_NUMBER = int(os.environ.get("PHOENIX_PROJECT_NUMBER", "42"))
REPO = os.environ.get("PHOENIX_REPO", "Arize-ai/phoenix")
ROSTER_TEAMS = [
    t.strip() for t in os.environ.get("PHOENIX_ROSTER_TEAM", "oss-eng").split(",") if t.strip()
]
ROSTER_LABEL = ", ".join(f"@{ORG}/{t}" for t in ROSTER_TEAMS)
ROSTER_EXCLUDE = {
    p.strip().lower() for p in os.environ.get("PHOENIX_ROSTER_EXCLUDE", "").split(",") if p.strip()
}

# Ticket-load guardrails: everyone should be fed, nobody should be buried.
MIN_TICKETS = int(os.environ.get("PHOENIX_MIN_TICKETS", "3"))
MAX_TICKETS = int(os.environ.get("PHOENIX_MAX_TICKETS", "15"))

# A snapshot older than this is not safe to write from: tickets closed since it
# was taken still read as OPEN in the file.
SNAPSHOT_MAX_AGE_MIN = int(os.environ.get("PHOENIX_SNAPSHOT_MAX_AGE_MIN", "120"))

# Report glyphs shared by the reporting scripts.
OK = "✅"
WARN = "⚠️"
NONE = "➖"

DONE = "✅  Done"
IN_PROGRESS = "👨‍💻  In progress"
TODO = "📘  Todo"
BACKLOG = "Backlog"
NEEDS_REVIEW = "🔍. Needs Review"
APPROVED = "👍  Approved"

# Statuses that mean "this is finished" for load-counting purposes.
CLOSED_STATUSES = {DONE}


def gh(*args: str) -> str:
    """Run a gh command and return stdout, raising with stderr on failure."""
    proc = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args)} failed:\n{proc.stderr.strip()}")
    return proc.stdout


def gh_json(*args: str) -> Any:
    return json.loads(gh(*args))


# --------------------------------------------------------------------------
# Snapshot parsing
# --------------------------------------------------------------------------


class Item:
    """One project board item backed by an issue."""

    __slots__ = (
        "id",
        "number",
        "title",
        "url",
        "state",
        "status",
        "sprint",
        "assignees",
        "labels",
        "updated_at",
    )

    def __init__(self, node: dict) -> None:
        content = node.get("content") or {}
        self.id: str = node["id"]
        self.number: int | None = content.get("number")
        self.title: str = content.get("title", "")
        self.url: str = content.get("url", "")
        self.state: str | None = content.get("state")
        self.status: str | None = (node.get("status") or {}).get("name")
        self.sprint: str | None = (node.get("sprint") or {}).get("title")
        # Exclusion is applied here, at the data boundary, so every consumer
        # (health, rollover, standup, ...) honors it without repeating the check.
        self.assignees: list[str] = [
            a["login"]
            for a in (content.get("assignees") or {}).get("nodes", [])
            if a["login"].lower() not in ROSTER_EXCLUDE
        ]
        labels = (content.get("labels") or {}).get("nodes", [])
        self.labels: list[str] = [lb["name"] for lb in labels]
        self.updated_at: str | None = content.get("updatedAt")

    @property
    def is_open(self) -> bool:
        return self.state == "OPEN"

    @property
    def is_active(self) -> bool:
        """Open, and not already parked in a terminal status."""
        return self.is_open and self.status not in CLOSED_STATUSES

    def __repr__(self) -> str:
        return f"<Item #{self.number} {self.title[:40]!r}>"


def load_snapshot(path: str) -> list[Item]:
    """Load a snapshot.sh output file into Item objects (issues only)."""
    with open(path) as fh:
        pages = json.load(fh)
    items: list[Item] = []
    for page in pages:
        nodes = page["data"]["organization"]["projectV2"]["items"]["nodes"]
        for node in nodes:
            content = node.get("content") or {}
            # PRs and draft items have no issue number; skip them.
            if "number" not in content or "assignees" not in content:
                continue
            items.append(Item(node))
    return items


def snapshot_age_minutes(path: str) -> float:
    """How long ago the snapshot file was written."""
    return (time.time() - os.path.getmtime(path)) / 60


def require_fresh_snapshot(path: str, max_age_min: int = SNAPSHOT_MAX_AGE_MIN) -> str | None:
    """Return an error message if `path` is too stale to write from, else None.

    A snapshot is a read cache, not a source of truth for mutations: anything
    closed or moved since it was taken still reads as OPEN here, so writing
    from a stale file re-opens settled work and notifies everyone watching it.
    """
    age = snapshot_age_minutes(path)
    if age <= max_age_min:
        return None
    return (
        f"{path} was taken {age / 60:.1f}h ago (limit {max_age_min / 60:.1f}h). "
        f"Tickets closed since then still read as open in it, so applying "
        f"would act on stale state. Re-run ./snapshot.sh {path}, or pass "
        f"--stale-ok if you know the file is still accurate."
    )


# --------------------------------------------------------------------------
# Sprint calendar
# --------------------------------------------------------------------------


class Sprint:
    __slots__ = ("id", "title", "start", "duration")

    def __init__(self, raw: dict) -> None:
        self.id: str = raw["id"]
        self.title: str = raw["title"]
        self.start: _dt.date = _dt.date.fromisoformat(raw["startDate"])
        self.duration: int = raw["duration"]

    @property
    def end(self) -> _dt.date:
        """Exclusive end date."""
        return self.start + _dt.timedelta(days=self.duration)

    def contains(self, day: _dt.date) -> bool:
        return self.start <= day < self.end

    def __repr__(self) -> str:
        return f"<Sprint {self.title} {self.start}..{self.end}>"


_SPRINT_FIELD_QUERY = """
query($org: String!, $num: Int!) {
  organization(login: $org) {
    projectV2(number: $num) {
      id
      field(name: "Sprint") {
        ... on ProjectV2IterationField {
          id
          configuration {
            iterations { id title startDate duration }
            completedIterations { id title startDate duration }
          }
        }
      }
    }
  }
}
"""


def sprint_calendar() -> tuple[str, str, list[Sprint], list[Sprint]]:
    """Return (project_id, sprint_field_id, upcoming, completed).

    Iteration IDs rotate as sprints roll, so they are always resolved live —
    never hardcode them.
    """
    data = json.loads(
        gh(
            "api",
            "graphql",
            "-F",
            f"org={ORG}",
            "-F",
            f"num={PROJECT_NUMBER}",
            "-f",
            f"query={_SPRINT_FIELD_QUERY}",
        )
    )
    project = data["data"]["organization"]["projectV2"]
    field = project["field"]
    config = field["configuration"]
    upcoming = [Sprint(i) for i in config["iterations"]]
    completed = [Sprint(i) for i in config["completedIterations"]]
    upcoming.sort(key=lambda s: s.start)
    completed.sort(key=lambda s: s.start)
    return project["id"], field["id"], upcoming, completed


def resolve_sprints(
    today: _dt.date | None = None,
) -> tuple[Sprint, Sprint | None, list[Sprint], str, str]:
    """Return (current, next, past, project_id, sprint_field_id).

    `past` is every iteration that has already finished — the board's own
    completedIterations, plus any still-listed iteration that started before
    the current one. It is the authoritative answer to "is this sprint behind
    us?"; never infer that from "not current and not next", because a healthy
    board also has *future* iterations defined.
    """
    today = today or _dt.date.today()
    project_id, field_id, upcoming, completed = sprint_calendar()
    if not upcoming:
        raise RuntimeError(
            "No active or future sprints on the board. Add the next iteration "
            "to the Sprint field in the GitHub UI (iterations cannot be "
            "created via the API)."
        )
    current = next((s for s in upcoming if s.contains(today)), None)
    if current is None:
        # Today falls in a gap: treat the most recent started sprint as current.
        started = [s for s in upcoming if s.start <= today]
        current = started[-1] if started else upcoming[0]
    later = [s for s in upcoming if s.start > current.start]
    nxt = later[0] if later else None
    past = sorted(
        completed + [s for s in upcoming if s.start < current.start],
        key=lambda s: s.start,
    )
    return current, nxt, past, project_id, field_id


def stranded(items: Iterable[Item], past: Iterable[Sprint]) -> list[Item]:
    """Active tickets still tagged to a sprint that has already finished.

    Shared by health.py (reports them) and rollover.py (moves them) so the two
    can never disagree about what "stranded" means.
    """
    past_titles = {s.title for s in past}
    return [i for i in items if i.is_active and i.sprint in past_titles]


# --------------------------------------------------------------------------
# Roster
# --------------------------------------------------------------------------


def roster() -> list[str]:
    """Live membership of the roster team(s), minus PHOENIX_ROSTER_EXCLUDE."""
    logins = {
        login
        for team in ROSTER_TEAMS
        for login in gh_json("api", f"orgs/{ORG}/teams/{team}/members", "--jq", "[.[].login]")
    }
    return sorted((lg for lg in logins if lg.lower() not in ROSTER_EXCLUDE), key=str.lower)


# --------------------------------------------------------------------------
# Mutations
# --------------------------------------------------------------------------


_SET_ITERATION = """
mutation($project: ID!, $item: ID!, $field: ID!, $iter: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $project, itemId: $item, fieldId: $field,
    value: { iterationId: $iter }
  }) { projectV2Item { id } }
}
"""


def set_sprint(project_id: str, item_id: str, field_id: str, iteration_id: str) -> None:
    gh(
        "api",
        "graphql",
        "-f",
        f"project={project_id}",
        "-f",
        f"item={item_id}",
        "-f",
        f"field={field_id}",
        "-f",
        f"iter={iteration_id}",
        "-f",
        f"query={_SET_ITERATION}",
    )


def comment(issue_number: int, body: str) -> None:
    gh("issue", "comment", str(issue_number), "--repo", REPO, "--body", body)


def counts_by_assignee(items: Iterable[Item], people: Iterable[str]) -> dict[str, int]:
    counts = {p: 0 for p in people}
    for item in items:
        for login in item.assignees:
            if login in counts:
                counts[login] += 1
    return counts
