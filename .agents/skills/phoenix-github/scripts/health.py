#!/usr/bin/env python3
"""Report board hygiene and ticket-load health for the Phoenix board.

Reads a snapshot produced by snapshot.sh; makes only two extra live calls (the
sprint calendar and the roster team). Read-only — it never mutates the board.

    ./snapshot.sh board.json
    ./health.py board.json

Options:
    --json      machine-readable output
    --section   run one section only (hygiene | load)
"""

from __future__ import annotations

import argparse
import json
import sys

import _board as B

OK = "✅"
WARN = "⚠️"
NONE = "➖"


def hygiene(items: list[B.Item], current: B.Sprint, nxt: B.Sprint | None) -> dict:
    active = [i for i in items if i.is_active]
    open_issues = [i for i in items if i.is_open]

    known_sprints = {current.title} | ({nxt.title} if nxt else set())
    stranded = [i for i in active if i.sprint and i.sprint not in known_sprints]

    done_but_open = [i for i in open_issues if i.status in B.CLOSED_STATUSES]
    in_progress_unassigned = [i for i in active if i.status == B.IN_PROGRESS and not i.assignees]
    current_sprint = [i for i in active if i.sprint == current.title]
    current_unassigned = [i for i in current_sprint if not i.assignees]
    current_no_status = [i for i in current_sprint if not i.status]

    on_board = {i.number for i in items}
    repo_open = {
        i["number"]
        for i in B.gh_json(
            "issue",
            "list",
            "--repo",
            B.REPO,
            "--state",
            "open",
            "--limit",
            "1000",
            "--json",
            "number",
        )
    }
    missing = sorted(repo_open - on_board)

    return {
        "stranded_on_old_sprint": stranded,
        "done_but_open": done_but_open,
        "in_progress_unassigned": in_progress_unassigned,
        "current_sprint_unassigned": current_unassigned,
        "current_sprint_no_status": current_no_status,
        "missing_from_board": missing,
        "current_sprint_size": len(current_sprint),
    }


def load(items: list[B.Item], current: B.Sprint) -> dict:
    people = B.roster()
    active = [i for i in items if i.is_active]
    sprint_items = [i for i in active if i.sprint == current.title]

    sprint_counts = B.counts_by_assignee(sprint_items, people)
    total_counts = B.counts_by_assignee(active, people)

    # Anyone carrying sprint work who is not on the roster team.
    off_roster: dict[str, int] = {}
    for item in sprint_items:
        for login in item.assignees:
            if login not in sprint_counts:
                off_roster[login] = off_roster.get(login, 0) + 1

    return {
        "roster": people,
        "sprint_counts": sprint_counts,
        "total_counts": total_counts,
        "off_roster": off_roster,
        "starving": sorted(p for p, n in sprint_counts.items() if n < B.MIN_TICKETS),
        "overloaded": sorted(p for p, n in sprint_counts.items() if n > B.MAX_TICKETS),
        "total_overloaded": sorted(p for p, n in total_counts.items() if n > B.MAX_TICKETS),
    }


def _issue_lines(items: list[B.Item], limit: int = 10) -> list[str]:
    lines = [f"      #{i.number} {i.title[:70]}" for i in items[:limit]]
    if len(items) > limit:
        lines.append(f"      ... and {len(items) - limit} more")
    return lines


def print_hygiene(h: dict, current: B.Sprint, nxt: B.Sprint | None) -> None:
    print(
        f"\n=== BOARD HYGIENE ===  (sprint {current.title}, "
        f"{current.start} → {current.end}; {h['current_sprint_size']} active tickets)"
    )
    if nxt:
        print(f"    next sprint: {nxt.title} starts {nxt.start}")
    else:
        print(f"    {WARN} no next sprint defined — create the next iteration in the UI")

    checks = [
        (
            "stranded_on_old_sprint",
            "open tickets still tagged to a past sprint (never rolled over)",
        ),
        ("done_but_open", "tickets marked Done but the issue is still open"),
        ("in_progress_unassigned", "In progress with no assignee"),
        ("current_sprint_unassigned", "current-sprint tickets with no assignee"),
        ("current_sprint_no_status", "current-sprint tickets with no Status"),
    ]
    for key, label in checks:
        rows = h[key]
        mark = OK if not rows else WARN
        print(f"\n  {mark} {len(rows)} {label}")
        if rows:
            print("\n".join(_issue_lines(rows)))

    missing = h["missing_from_board"]
    mark = OK if not missing else WARN
    print(f"\n  {mark} {len(missing)} open repo issues not on the board")
    if missing:
        print("      " + ", ".join(f"#{n}" for n in missing[:20]))


def print_load(ld: dict, current: B.Sprint) -> None:
    print(
        f"\n=== TICKET LOAD ===  (healthy band: {B.MIN_TICKETS}-{B.MAX_TICKETS} "
        f"tickets, roster @{B.ORG}/{B.ROSTER_TEAM})"
    )
    print(f"\n  {'person':<22}{'sprint':>8}{'total':>8}   state")
    print(f"  {'-' * 50}")
    for person in ld["roster"]:
        s = ld["sprint_counts"][person]
        t = ld["total_counts"][person]
        if s < B.MIN_TICKETS:
            state = f"{WARN} starving (needs {B.MIN_TICKETS - s} more)"
        elif s > B.MAX_TICKETS:
            state = f"{WARN} overloaded (shed {s - B.MAX_TICKETS})"
        else:
            state = f"{OK} healthy"
        print(f"  {person:<22}{s:>8}{t:>8}   {state}")

    if ld["total_overloaded"]:
        print(f"\n  {WARN} Ownership debt — over {B.MAX_TICKETS} open tickets across all sprints:")
        for p in ld["total_overloaded"]:
            print(f"      {p}: {ld['total_counts'][p]}")

    if ld["off_roster"]:
        print(f"\n  {NONE} Sprint work assigned outside @{B.ORG}/{B.ROSTER_TEAM}:")
        for p, n in sorted(ld["off_roster"].items(), key=lambda kv: -kv[1]):
            print(f"      {p}: {n}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot", nargs="?", default="board.json")
    ap.add_argument("--json", action="store_true", dest="as_json")
    ap.add_argument("--section", choices=["hygiene", "load"])
    args = ap.parse_args()

    items = B.load_snapshot(args.snapshot)
    current, nxt, _completed, _pid, _fid = B.resolve_sprints()

    want_h = args.section in (None, "hygiene")
    want_l = args.section in (None, "load")

    h = hygiene(items, current, nxt) if want_h else None
    ld = load(items, current) if want_l else None

    if args.as_json:
        out: dict = {"sprint": current.title, "next_sprint": nxt.title if nxt else None}
        if h:
            out["hygiene"] = {
                k: ([i.number for i in v] if v and isinstance(v[0], B.Item) else v)
                if isinstance(v, list)
                else v
                for k, v in h.items()
            }
        if ld:
            out["load"] = ld
        print(json.dumps(out, indent=2))
        return 0

    if h:
        print_hygiene(h, current, nxt)
    if ld:
        print_load(ld, current)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
