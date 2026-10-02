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

A PR body exists so a developer can answer three questions at a glance:

1. Do I need to review this?
2. How long will it take to review and test?
3. Should I hand the review to my agent?

Everything in the body serves those three decisions. The top says what the change does and how
to see it working. The bottom says how the change came to be, so the reader can pick a review
depth before opening the diff. Dense explanation belongs in the code, the docs, or the ticket,
not here.

Glanceability test: the reader should be able to answer all three questions from the headings,
the first line of What, the bold text, and the provenance table alone. If they have to read a
paragraph to get there, cut.

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

Body length scales with the number of distinct behaviors, not with the diff. Target: everything
above the provenance section fits on one screen and reads in under a minute.

### What

Lead with media when the change is visible: a short video for an interaction, one screenshot
otherwise. Then one line that names the change, its ticket, and any dependency ("Stacked on
#16660"). That line carries most of the weight. Then bullets.

- Three to six bullets, one per user-visible behavior, one sentence each, about twenty words.
- Add the design reason as a trailing clause only when it is not obvious: "It is a toggle, so
  the toolbar never shifts." Reasons never get their own sentence.
- Describe behavior, not files. Name a mechanism or file only when the reviewer needs it to
  judge correctness, such as a key that is hidden and restored on save.
- An edge case that could lose or corrupt data gets its own bullet with the evidence attached:
  "Verified live: an edited example kept its expected output."
- Bold the names of on-screen controls exactly as they appear (**Save dataset version**). Use
  code font for identifiers. Nothing else is bold.
- No nested bullets, no "Summary" or "Changes" headings, no per-file lists, no closing paragraph.

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
It consists of a table, five labeled lines, and a stamp. Each labeled line is one line: a
fragment or a short sentence, fifteen words or so, no explanation. The table answers "how much
steering"; the lines answer "where is the risk".

```markdown
## How this PR was made

| Agent | User turns | Steering turns | Questions asked | Sessions |
|---|---|---|---|---|
| Claude Code (claude-fable-5-1) | 11 | 3 | 1 | 2 |

**Starting point:** <one phrase: the ask, then bare / with constraints / with spec>
**Steering:** <category: what changed> or "none"
**Abandoned:** <approach, reason> or "none"
**Verified:** <what ran>. Not verified: <gap> or "none"
**Look hardest at:** <the riskiest hunks>

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

- **Starting point.** The ask in a few words, then one of: bare task, with constraints, with
  spec. Paraphrase, do not quote. Prompts can contain internal names or pasted secrets.
- **Steering.** Category and what changed, as fragments: "approach: regenerate schemas, not
  hand-edit". Categories are scope, approach, correctness, style. Describe the work, not the
  person.
- **Abandoned.** Approach and the reason it lost, in one clause. Reviewers value this field most
  and agents omit it most. Write "none" rather than leaving it out.
- **Verified.** What ran and who confirmed what, then "Not verified:" and the honest gap.
- **Look hardest at.** The hunks the agent did not read closely, generated code, migrations, or
  anything an abandoned approach touched. Never grade the PR ("low risk", "thorough"). Facts
  only; the reviewer judges.

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
Arize-ai/phoenix#16662, the reference for the right size of body for a large change.

```markdown
## What

<video>

Edit a dataset's examples without leaving the playground (PHX-1116). Stacked on #16660.

- **Edit** in the Experiment toolbar starts the examples page's edit session in place. It is a
  toggle, so the toolbar never shifts.
- A pencil on a hovered row's cells opens that cell's editor in one press. Disabled during a run.
- Metadata edits keep the hidden `annotations` key, so expected outputs survive. Verified live.
- Runs, the dataset picker, and expected-output annotation pause while editing.

## Why

PHX-1116. People notice a wrong example while reviewing evaluator results; fixing it should not
mean a trip to the dataset page.

## Screenshots

**Edit mode: new example on top, edit toolbar at the bottom, Run disabled**

![Playground table in edit mode](...)

## Try it

1. Open the playground with a dataset and an evaluator, run it.
2. **Edit**, change a metadata value, **Done**, **Save changes**. The cell updates and the
   expected output band is unchanged.

## How this PR was made

| Agent | User turns | Steering turns | Questions asked | Sessions |
|---|---|---|---|---|
| Claude Code (claude-fable-5-1) | 14 | 4 | 1 | 2 |

**Starting point:** inline example editing in the playground table, reuse the examples page's
session. With constraints.
**Steering:** scope: per-cell undo dropped; approach: toggle instead of a Done button;
correctness: hidden `annotations` key must survive edits; style: one caption.
**Abandoned:** separate playground edit toolbar; the examples page's toolbar already did it.
**Verified:** `pnpm test`, `pnpm typecheck`; agent and user edited an example live. Not
verified: more than one dataset loaded.
**Look hardest at:** the save path that merges hidden metadata back in; regenerated Relay
fragments.

<sub>Stats as of 3f9c2a1, counted from the Claude Code transcripts for two sessions.</sub>
```
