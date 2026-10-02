---
name: phoenix-pr-description
description: >
  Write or update the body of a pull request opened by a coding agent on Arize-ai/phoenix. Covers
  the body's shape (What, Why, media, Try it) and a fixed "How this PR was made" section that
  reports how much steering, verification, and backtracking went into the change so a reviewer can
  pick a review depth. Use whenever opening a PR, editing a PR body, pushing more commits to an
  agent-authored PR, or when the user asks for a PR description, PR summary, or provenance section.
user-invocable: true
metadata:
  internal: true
---

# Phoenix PR Description

A PR body has two jobs. The top tells a reviewer what the change does and how to see it working.
The bottom tells them how the change came to be, so they can decide how carefully to read a diff
before they read it. A one-prompt fix and a twelve-turn full-stack change deserve different
review depth, and the body is where the reviewer learns which one they are looking at.

This skill is not a scorecard. Many tasks are worth one short prompt and no steering, and the
provenance section says so plainly when that is what happened.

## Body shape

Use exactly these H2 headings, in this order. Skip a heading only when the section would be
empty, and never add others.

```markdown
resolves #<issue>            <- only when an issue exists; keep the template's first line

## What
## Why
## Screenshots              <- or "## Before / after" for non-UI changes
## Try it
## How this PR was made
```

Body length scales with the number of distinct behaviors, not with the diff. A 1,500-line change
with six behaviors gets six bullets. Target: a reviewer reads everything above the provenance
section in under two minutes.

### What

Lead with media when the change is visible: a short video for an interaction, one screenshot
otherwise. Then one line that names the change, its ticket, and any dependency ("Stacked on
#16660"). Then bullets.

- One bullet per user-visible behavior. One to three sentences each.
- Attach the design reason as a trailing clause of the same sentence: "It is a toggle, so the
  toolbar never shifts." Reasons never get their own paragraph.
- Describe behavior, not files. The diff lists files. Name a mechanism or a file only when the
  reviewer needs it to judge correctness, such as a key that is hidden and restored on save.
- Edge cases that could lose or corrupt data get their own bullet, with the evidence in the same
  sentence: "Verified live: an edited example kept its recorded expected output."
- Bold the names of on-screen controls exactly as they appear (**Save dataset version**). Use
  code font for identifiers. Nothing else is bold.
- No nested bullets, no "Summary" or "Changes" headings, no per-file lists.

### Why

Two sentences. The ticket or issue, then the situation that motivates the change. Do not restate
What.

### Screenshots or Before / after

For UI changes, each image gets a bold caption above it that says what to notice ("Edit mode: Run
disabled"). For non-UI changes, use a `## Before / after` section instead: a two-column table of
responses, log lines, timings, or query plans.

### Try it

Numbered steps a reviewer can execute. Each step ends with what they should observe. For UI
changes the steps are clicks. For backend, CLI, or client changes the steps are commands with the
expected output underneath in a code block. Test commands you ran do not belong here; they go in
the provenance section.

### Non-UI changes

The shape is the same. "Screenshots" becomes "Before / after". "Try it" uses `curl`, GraphQL, a
CLI invocation, or a Python or TypeScript snippet. Bullets stay at the level of observable
behavior: what a caller receives, what a migration does to existing rows, what a flag changes.

## How this PR was made

This section is fixed-shape so reviewers learn to read it at a glance and compare across PRs.
It consists of a table, five labeled lines, and a stamp.

```markdown
## How this PR was made

| Agent | User turns | Steering turns | Questions asked | Sessions |
|---|---|---|---|---|
| Claude Code (claude-fable-5-1) | 11 | 3 | 1 | 2 |

**Starting point:** <paraphrase of the first ask and how specific it was>
**Steering:** <what changed, by category> or "none"
**Abandoned:** <approaches tried and reverted, with the reason> or "none"
**Verified:** <what the agent checked, what the user checked>. Not verified: <gaps> or "none"
**Look hardest at:** <one line pointing at the riskiest hunks>

<sub>Stats as of <short sha>, counted from <method>.</sub>
```

For a small change the whole section may be the table and one line, and that is the correct
output: "One prompt, no steering. `make test` green."

### Column definitions

Use these definitions, not your impression of them.

| Column | Count |
|---|---|
| Agent | The tool and model that did the work, as the user would name them |
| User turns | Messages the human typed. Exclude permission approvals, tool results, and system messages |
| Steering turns | User turns that changed scope or approach, or corrected an output. Exclude "continue", "yes", answers to a question the agent asked, and approvals |
| Questions asked | Times the agent stopped to ask the user something before acting |
| Sessions | Distinct conversations that contributed, counting resumes and context compactions as separate sessions |

### Labeled lines

- **Starting point.** Paraphrase the first ask in one sentence, then classify it: a bare task
  ("implement X"), a task with constraints (preferences, cautions, file pointers), or a task with
  a plan or spec. Paraphrase, do not quote. Prompts can contain internal names or pasted secrets.
- **Steering.** What changed and why, grouped as scope, approach, correctness, or style. Describe
  the work, not the person: "direction changed to regenerate schemas rather than hand-edit", not
  "the user corrected me".
- **Abandoned.** Approaches tried and reverted, each with the reason it lost. This is the field
  reviewers value most and the one agents most often omit. Write "none" rather than leaving it out.
- **Verified.** Split what the agent ran (tests, typecheck, clicked through the UI) from what the
  user confirmed. Follow with "Not verified:" and the honest gaps.
- **Look hardest at.** One line. Point at hunks the agent did not read closely, generated code,
  migrations, or anything touched by an abandoned approach. Never grade the PR ("low risk",
  "thorough"). Report facts and let the reviewer judge.

### Counting turns

Count from a record, not from memory. The record depends on the agent you are, so one worked
method is given here and you are expected to invent the equivalent for your own tool.

Claude Code writes each session to a JSONL file under `~/.claude/projects/<slug>/`, where the
slug is the working directory with `/` replaced by `-`. Entries of type `user` whose
`message.content` is a string are messages the human typed. Entries whose content is a list are
tool results and are excluded by the type check.

```bash
dir=~/.claude/projects/$(pwd | sed 's#/#-#g')
f=$(ls -t "$dir"/*.jsonl | head -1)   # or pick the session ids that contributed
jq -r 'select(.type=="user" and (.message.content|type)=="string") | .message.content' "$f"
```

Pipe through `wc -l` for the user-turn count. Read the messages themselves to classify steering
turns against the definition above. First and last timestamps give the wall-clock span if you
want to mention it. When several sessions contributed, run it per file and sum.

If you are a different agent, find your own session record (a transcript file, an exported chat,
a history command) and count the same things. If no record exists and you can only count from
context, write `approx.` after each number and name the method in the stamp as "recall". After a
context compaction, the early history is a summary, so say so and mark the counts approximate.

Steering classification is a judgment. Apply the definition, not your feelings, and when a
message is borderline, count it.

### Keeping the section current

- Every time you edit the body, including after review rounds and follow-up pushes, recount and
  rewrite the table and the stamp. The stamp names the commit the stats cover so a reviewer can
  tell whether later commits are included.
- Review-round steering counts. If a reviewer's comments led to more turns, those are user turns
  and often steering turns.
- Never round down. Never drop a labeled line because it is empty; write "none".

## Worked example

A UI change of about 1,500 lines, six behaviors, two sessions. The top half follows
Arize-ai/phoenix#16662, which is the reference for the right size of body for a large change.

```markdown
## What

<video>

Edit a dataset's examples without leaving the playground (PHX-1116). Stacked on #16660.

- **Edit** in the Experiment toolbar starts the same edit session the dataset examples page
  runs. It is a toggle, so the toolbar never shifts.
- A pencil in each cell's header strip, shown while the row is hovered, starts the session and
  opens that cell's editor in one press. Disabled during a run, like **Edit**.
- The metadata column may hide the `annotations` key that holds expected outputs. Edits are made
  against the displayed metadata and the hidden part is put back on save, so a metadata edit
  cannot drop an example's expected outputs. Verified live: an edited example kept its recorded
  expected output.

## Why

PHX-1116. Reviewing evaluator results is where people notice an example is wrong; fixing it
should not mean a trip to the dataset page and back.

## Screenshots

**Edit mode: a new example on top, the edit toolbar along the bottom, Run disabled**

![Playground table in edit mode](...)

## Try it

1. Open the playground with a dataset and an evaluator, run it.
2. Press **Edit**, change a metadata value, **Done**, then **Save changes**. The cell shows the
   new value and the expected output band is unchanged.

## How this PR was made

| Agent | User turns | Steering turns | Questions asked | Sessions |
|---|---|---|---|---|
| Claude Code (claude-fable-5-1) | 14 | 4 | 1 | 2 |

**Starting point:** add inline example editing to the playground table, with a pointer to reuse
the dataset examples page's edit session. Task with constraints.
**Steering:** scope (dropped the per-cell undo, follow-up); approach (toggle button instead of a
separate Done button, so the toolbar does not shift); correctness (hidden `annotations` key must
survive a metadata edit); style (one caption rewrite).
**Abandoned:** a separate edit toolbar component for the playground, reverted because the
examples page's toolbar already handled add, remove, and save once it took a dataset version id.
**Verified:** `pnpm test` and `pnpm typecheck` by the agent; the agent and the user both edited
an example live and checked the expected output band. Not verified: behavior with more than
one dataset loaded.
**Look hardest at:** the save path that merges hidden metadata back in, and the Relay
fragments regenerated for the toolbar.

<sub>Stats as of 3f9c2a1, counted from the Claude Code transcripts for two sessions.</sub>
```
