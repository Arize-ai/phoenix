---
name: phoenix-pr-description
description: >
  Writes and maintains the body of a pull request opened by a coding agent on Arize-ai/phoenix,
  including a fixed "How this PR was made" section that reports steering, abandoned approaches,
  and verification gaps so a reviewer can pick a review depth. Use when opening a PR, editing a
  PR body, pushing more commits to an agent-authored PR, or when the user asks for a PR
  description, PR summary, or provenance section.
user-invocable: true
metadata:
  internal: true
---

# Phoenix PR Description

A PR body lets a reviewer answer three questions at a glance: do I need to review this, how long
will review and testing take, and should I hand it to my agent. Write only what serves those
three. The author can always extend the body; a body nobody reads cannot be shortened after the
fact.

Default to short. A one-line What plus the provenance table is a complete body. Add a section only
when a reviewer needs it to answer one of the three questions.

## Template

Use these H2 headings in this order. Omit a heading when it would be empty. Never add others.

```markdown
resolves #<issue>            <- only when an issue exists

## What
<one sentence: the change, ticket, dependency such as "Stacked on #16660">
<media: one video or screenshot; required when the PR changes rendered UI>
<optional: up to 4 bullets, one sentence each, behavior not files>

## Try it                    <- only when a reviewer can exercise the change in under a minute
1. <step ending in what the reviewer should observe>

## How this PR was made
| Agent | User turns | Steering turns | Questions asked | Sessions |
|---|---|---|---|---|
| <tool (model)> | n | n | n | n |

**Starting point:** <the ask in a few words>; <bare / with constraints / with spec>
**Steering:** <categories only, from: scope, approach, correctness, style> or none
**Abandoned:** <approach, reason> or none
**Verified:** <what ran>. Not verified: <gap> or none
**Look hardest at:** <riskiest hunks>

<sub>Stats as of <short sha>, counted from <method>.</sub>
```

Limits, all hard:

- What: one sentence, then at most 4 bullets of one sentence each. No Why section; fold the reason
  into the sentence only when it is not obvious from the ticket.
- Bold only on-screen control names. Code font for identifiers. No nested bullets, no file lists,
  no "Summary" or "Changes" headings, no closing paragraph.
- Each provenance line is one line of at most 12 words. Steering names categories, not details.
- Media: one item, bold caption above it stating what to notice. Required when the PR changes what
  a user sees (components, styles, layout, motion); capture it with the `phoenix-pr-screenshot`
  skill. When it cannot be captured, say why in What instead.
- Total body above the provenance section fits on one screen without scrolling.

Reference: Arize-ai/phoenix#16662 is the upper bound for a large change. Most PRs should be far
shorter. See [examples.md](examples.md) for a large, a small, and a non-UI body.

## Provenance definitions

| Field | Count |
|---|---|
| Agent | Tool and model, as the user names them |
| User turns | Messages the human typed. Exclude approvals, tool results, system messages |
| Steering turns | User turns that changed scope or approach or corrected output. Exclude "continue", answers to the agent's questions, approvals. Borderline counts |
| Questions asked | Times the agent stopped to ask before acting |
| Sessions | Distinct conversations, counting resumes and compactions separately |

Describe the work, not the person. Paraphrase the ask; never quote it. Write "none" rather than
omitting a line. Never grade the PR ("low risk", "thorough"). A one-prompt, zero-steering PR is a
normal outcome and is reported as such.

## Counting

Count from a record, not memory. One method is given; invent the equivalent for your own tool.

Claude Code writes each session to `~/.claude/projects/<slug>/<session>.jsonl`, where the slug is
the working directory with `/` replaced by `-`. Human messages are `user` entries whose
`message.content` is a string:

```bash
f=$(ls -t ~/.claude/projects/$(pwd | sed 's#/#-#g')/*.jsonl | head -1)
jq -r 'select(.type=="user" and (.message.content|type)=="string") | .message.content' "$f"
```

Pipe through `wc -l` for user turns; read the lines to classify steering. Sum across files when
several sessions contributed. With no record, or after a compaction, write `approx.` after each
number and name the method in the stamp as "recall".

## Keeping it current

Every edit to the body, including after review rounds, recounts the table and rewrites the stamp
with the commit the stats cover. Reviewer-driven turns are user turns and usually steering turns.

## Before posting

- [ ] Body above the provenance section fits on one screen
- [ ] What is one sentence plus at most 4 one-sentence bullets
- [ ] A UI change carries media, or What says why it has none
- [ ] Every provenance line is present, one line, 12 words or fewer
- [ ] Counts came from a record, or every number carries `approx.`
- [ ] Stamp names the current head commit
