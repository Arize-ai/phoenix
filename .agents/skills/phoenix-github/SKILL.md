---
name: phoenix-github
description: Manage GitHub issues, labels, project boards, sprint operations, and roadmap health for the Arize-ai/phoenix repository. Use when filing roadmap issues, triaging bugs, applying labels, running sprint close-out and rollover, auditing board hygiene, checking ticket-load balance across the team, keeping roadmap epics up to date, flagging epics that need planning, or querying issue/project state via the GitHub CLI.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "2.1.0"
  internal: true
---

# Phoenix GitHub

Reference for managing issues, labels, project boards, and sprint operations on
`Arize-ai/phoenix` using the `gh` CLI.

## Repository and Boards

```
Arize-ai/phoenix
```

There are **two** project boards. Pick deliberately.

| Board | Number | Project ID | What it holds |
|---|---|---|---|
| **phoenix** (sprint board) | [#42](https://github.com/orgs/Arize-ai/projects/42) | `PVT_kwDOA5FfSM4AIM-T` | Everything. ~6.3k items, Sprint/Points/Priority fields. **This is the board sprint work runs on.** |
| **phoenix roadmap** | [#45](https://github.com/orgs/Arize-ai/projects/45) | `PVT_kwDOA5FfSM4AJaRo` | ~75 high-level epics with Start/Target dates. No sprints. |

Day-to-day sprint operations mean board **#42**. Roadmap epics with dates live
on **#45**.

## Quick Reference

| Task | See |
|---|---|
| Close out a sprint / roll slipped tickets | [Sprint Operations](#sprint-operations) |
| Check the board is up to date | [Board Hygiene](#board-hygiene) |
| Check nobody is starving or buried | [Ticket Load Health](#ticket-load-health) |
| Run a standup — recent work and work in flight per person | [Standup](#standup) |
| Keep roadmap epics current / flag ones needing planning | [Roadmap Health](#roadmap-health) |
| File a roadmap epic | [Roadmap Issues](#roadmap-issues) |
| Add an epic to the roadmap board (#45) | [Putting the Epic on the Roadmap Board](#putting-the-epic-on-the-roadmap-board) |
| Apply the right labels | [Label Taxonomy](#label-taxonomy) |
| Set project fields by hand | [Project Field Mechanics](#project-field-mechanics) |
| Create a bug or feature request | [Standard Issues](#standard-issues) |

---

## Tooling

Five bundled scripts under `scripts/` back the tech-lead workflows. They read
the roster, the sprint calendar, and all field IDs **live** — nothing about a
person, sprint, or ticket is hardcoded.

```bash
cd .agents/skills/phoenix-github/scripts

# Sprint board (#42) — needs a snapshot first
./snapshot.sh board.json     # ~60-90s, walks the whole board once
./health.py   board.json     # hygiene + load report (read-only)
./rollover.py board.json     # sprint rollover plan (dry run by default)
./standup.py  board.json     # per-person did/doing report (read-only;
                             # snapshot optional but recommended)

# Roadmap board (#45) — small, fetches live
./roadmap.py                 # roadmap audit (dry run by default)
```

**For board #42, snapshot once and run every check off that file.** The
ProjectV2 API has no server-side field filter, so a full read is ~63 sequential
pages. Re-taking the snapshot per check wastes minutes.

A snapshot is a **read cache, not a source of truth for writes.** Anything
closed or moved since it was taken still reads as open in the file, so
`rollover.py --apply` refuses to run against a snapshot older than 2 hours
(`PHOENIX_SNAPSHOT_MAX_AGE_MIN`; override with `--stale-ok` if you know the file
is still accurate). Re-snapshot before applying, and again afterwards.

Board #45 is ~75 items — one page — so `roadmap.py` just fetches it each run.

Every script that writes is **dry-run by default** and takes `--apply`.

Tunable via env vars: `PHOENIX_MIN_TICKETS` (3), `PHOENIX_MAX_TICKETS` (15),
`PHOENIX_ROSTER_TEAM` (`oss-eng`; comma-separated list of org teams),
`PHOENIX_ROSTER_EXCLUDE` (empty; comma-separated logins to omit from all
reporting), `PHOENIX_ROSTER_INCLUDE` (empty; comma-separated logins to add to
the roster regardless of team membership), `PHOENIX_STANDUP_DAYS` (2),
`PHOENIX_PROJECT_NUMBER` (42), `PHOENIX_SNAPSHOT_MAX_AGE_MIN` (120),
`PHOENIX_ISSUE_LIMIT` (5000). Team-wide values live in `.claude/settings.json`
(`env` block); personal overrides go in `.claude/settings.local.json`. Neither
is read by a plain shell — `export` them when running the scripts outside
Claude Code.

---

## Sprint Operations

Sprints are 14 days, defined by the **Sprint** iteration field on board #42
(field ID `PVTIF_lADOA5FfSM4AIM-TzgFYwU4` — stable). Individual **iteration IDs
rotate every sprint, so always resolve them live**; never hardcode one.

```bash
# Current and upcoming sprints
gh api graphql -F org=Arize-ai -F num=42 -f query='
query($org: String!, $num: Int!) {
  organization(login: $org) { projectV2(number: $num) {
    field(name: "Sprint") { ... on ProjectV2IterationField {
      id configuration { iterations { id title startDate duration } } } } } } }'
```

The current sprint is the iteration whose `[startDate, startDate + duration)`
window contains today.

> **New iterations cannot be created through the API.** If no future sprint
> exists, add it on the Sprint field in the GitHub UI before rolling anything
> over. The scripts fail with a clear message rather than guessing.

### Sprint Close-Out

Run at the end of each sprint. Any ticket still open and not Done rolls to the
next sprint and gets a comment recording the slip.

```bash
./snapshot.sh board.json
./rollover.py board.json                 # 1. review the plan (changes nothing)
./rollover.py board.json --apply         # 2. move them + comment
```

Slip comment posted on each rolled ticket:

```markdown
Slipped from **Sprint 11-21-33** → moved to **Sprint 11-21-34**.

Rolled over during sprint close-out.
```

Useful flags:

| Flag | Effect |
|---|---|
| *(none)* | Dry run — prints the plan, changes nothing |
| `--apply` | Perform the moves and post comments |
| `--stranded` | Also sweep tickets left behind on already-completed sprints |
| `--only 123,456` | Restrict to specific issue numbers |
| `--no-comment` | Move without commenting (use for bulk cleanup of old strays) |
| `--stale-ok` | Apply from a snapshot older than the freshness limit |

**"Stranded" means a sprint that has actually finished**, taken from the board's
own completed-iteration list. Work parked on a *future* iteration is deliberate
planning and is never pulled backwards, no matter how many iterations exist.

**Always review the dry run before `--apply`.** Rolling a sprint comments on
every affected ticket, which notifies every assignee and watcher — it is loud
and not worth undoing by hand.

A ticket whose move succeeded but whose comment failed is reported separately:
it is already in the next sprint, so re-running will not pick it up again.

For the `--stranded` sweep specifically, prefer `--no-comment`: those tickets
slipped many sprints ago and a fresh "slipped" notification on each is noise.

---

## Board Hygiene

The board is only useful if it reflects reality. `health.py` checks six things:

| Check | Why it matters |
|---|---|
| Open tickets tagged to a **past sprint** | Slipped but never rolled — invisible work |
| Status **Done** but issue still **open** | Either close the issue or correct the status |
| **In progress** with no assignee | Nobody actually owns it |
| Current-sprint tickets with no assignee | Committed to but unowned |
| Current-sprint tickets with no Status | Won't appear in any board column |
| Open repo issues **not on the board** | Work that exists but is untracked |

```bash
./health.py board.json --section hygiene
```

Fix stranded past-sprint tickets with `./rollover.py board.json --stranded`.
Add missing issues to the board with the mutation in
[Project Field Mechanics](#project-field-mechanics).

---

## Ticket Load Health

Goal: **keep everyone fed at all times.** Every person on the roster should be
carrying between **3 and 15** tickets. Under 3 means they are about to run dry;
over 15 means they are buried and the queue is not real.

Roster is the live membership of the `PHOENIX_ROSTER_TEAM` team(s) (default
**`@Arize-ai/oss-eng`**), so it self-updates as the teams change. Collaborators
who carry sprint work without belonging to a roster team are added by login via
`PHOENIX_ROSTER_INCLUDE`, and show in the roster label as `+login`. Prefer
adding someone to the org team when that is appropriate — the include list is a
standing override that does not self-update. Logins listed
in `PHOENIX_ROSTER_EXCLUDE` are dropped from the roster and filtered out of
snapshot assignee data at parse time, so they never appear in any report.

```bash
./health.py board.json --section load
```

Two numbers are reported per person, and they answer different questions:

- **sprint** — open, non-Done tickets in the *current sprint*. This is the
  actionable number: it drives who needs work assigned this sprint.
- **total** — open, non-Done tickets assigned anywhere on the board. This is
  *ownership debt*: a large gap between total and sprint means someone is
  nominally accountable for a long tail they are not working.

The report also flags sprint work assigned to people outside the roster team,
which is informational rather than a problem.

### Acting on the report

| Signal | Action |
|---|---|
| Someone under 3 in-sprint | Pull ready tickets from Backlog into the sprint and assign |
| Someone over 15 in-sprint | Re-assign to a starving teammate, or push to next sprint |
| Large ownership debt (high total, low sprint) | Unassign the stale tail, or move it to Backlog |
| Unassigned current-sprint tickets | Assign to whoever is furthest under the minimum |

Assigning and moving to the backlog:

```bash
gh issue edit 14541 --repo Arize-ai/phoenix --add-assignee <login>
gh issue edit 14541 --repo Arize-ai/phoenix --remove-assignee <login>
```

Prefer moving *ready, well-scoped* tickets to a starving teammate over inventing
new ones. Tickets labelled `good-agent-issue` are already scoped tightly enough
to hand off cleanly.

---

## Standup

`standup.py` answers the two standup questions for every roster person:

- **did** — merged PRs they authored and closed issues they were assigned,
  inside the lookback window (default 2 days). Queried live from GitHub search.
- **doing** — their open PRs, plus (with a snapshot) their board items in
  **In progress** or **Needs Review**. Without a snapshot it falls back to open
  assigned issues updated inside the window, which is noisier.

```bash
./snapshot.sh board.json
./standup.py board.json          # recommended: board statuses make "doing" real
./standup.py                     # defaults to board.json; if the file is
                                 # missing, falls back to live-only mode
```

| Flag | Effect |
|---|---|
| `--days N` | Lookback window in days (default 2, `PHOENIX_STANDUP_DAYS`) |
| `--person X` | Only this login; repeatable, accepts non-roster logins too |
| `--json` | Machine-readable output |

Read-only — it never mutates the board or issues. When presenting the report,
lead with people whose **did** is empty *and* whose **doing** is empty or
stale: they are the ones a standup exists to catch.

---

## Roadmap Health

Board [#45](https://github.com/orgs/Arize-ai/projects/45) is the roadmap. The
job is to keep every **current** epic honest about two things: how far along it
is, and how well it is broken down.

```bash
./roadmap.py                 # audit, changes nothing
./roadmap.py --apply         # write planning labels + backfill Status
./roadmap.py --section planning   # one section only:
                                  # progress | planning | freshness | fields
```

### What "current" means

An epic is **current** when it has started (Start Date on or before today, or no
Start Date) and is still open. Everything scheduled for a future quarter is out
of scope — there is no point auditing the specificity of work nobody has begun.

Today that is ~14 of the 46 open epics; the rest are dated Q4 2026 and later.

### How progress is measured

Roadmap progress lives in the **epic body checklist**, not in the Status field
or GitHub sub-issues. Only a minority of epics use real sub-issues, so the audit
parses `- [ ]` / `- [x]` items out of the body and counts an item as a real
ticket when it references an issue (`#1234` or a full issue URL). A bare number
under 1000 does not count — the repo passed that long ago, so `Phase #2` is
prose, not a ticket.

### Needs planning

An epic is flagged when it has **no checklist at all**, or when fewer than
**50% of its remaining (unchecked) items** are real tickets — meaning the work
ahead is still loose bullets.

The ratio deliberately ignores completed items. Epics often record shipped work
as prose (`- [x] OAuth audience scoping ...`), and counting that history would
flag well-run epics as under-planned.

This matches how epics are meant to evolve: **list new scope as generic bullets
first, then promote them to real issues lazily** as they get picked up. The flag
fires when an epic is being worked but its remaining scope has not been
promoted.

Flagged epics get the **`needs planning`** label:

```bash
# One-time setup; --apply creates it automatically if missing
gh label create "needs planning" --repo Arize-ai/phoenix \
  --color FBCA04 --description "Roadmap epic lacks a broken-down plan"

# Find them later
gh issue list --repo Arize-ai/phoenix --label "needs planning" --state open
```

`--apply` also **removes** the label from epics that have since been planned, so
it stays truthful in both directions.

To clear a flag, break the loose bullets into issues (the `to-issues` skill does
this) and link them back into the parent's checklist.

### Other checks

| Check | Meaning |
|---|---|
| **Quiet** | No body edit or comment on a current epic for over 60 days — either dead or unreported |
| **Overdue** | Past its Target Date and still open — re-date it or cut scope |
| **Complete but open** | Every checklist item ticked, issue still open — close it |
| **Missing Status** | Status is empty; the audit proposes a value (see below) |
| **Status disagrees** | Status contradicts the issue's real state |
| **Missing dates** | Open epic with no Start or Target Date |
| **Missing Initiative** | Current epic with no Initiative set (reported, never written) |

Status is inferred from the issue itself, and only ever written with `--apply`:

| Situation | Proposed Status |
|---|---|
| Issue closed | Done |
| Open, started | In Progress |
| Open, future Start Date | Todo |

> Status is currently empty on most of board #45, so the first `--apply` will
> propose a large backfill. Review the dry run before running it.

---

## Label Taxonomy

### Component Labels (`c/`)

Every issue should have at least one component label.

| Label | Area |
|---|---|
| `c/ui` | Frontend / React UI |
| `c/server` | FastAPI backend / server logic |
| `c/traces` | Tracing, spans, OpenTelemetry ingestion |
| `c/evals` | Evaluations framework |
| `c/datasets` | Datasets CRUD and management |
| `c/experiments` | Experiment runs and comparisons |
| `c/annotations` | Human annotations and queues |
| `c/prompts` | Prompt management and prompt SDK |
| `c/playground` | LLM playground and provider support |
| `c/agents` | In-browser or terminal AI agents for Phoenix (PXI) |
| `c/client` | Python/TypeScript SDK and REST client |
| `c/cli` | `@arizeai/phoenix-cli` |
| `c/api` | REST API surface |
| `c/sessions` | Sessions and session tracking |
| `c/otel` | OpenTelemetry / OTel ingestion |
| `c/rbac` | Role-based access control |
| `c/auth` | Authentication |
| `c/infra` | Infrastructure, jobs, storage connectors |
| `c/helm` | Helm chart / Kubernetes deployment |
| `c/mcp` | MCP (Model Context Protocol) integration |
| `c/integrations` | Third-party framework integrations |
| `c/filters` | Filter UI and filter logic |
| `c/metrics` | Metrics and aggregations |
| `c/usability` | Usability and UX papercuts |
| `c/dx` | Developer experience |

### Priority Labels

| Label | Use |
|---|---|
| `priority: highest` | Roadmap epics and critical P0 bugs |
| `priority: high` | Important but not blocking |
| `priority: medium` | Normal queue work |
| `priority: low` | Nice-to-have |

### Size Labels

`size:XS`, `size:S`, `size:M`, `size:L`, `size:XL`, `size:XXL` — rough effort.
Board #42 also has a numeric **Points** field (1, 2, 3, 5) which is the one the
sprint board sorts on; the labels are advisory.

### Type / Status Labels

| Label | Use |
|---|---|
| `roadmap` | High-level roadmap epic |
| `bug` | Something isn't working |
| `enhancement` | New feature or improvement |
| `documentation` | Docs-only change |
| `triage` | Needs triage by the team |
| `blocked` | Blocked on external dependency |
| `backlog` | Acknowledged but not scheduled |
| `needs information` | Awaiting info from the reporter |
| `needs attention` | Needs a maintainer to look |
| `design` | Needs design work before engineering |
| `onboarding` | Related to new-user onboarding flows |
| `phoenix-cloud` | Arize-hosted Phoenix (cloud) specific |
| `user request` | Requested by a user |
| `good-agent-issue` | Well-scoped enough for an AI agent to pick up |
| `agent-in-progress` | An agent is currently working on this issue |
| `good first issue` | Suitable for a new external contributor |

---

## Roadmap Issues

Roadmap issues are high-level epics representing product initiatives.

### Title Format

```
🗺️ [category] Title
```

The `🗺️` prefix marks an epic. Sub-issues that roll up under an epic use the
same `[category]` bracket but drop the emoji (e.g. `[agents] dataset tools`).

**Categories:** `ui/ux`, `agents`, `tools`, `tracing`/`traces`, `sessions`,
`evals`, `server-evals`, `sandboxes`, `annotations`, `prompts`,
`datasets/experiments`, `infrastructure`, `enterprise`, `sdk/connectors`. A few
standalone epics use a product name instead of a bracket (e.g.
`@arizeai/phoenix-cli`, `REST API`).

### Labels per Category

Every roadmap epic gets `roadmap` + `enhancement`. Add `priority: highest` for
actively-prioritized epics, plus the relevant component label(s):

| Category | Component labels |
|---|---|
| `ui/ux` | `c/ui` |
| `agents` | `c/agents` |
| `tools` | `c/agents` (often none beyond `roadmap`) |
| `tracing` / `traces` | `c/traces` |
| `sessions` | `c/sessions`, `c/ui` |
| `evals` | `c/evals` (add `c/playground` when playground-related) |
| `server-evals` / `sandboxes` | `c/evals`, `c/server` |
| `annotations` | `c/annotations` |
| `prompts` | `c/prompts`, `c/playground` |
| `datasets/experiments` | `c/datasets`, `c/experiments` |
| `infrastructure` | `c/infra` |
| `enterprise` | `c/rbac`, `c/auth` |
| `sdk/connectors` | `c/client` |
| `@arizeai/phoenix-cli` | `c/cli`, `c/dx` |
| `REST API` | `c/api`, `c/server` |

### Body Template

Epic bodies are **bare checkbox lists of tickets** — no prose, no rationale.
List new scope as generic bullets first and promote them to detailed sub-issues
lazily, as they get picked up.

Once an epic is current, [Roadmap Health](#roadmap-health) flags it if the
remaining bullets have not been promoted to real issues.

```markdown
<one-line description of the initiative>

## Spike

- [ ]

## Front End

- [ ]

## Back End

- [ ]

## Open Questions

-
```

### Creating a Roadmap Issue

```bash
gh issue create \
  --repo Arize-ai/phoenix \
  --title "🗺️ [category] Title" \
  --label "roadmap,priority: highest,c/ui" \
  --body "$(cat <<'EOF'
Description of the initiative.

## Spike

- [ ]

## Front End

- [ ]

## Back End

- [ ]

## Open Questions

-
EOF
)"
```

> `gh issue create` does not support `--json`. Capture the issue URL from stdout
> and extract the number with `grep -oE '[0-9]+$'`.

### Putting the Epic on the Roadmap Board

An epic is not done being filed until it is on **board #45** with dates. Until
then `roadmap.py` cannot see it, so it is never audited or flagged.

```bash
NODE_ID=$(gh api repos/Arize-ai/phoenix/issues/{number} --jq '.node_id')

ITEM_ID=$(gh api graphql -f query='
  mutation($project: ID!, $content: ID!) {
    addProjectV2ItemById(input: {projectId: $project, contentId: $content}) {
      item { id }
    }
  }' \
  -f project="PVT_kwDOA5FfSM4AJaRo" \
  -f content="$NODE_ID" \
  --jq '.data.addProjectV2ItemById.item.id')
```

Then set Start Date and Target Date on that `$ITEM_ID` with
[Set a Date Field](#set-a-date-field-board-45). Both are board-#45 field IDs and
only work with an item ID from board #45.

---

## Project Field Mechanics

Field IDs below are stable. Iteration (sprint) IDs are **not** — resolve those
live, see [Sprint Operations](#sprint-operations).

### Board #42 — phoenix (sprint board)

| Field | ID |
|---|---|
| Project ID | `PVT_kwDOA5FfSM4AIM-T` |
| Status | `PVTSSF_lADOA5FfSM4AIM-TzgFJPQg` |
| Sprint (iteration) | `PVTIF_lADOA5FfSM4AIM-TzgFYwU4` |
| Points | `PVTSSF_lADOA5FfSM4AIM-TzgHhukw` |
| Priority (number) | `PVTF_lADOA5FfSM4AIM-TzgNgl3g` |

**Status options** (note the emoji and spacing are part of the name):

| Status | Option ID |
|---|---|
| Backlog | `71ea9c79` |
| 📘  Todo | `f75ad846` |
| 👨‍💻  In progress | `47fc9ee4` |
| 🔍. Needs Review | `35410d8c` |
| 👍  Approved | `d85daefa` |
| ✅  Done | `98236657` |

**Points options:** 1 `5694a02d`, 2 `e50f7f7e`, 3 `268e6755`, 5 `4f52b74b`

### Board #45 — phoenix roadmap

| Field | ID |
|---|---|
| Project ID | `PVT_kwDOA5FfSM4AJaRo` |
| Start Date | `PVTF_lADOA5FfSM4AJaRozgInoCI` |
| Target Date | `PVTF_lADOA5FfSM4AJaRozgInn58` |
| Status | `PVTSSF_lADOA5FfSM4AJaRozgFw9n0` |
| Initiative | `PVTSSF_lADOA5FfSM4AJaRozg-EB08` |
| Sub-issues progress | `PVTF_lADOA5FfSM4AJaRozgXC5Zs` |

**Status options:** Todo `f75ad846`, In Progress `47fc9ee4`, Done `98236657`

**Initiative options:** Agents `b38eaffc`, infrastructure `fdb510cd`,
enterprise `4b78ba6c`. Currently unset on every item — `roadmap.py` reports it
for current epics but never writes it.

### Add an Issue to a Board

Pass the project ID of the board you mean: **#42** for sprint work,
**#45** for roadmap epics. The returned `$ITEM_ID` is scoped to that board —
using it against the other one fails.

```bash
NODE_ID=$(gh api repos/Arize-ai/phoenix/issues/{number} --jq '.node_id')

# Sprint board #42: PVT_kwDOA5FfSM4AIM-T
# Roadmap board #45: PVT_kwDOA5FfSM4AJaRo
ITEM_ID=$(gh api graphql -f query='
  mutation($project: ID!, $content: ID!) {
    addProjectV2ItemById(input: {projectId: $project, contentId: $content}) {
      item { id }
    }
  }' \
  -f project="PVT_kwDOA5FfSM4AIM-T" \
  -f content="$NODE_ID" \
  --jq '.data.addProjectV2ItemById.item.id')
```

### Set the Sprint (iteration)

```bash
gh api graphql -f query='
  mutation($project: ID!, $item: ID!, $field: ID!, $iter: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $project, itemId: $item, fieldId: $field,
      value: {iterationId: $iter}
    }) { projectV2Item { id } }
  }' \
  -f project="PVT_kwDOA5FfSM4AIM-T" \
  -f item="$ITEM_ID" \
  -f field="PVTIF_lADOA5FfSM4AIM-TzgFYwU4" \
  -f iter="$ITERATION_ID"
```

### Set a Single-Select Field (Status, Points)

```bash
gh api graphql -f query='
  mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $project, itemId: $item, fieldId: $field,
      value: {singleSelectOptionId: $option}
    }) { projectV2Item { id } }
  }' \
  -f project="PVT_kwDOA5FfSM4AIM-T" \
  -f item="$ITEM_ID" \
  -f field="PVTSSF_lADOA5FfSM4AIM-TzgFJPQg" \
  -f option="47fc9ee4"
```

### Set a Date Field (board #45)

```bash
gh api graphql -f query='
  mutation($project: ID!, $item: ID!, $field: ID!, $value: Date!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $project, itemId: $item, fieldId: $field,
      value: {date: $value}
    }) { projectV2Item { id } }
  }' \
  -f project="PVT_kwDOA5FfSM4AJaRo" \
  -f item="$ITEM_ID" \
  -f field="PVTF_lADOA5FfSM4AJaRozgInoCI" \
  -f value="2026-04-01"
```

### Remove an Item from a Board

```bash
gh api graphql -f query='
  mutation($project: ID!, $item: ID!) {
    deleteProjectV2Item(input: {projectId: $project, itemId: $item}) {
      deletedItemId
    }
  }' \
  -f project="PVT_kwDOA5FfSM4AIM-T" \
  -f item="$ITEM_ID"
```

---

## Standard Issues

### Bug Report

```bash
gh issue create \
  --repo Arize-ai/phoenix \
  --title "Short description of the bug" \
  --label "bug,triage,c/traces" \
  --body "..."
```

### Feature Request

```bash
gh issue create \
  --repo Arize-ai/phoenix \
  --title "Short description of the feature" \
  --label "enhancement,c/ui" \
  --body "..."
```

---

## Querying

The board and roadmap change constantly — query live rather than trusting a
snapshot in this file.

```bash
# Open issues on the sprint board (fast; search-based)
gh issue list --repo Arize-ai/phoenix \
  --search "project:Arize-ai/42 is:open" --limit 200 \
  --json number,title,assignees

# All open roadmap epics
gh issue list --repo Arize-ai/phoenix --label roadmap --state open \
  --limit 100 --json number,title --jq '.[] | "\(.number)\t\(.title)"'

# Roadmap epics currently flagged as needing planning
gh issue list --repo Arize-ai/phoenix --label "needs planning" --state open \
  --json number,title --jq '.[] | "\(.number)\t\(.title)"'

# Roadmap epics for a component
gh issue list --repo Arize-ai/phoenix --label "roadmap,c/evals" --state open \
  --json number,title --jq '.[] | "\(.number)\t\(.title)"'

# Unassigned, ready-to-pick-up work (feed a starving teammate from here)
gh issue list --repo Arize-ai/phoenix --state open \
  --label good-agent-issue --search "no:assignee" --json number,title
```

`gh issue list --search "project:Arize-ai/42 ..."` is fast but **cannot see
project field values** (Sprint, Status, Points). Anything that depends on those
needs the full board snapshot — use `scripts/snapshot.sh`.

Epics group their child issues as a markdown checklist in the body (often
bucketed by Phoenix surface — Datasets, Prompts, Playground, Experiments,
Evals — with a `## ✅ Completed` section). When filing a sub-issue, link it back
from the parent's checklist.
