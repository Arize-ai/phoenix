#!/usr/bin/env python3
"""Roll unfinished tickets into the next sprint, commenting on each slip.

Dry-run by default: it prints the plan and changes nothing. Pass --apply to
move tickets and post comments.

    ./snapshot.sh board.json
    ./rollover.py board.json                  # plan for the current sprint
    ./rollover.py board.json --stranded       # also sweep up past sprints
    ./rollover.py board.json --apply

Options:
    --stranded      also roll tickets left on already-completed sprints
    --only N,N,N    restrict to specific issue numbers
    --no-comment    move tickets without posting the slip comment
    --apply         actually perform the moves
    --stale-ok      apply even if the snapshot is older than the freshness limit
"""

from __future__ import annotations

import argparse
import sys

import _board as B


def slip_comment(from_sprint: str, to_sprint: str) -> str:
    return (
        f"Slipped from **{from_sprint}** → moved to **{to_sprint}**.\n\n"
        f"Rolled over during sprint close-out."
    )


def select(
    items: list[B.Item], current: B.Sprint, past: list[B.Sprint], sweep_stranded: bool
) -> list[B.Item]:
    """Tickets that should move into the next sprint.

    Only the current sprint and — with --stranded — sprints that have actually
    finished. Work parked on a *future* iteration is deliberate planning, not
    slippage, and must never be pulled backwards.
    """
    out = [i for i in items if i.is_active and i.sprint == current.title]
    if sweep_stranded:
        out += B.stranded(items, past)
    # Stable, readable order.
    return sorted(out, key=lambda i: (i.sprint or "", i.number or 0))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot", nargs="?", default="board.json")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--stranded", action="store_true")
    ap.add_argument("--no-comment", action="store_true", dest="no_comment")
    ap.add_argument("--only", help="comma-separated issue numbers")
    ap.add_argument("--stale-ok", action="store_true", dest="stale_ok")
    args = ap.parse_args()

    items = B.load_snapshot(args.snapshot)
    if args.apply and not args.stale_ok:
        stale = B.require_fresh_snapshot(args.snapshot)
        if stale:
            print(stale, file=sys.stderr)
            return 1

    current, nxt, past, project_id, field_id = B.resolve_sprints()
    if nxt is None:
        print(
            "No next sprint exists. Create the next iteration on the Sprint "
            "field in the GitHub UI first — iterations cannot be created via "
            "the API.",
            file=sys.stderr,
        )
        return 1

    targets = select(items, current, past, args.stranded)
    if args.only:
        wanted = {int(n) for n in args.only.split(",")}
        targets = [i for i in targets if i.number in wanted]

    print(f"Current sprint : {current.title}  ({current.start} → {current.end})")
    print(f"Next sprint    : {nxt.title}  (starts {nxt.start})")
    print(
        f"Tickets to roll: {len(targets)}"
        f"{' (including stranded past sprints)' if args.stranded else ''}\n"
    )

    if not targets:
        print("Nothing to roll over.")
        return 0

    for item in targets:
        flag = "" if item.sprint == current.title else f"  [stranded: {item.sprint}]"
        who = ", ".join(item.assignees) or "unassigned"
        print(f"  #{item.number:<6} {item.title[:60]:<60} {who}{flag}")

    if not args.apply:
        print(
            f"\nDRY RUN — nothing changed. Re-run with --apply to move these "
            f"{len(targets)} tickets"
            f"{'' if args.no_comment else ' and post slip comments'}."
        )
        return 0

    print(f"\nApplying: moving {len(targets)} tickets to {nxt.title}...")
    # The move and the comment are separate outcomes: a ticket whose comment
    # failed has still moved, and reporting it as "failed" would send the lead
    # back to re-roll a ticket that is already in the next sprint.
    moved = move_failed = comment_failed = 0
    for item in targets:
        try:
            B.set_sprint(project_id, item.id, field_id, nxt.id)
        except Exception as exc:  # keep going; report at the end
            move_failed += 1
            print(f"  ⚠️  #{item.number}: not moved: {exc}")
            continue
        moved += 1
        if args.no_comment:
            print(f"  ✅ #{item.number}")
            continue
        try:
            B.comment(item.number, slip_comment(item.sprint or "no sprint", nxt.title))
            print(f"  ✅ #{item.number}")
        except Exception as exc:
            comment_failed += 1
            print(f"  ⚠️  #{item.number}: moved, but the slip comment failed: {exc}")

    print(f"\nMoved {moved}, failed to move {move_failed}.")
    if comment_failed:
        print(
            f"{comment_failed} of the {moved} moved tickets have no slip comment. "
            f"Re-running will not retry them — they are in {nxt.title} now. "
            f"Comment by hand if the record matters."
        )
    return 1 if (move_failed or comment_failed) else 0


if __name__ == "__main__":
    sys.exit(main())
