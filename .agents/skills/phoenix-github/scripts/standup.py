#!/usr/bin/env python3
"""Standup report: what each roster person finished recently and is working on.

"Did" (merged PRs, closed issues) is queried live from GitHub search — a fixed
handful of repo-wide queries grouped locally by person, not one query per
person. "Doing" comes from the board snapshot when one is available (In
progress / Needs Review items) plus open PRs; without a snapshot it falls back
to open assigned issues updated inside the window, which is noisier. Read-only
— it never mutates anything.

    ./snapshot.sh board.json
    ./standup.py board.json      # a missing snapshot file just means live-only

Options:
    --days N    lookback window in days (default 2, PHOENIX_STANDUP_DAYS)
    --person X  only this login (repeatable; accepts non-roster logins)
    --json      machine-readable output
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os

import _board as B

STANDUP_DAYS = int(os.environ.get("PHOENIX_STANDUP_DAYS", "2"))
QUERY_LIMIT = "300"
MAX_LINES = 10

DOING_STATUSES = [B.IN_PROGRESS, B.NEEDS_REVIEW]
UPDATED = "updated"  # "doing" status for the no-snapshot fallback


def _list(kind: str, fields: str, *, state: str, search: str | None = None) -> list[dict]:
    args = [kind, "list", "--repo", B.REPO, "--state", state, "--limit", QUERY_LIMIT]
    if search:
        args += ["--search", search]
    return B.gh_json(*args, "--json", fields)


def _by_author(rows: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        grouped.setdefault(row["author"]["login"].lower(), []).append(row)
    return grouped


def _by_assignee(rows: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        for assignee in row["assignees"]:
            grouped.setdefault(assignee["login"].lower(), []).append(row)
    return grouped


def _board_doing(items: list[B.Item]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for status in DOING_STATUSES:  # In progress first, then Needs Review
        for item in items:
            if item.is_open and item.status == status:
                for login in item.assignees:
                    grouped.setdefault(login.lower(), []).append(
                        {"number": item.number, "title": item.title, "status": status}
                    )
    return grouped


def standup(people: list[str], since: dt.date, items: list[B.Item] | None) -> dict:
    window = f">={since.isoformat()}"
    merged = _by_author(
        _list("pr", "number,title,author", state="merged", search=f"merged:{window}")
    )
    closed = _by_assignee(
        _list("issue", "number,title,assignees", state="closed", search=f"closed:{window}")
    )
    open_prs = _by_author(_list("pr", "number,title,isDraft,author", state="open"))
    if items is not None:
        doing = _board_doing(items)
    else:
        doing = _by_assignee(
            _list("issue", "number,title,assignees", state="open", search=f"updated:{window}")
        )
        doing = {
            login: [{"number": r["number"], "title": r["title"], "status": UPDATED} for r in rows]
            for login, rows in doing.items()
        }

    report: dict[str, dict] = {}
    for login in people:
        key = login.lower()
        report[login] = {
            "did": {
                "merged_prs": merged.get(key, []),
                "closed_issues": closed.get(key, []),
            },
            "doing": {
                "issues": doing.get(key, []),
                "open_prs": open_prs.get(key, []),
            },
        }
    return report


def _fmt(prefix: str, title: str) -> str:
    return f"{prefix} — {title[:70]}"


def _print_section(label: str, lines: list[str], empty: str) -> None:
    print(f"    {label}:")
    if not lines:
        print(f"      {B.NONE} {empty}")
        return
    for line in lines[:MAX_LINES]:
        print(f"      {line}")
    if len(lines) > MAX_LINES:
        print(f"      ... and {len(lines) - MAX_LINES} more")


def print_report(report: dict, since: dt.date, days: int) -> None:
    print(f"\n=== STANDUP ===  (last {days}d, since {since}; roster {B.ROSTER_LABEL})")
    for login, r in report.items():
        print(f"\n  {login}")
        did = [_fmt(f"PR #{p['number']} merged", p["title"]) for p in r["did"]["merged_prs"]]
        did += [_fmt(f"#{i['number']} closed", i["title"]) for i in r["did"]["closed_issues"]]
        _print_section("did", did, "nothing merged or closed in window")

        doing = [_fmt(f"#{i['number']} {i['status']}", i["title"]) for i in r["doing"]["issues"]]
        doing += [
            _fmt(f"PR #{p['number']} open{' (draft)' if p['isDraft'] else ''}", p["title"])
            for p in r["doing"]["open_prs"]
        ]
        _print_section("doing", doing, "nothing in flight")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot", nargs="?", default="board.json")
    ap.add_argument("--days", type=int, default=STANDUP_DAYS)
    ap.add_argument("--person", action="append", help="only this login (repeatable)")
    ap.add_argument("--json", action="store_true", dest="as_json")
    args = ap.parse_args()

    since = dt.date.today() - dt.timedelta(days=args.days)
    people = sorted(args.person, key=str.lower) if args.person else B.roster()

    items = age = None
    if os.path.exists(args.snapshot):
        items = B.load_snapshot(args.snapshot)
        age = B.snapshot_age_minutes(args.snapshot)

    report = standup(people, since, items)

    if args.as_json:
        payload = {"since": since.isoformat(), "snapshot_age_minutes": age, "people": report}
        print(json.dumps(payload, indent=2))
        return 0

    if items is None:
        print(
            f"No snapshot at {args.snapshot} — live-only mode; 'doing' is recently "
            f"updated assigned issues, not board status."
        )
    else:
        stale = f" {B.WARN} stale — re-run ./snapshot.sh" if age > B.SNAPSHOT_MAX_AGE_MIN else ""
        print(f"Snapshot {args.snapshot}: {age / 60:.1f}h old{stale}")
    print_report(report, since, args.days)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
