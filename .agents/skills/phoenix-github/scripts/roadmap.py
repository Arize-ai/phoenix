#!/usr/bin/env python3
"""Keep the Phoenix roadmap board (project #45) current.

Audits every *current* roadmap epic — one that has started and is still open —
for progress accuracy and level of specificity, and flags epics that still need
planning.

Board #45 is small (~75 items), so this fetches live in one page. No snapshot
file needed, unlike the sprint board.

    ./roadmap.py                 # report only, changes nothing
    ./roadmap.py --apply         # apply the proposed labels and Status values

Options:
    --section   progress | planning | freshness | fields   (default: all)
    --apply     write the `needs planning` label and inferred Status values
    --json      machine-readable output (combines with --apply)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys

import _board as B

ROADMAP_NUMBER = 45
NEEDS_PLANNING = "needs planning"

# An epic is under-specified if fewer than this share of its checklist items
# point at real issues — the rest are still loose bullets.
MIN_LINKED_RATIO = 0.5
# A current epic untouched for this long has gone quiet.
STALE_DAYS = 60
# The repo passed issue #1000 years ago, so a bare low number in a bullet
# ("Phase #2", "the #1 code path") is prose, not a ticket reference.
MIN_ISSUE_NUMBER = 1000

OK = "✅"
WARN = "⚠️"
NONE = "➖"

_CHECKBOX = re.compile(r"^\s*[-*]\s*\[( |x|X)\]\s*(.+?)\s*$", re.M)
_ISSUE_REF = re.compile(r"#(\d+)\b|https://github\.com/[\w.-]+/[\w.-]+/issues/(\d+)")


def _links_to_issue(text: str) -> bool:
    """True when a checklist bullet references a real ticket."""
    for bare, url in _ISSUE_REF.findall(text):
        if url or int(bare) >= MIN_ISSUE_NUMBER:
            return True
    return False


_QUERY = """
query($org: String!, $num: Int!, $endCursor: String) {
  organization(login: $org) {
    projectV2(number: $num) {
      id
      statusField: field(name: "Status") {
        ... on ProjectV2SingleSelectField { id options { id name } }
      }
      initiativeField: field(name: "Initiative") {
        ... on ProjectV2SingleSelectField { id options { id name } }
      }
      items(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          initiative: fieldValueByName(name: "Initiative") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          start: fieldValueByName(name: "Start Date") {
            ... on ProjectV2ItemFieldDateValue { date }
          }
          target: fieldValueByName(name: "Target Date") {
            ... on ProjectV2ItemFieldDateValue { date }
          }
          content {
            ... on Issue {
              number title url state body
              createdAt lastEditedAt
              comments(last: 1) { nodes { createdAt } }
              labels(first: 30) { nodes { name } }
            }
          }
        }
      }
    }
  }
}
"""


class Epic:
    def __init__(self, node: dict) -> None:
        c = node.get("content") or {}
        self.item_id: str = node["id"]
        self.number: int = c["number"]
        self.title: str = c.get("title", "")
        self.url: str = c.get("url", "")
        self.state: str = c.get("state", "")
        self.body: str = c.get("body") or ""
        self.labels: list[str] = [n["name"] for n in (c.get("labels") or {}).get("nodes", [])]
        self.status: str | None = (node.get("status") or {}).get("name")
        self.initiative: str | None = (node.get("initiative") or {}).get("name")
        self.start: dt.date | None = _date(node.get("start"))
        self.target: dt.date | None = _date(node.get("target"))
        # Staleness is measured from *human* activity — the body being edited
        # (which is how a checklist gets ticked) or someone commenting. Not
        # `updatedAt`: a label write bumps that, so `--apply` would reset the
        # clock on exactly the neglected epics it just flagged.
        touched = [_ts(c.get("createdAt")), _ts(c.get("lastEditedAt"))]
        touched += [_ts(n.get("createdAt")) for n in (c.get("comments") or {}).get("nodes", [])]
        self.updated: dt.date = max(d for d in touched if d is not None)

        boxes = _CHECKBOX.findall(self.body)
        self.checklist_total = len(boxes)
        self.checklist_done = sum(1 for mark, _ in boxes if mark.lower() == "x")
        # Specificity is judged on *remaining* work only. Completed items are
        # often prose records of shipped work, and penalising an epic for its
        # own history would flag well-run epics as under-planned.
        remaining = [text for mark, text in boxes if mark.lower() != "x"]
        self.open_total = len(remaining)
        self.open_linked = sum(1 for text in remaining if _links_to_issue(text))

    @property
    def is_open(self) -> bool:
        return self.state == "OPEN"

    def is_current(self, today: dt.date) -> bool:
        """Started (or undated) and still open."""
        if not self.is_open:
            return False
        return self.start is None or self.start <= today

    @property
    def linked_ratio(self) -> float:
        """Share of *remaining* checklist items that point at a real issue."""
        if not self.open_total:
            return 1.0
        return self.open_linked / self.open_total

    @property
    def needs_planning(self) -> bool:
        """No plan at all, or remaining work still made of loose bullets."""
        if self.checklist_total == 0:
            return True
        if self.open_total == 0:
            return False  # fully checked; that's `complete_not_done`, not planning
        return self.linked_ratio < MIN_LINKED_RATIO

    @property
    def progress(self) -> str:
        if not self.checklist_total:
            return "no plan"
        pct = round(100 * self.checklist_done / self.checklist_total)
        return f"{self.checklist_done}/{self.checklist_total} ({pct}%)"

    def inferred_status(self, today: dt.date) -> str:
        if not self.is_open:
            return "Done"
        if self.start is not None and self.start > today:
            return "Todo"
        return "In Progress"


def _date(raw: dict | None) -> dt.date | None:
    if not raw or not raw.get("date"):
        return None
    return dt.date.fromisoformat(raw["date"])


def _ts(raw: str | None) -> dt.date | None:
    if not raw:
        return None
    return dt.datetime.fromisoformat(raw.replace("Z", "+00:00")).date()


def fetch() -> tuple[list[Epic], dict]:
    pages = json.loads(
        B.gh(
            "api",
            "graphql",
            "--paginate",
            "--slurp",
            "-F",
            f"org={B.ORG}",
            "-F",
            f"num={ROADMAP_NUMBER}",
            "-f",
            f"query={_QUERY}",
        )
    )
    epics: list[Epic] = []
    for page in pages:
        project = page["data"]["organization"]["projectV2"]
        for node in project["items"]["nodes"]:
            if "number" in (node.get("content") or {}):
                epics.append(Epic(node))
    first = pages[0]["data"]["organization"]["projectV2"]
    meta = {
        "project_id": first["id"],
        "status_field": first["statusField"]["id"],
        "status_options": {o["name"]: o["id"] for o in first["statusField"]["options"]},
        "initiative_options": [o["name"] for o in first["initiativeField"]["options"]],
    }
    return epics, meta


def audit(epics: list[Epic], today: dt.date) -> dict:
    current = [e for e in epics if e.is_current(today)]
    return {
        "current": current,
        "needs_planning": [e for e in current if e.needs_planning],
        "unflagged": [e for e in current if e.needs_planning and NEEDS_PLANNING not in e.labels],
        "stale_flag": [e for e in current if not e.needs_planning and NEEDS_PLANNING in e.labels],
        "quiet": [e for e in current if (today - e.updated).days > STALE_DAYS],
        "overdue": [e for e in epics if e.is_open and e.target and e.target < today],
        "complete_not_done": [
            e for e in current if e.checklist_total and e.checklist_done == e.checklist_total
        ],
        "missing_status": [e for e in epics if e.status is None],
        "wrong_status": [
            e for e in epics if e.status is not None and e.status != e.inferred_status(today)
        ],
        "missing_dates": [e for e in epics if e.is_open and (not e.start or not e.target)],
        "missing_initiative": [e for e in current if not e.initiative],
    }


def _row(e: Epic, extra: str = "") -> str:
    return f"      #{e.number:<6} {e.title[:52]:<52} {extra}"


def report_progress(a: dict, today: dt.date) -> None:
    print("\n-- PROGRESS --")
    for e in sorted(a["current"], key=lambda x: x.number):
        flag = f" {WARN} needs planning" if e.needs_planning else ""
        quiet = f" {WARN} quiet {(today - e.updated).days}d" if e in a["quiet"] else ""
        print(f"      #{e.number:<6} {e.title[:44]:<44} {e.progress:>14}{flag}{quiet}")


def report_planning(a: dict) -> None:
    print("\n-- SPECIFICITY --")
    np = a["needs_planning"]
    mark = OK if not np else WARN
    print(
        f"  {mark} {len(np)} current epics need planning "
        f"(no checklist, or under {int(MIN_LINKED_RATIO * 100)}% of the "
        f"remaining work is broken into tickets)"
    )
    for e in np:
        detail = (
            "no checklist"
            if not e.checklist_total
            else f"only {e.open_linked}/{e.open_total} remaining items are tickets"
        )
        print(_row(e, detail))
    if a["unflagged"]:
        print(f"\n      → {len(a['unflagged'])} not yet labelled `{NEEDS_PLANNING}`")
    if a["stale_flag"]:
        print(
            f"      → {len(a['stale_flag'])} labelled `{NEEDS_PLANNING}` but now "
            f"planned; label should be removed"
        )


def report_freshness(a: dict, today: dt.date) -> None:
    print("\n-- FRESHNESS --")
    for key, label in [
        ("quiet", f"current epics untouched for over {STALE_DAYS} days"),
        ("overdue", "open epics past their Target Date"),
        ("complete_not_done", "epics with a fully-checked plan but still open"),
    ]:
        rows = a[key]
        mark = OK if not rows else WARN
        print(f"\n  {mark} {len(rows)} {label}")
        for e in rows:
            if key == "quiet":
                print(_row(e, f"{(today - e.updated).days}d"))
            elif key == "overdue":
                print(_row(e, f"target {e.target}"))
            else:
                print(_row(e, e.progress))


def report_fields(a: dict, meta: dict, today: dt.date) -> None:
    print("\n-- FIELD COVERAGE --")
    ms, ws = a["missing_status"], a["wrong_status"]
    print(
        f"\n  {OK if not ms else WARN} {len(ms)} items with no Status "
        f"(proposed value in parentheses)"
    )
    for e in ms[:12]:
        print(_row(e, f"→ {e.inferred_status(today)}"))
    if len(ms) > 12:
        print(f"      ... and {len(ms) - 12} more")

    print(f"\n  {OK if not ws else WARN} {len(ws)} items whose Status disagrees with the issue")
    for e in ws[:10]:
        print(_row(e, f"{e.status} → {e.inferred_status(today)}"))

    md = a["missing_dates"]
    print(f"\n  {OK if not md else WARN} {len(md)} open epics missing Start or Target Date")
    for e in md:
        print(_row(e, f"start={e.start or '—'} target={e.target or '—'}"))

    mi = a["missing_initiative"]
    print(
        f"\n  {NONE} {len(mi)}/{len(a['current'])} current epics with no Initiative "
        f"(options: {', '.join(meta['initiative_options'])})"
    )


# Section name → what it prints. `--section` picks one; the default runs all.
SECTIONS = {
    "progress": lambda a, meta, today: report_progress(a, today),
    "planning": lambda a, meta, today: report_planning(a),
    "freshness": lambda a, meta, today: report_freshness(a, today),
    "fields": lambda a, meta, today: report_fields(a, meta, today),
}


def report(a: dict, meta: dict, today: dt.date, section: str | None = None) -> None:
    print(
        f"\n=== ROADMAP #{ROADMAP_NUMBER} ===  {len(a['current'])} current epics "
        f"(started and open) as of {today}"
    )
    for name, render in SECTIONS.items():
        if section in (None, name):
            render(a, meta, today)


_SET_SELECT = """
mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $project, itemId: $item, fieldId: $field,
    value: { singleSelectOptionId: $option }
  }) { projectV2Item { id } }
}
"""


def ensure_label(log) -> None:
    existing = B.gh_json(
        "label",
        "list",
        "--repo",
        B.REPO,
        "--limit",
        "200",
        "--json",
        "name",
        "--jq",
        "[.[].name]",
    )
    if NEEDS_PLANNING in existing:
        return
    log(f"  Creating label `{NEEDS_PLANNING}` on {B.REPO}...")
    B.gh(
        "label",
        "create",
        NEEDS_PLANNING,
        "--repo",
        B.REPO,
        "--color",
        "FBCA04",
        "--description",
        "Roadmap epic lacks a broken-down plan",
    )


def apply(a: dict, meta: dict, today: dt.date, log=print) -> int:
    """Write the audit's proposals. `log` goes to stderr under --json so the
    JSON document on stdout stays parseable."""
    failed = 0
    if a["unflagged"] or a["stale_flag"]:
        ensure_label(log)

    for e in a["unflagged"]:
        try:
            B.gh("issue", "edit", str(e.number), "--repo", B.REPO, "--add-label", NEEDS_PLANNING)
            log(f"  {OK} #{e.number} labelled `{NEEDS_PLANNING}`")
        except Exception as exc:
            failed += 1
            log(f"  {WARN} #{e.number}: {exc}")

    for e in a["stale_flag"]:
        try:
            B.gh("issue", "edit", str(e.number), "--repo", B.REPO, "--remove-label", NEEDS_PLANNING)
            log(f"  {OK} #{e.number} planning label cleared")
        except Exception as exc:
            failed += 1
            log(f"  {WARN} #{e.number}: {exc}")

    for e in a["missing_status"]:
        want = e.inferred_status(today)
        option = meta["status_options"].get(want)
        if not option:
            log(f"  {WARN} #{e.number}: no Status option named {want!r}")
            failed += 1
            continue
        try:
            B.gh(
                "api",
                "graphql",
                "-f",
                f"project={meta['project_id']}",
                "-f",
                f"item={e.item_id}",
                "-f",
                f"field={meta['status_field']}",
                "-f",
                f"option={option}",
                "-f",
                f"query={_SET_SELECT}",
            )
            log(f"  {OK} #{e.number} Status → {want}")
        except Exception as exc:
            failed += 1
            log(f"  {WARN} #{e.number}: {exc}")

    return failed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--json", action="store_true", dest="as_json")
    ap.add_argument("--section", choices=sorted(SECTIONS))
    args = ap.parse_args()

    today = dt.date.today()
    epics, meta = fetch()
    a = audit(epics, today)

    # Under --json, progress chatter goes to stderr so stdout stays one JSON
    # document — but --apply still applies.
    def log(msg: str) -> None:
        print(msg, file=sys.stderr if args.as_json else sys.stdout)

    if not args.as_json:
        report(a, meta, today, args.section)

    pending = len(a["unflagged"]) + len(a["stale_flag"]) + len(a["missing_status"])
    failed = 0
    if args.apply and pending:
        log(f"\nApplying {pending} changes...")
        failed = apply(a, meta, today, log)
        log(f"\nDone. {pending - failed} applied, {failed} failed.\n")
    elif args.apply:
        log("\nNothing to apply.\n")

    if args.as_json:
        out = {k: [e.number for e in v] for k, v in a.items()}
        out["applied"] = {
            "requested": pending if args.apply else 0,
            "failed": failed,
            "dry_run": not args.apply,
        }
        print(json.dumps(out, indent=2))
    elif not args.apply:
        print(
            f"\nDRY RUN — nothing changed. --apply would write "
            f"{len(a['unflagged'])} planning labels, clear {len(a['stale_flag'])}, "
            f"and set {len(a['missing_status'])} Status values.\n"
        )

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
