# PR body examples

## Contents
- Small change
- Large UI change
- Non-UI change

## Small change

```markdown
## What
Pause live streaming while a trace or session drawer is open, so the tables behind the drawer stop refetching every 2s.

## How this PR was made
| Agent | User turns | Steering turns | Questions asked | Sessions |
|---|---|---|---|---|
| Claude Code (claude-fable-5-1) | 1 | 0 | 0 | 1 |

**Starting point:** fix drawer refetch loop; bare task
**Steering:** none
**Abandoned:** none
**Verified:** `pnpm test`, `pnpm typecheck`. Not verified: none
**Look hardest at:** the `useParams` read in the parent route

<sub>Stats as of 553e5af, counted from the Claude Code transcript.</sub>
```

## Large UI change

Condensed from Arize-ai/phoenix#16662, which is the upper bound for a large change.

```markdown
## What
Edit a dataset's examples from the playground table (PHX-1116). Stacked on #16660.

<video>

- **Edit** in the Experiment toolbar starts the examples page's edit session in place; it is a toggle, so the toolbar never shifts.
- A pencil on a hovered row's cells opens that cell's editor in one press.
- Metadata edits keep the hidden `annotations` key, so expected outputs survive. Verified live.
- Runs and the dataset picker pause while editing.

## Try it
1. Open the playground with a dataset and an evaluator, run it.
2. **Edit**, change a metadata value, **Done**, **Save changes**. The cell updates and the expected output band is unchanged.

## How this PR was made
| Agent | User turns | Steering turns | Questions asked | Sessions |
|---|---|---|---|---|
| Claude Code (claude-fable-5-1) | 14 | 4 | 1 | 2 |

**Starting point:** inline example editing in the playground; with constraints
**Steering:** scope, approach, correctness, style
**Abandoned:** separate playground edit toolbar; the examples page's already fit
**Verified:** `pnpm test`, `pnpm typecheck`, live edit by agent and user. Not verified: multiple datasets
**Look hardest at:** the save path merging hidden metadata; regenerated Relay fragments

<sub>Stats as of 3f9c2a1, counted from the Claude Code transcripts for two sessions.</sub>
```

## Non-UI change

```markdown
## What
Each recorded datagen application now sends to its own project instead of one shared `phoenix-datagen` project.

| Before | After |
|---|---|
| 1 project, 9 applications mixed | 9 projects, one per application |

## Try it
1. Run `uv run phoenix datagen` against a local server. The projects page lists `support-chatbot`, `coding-agent`, and seven more.

## How this PR was made
| Agent | User turns | Steering turns | Questions asked | Sessions |
|---|---|---|---|---|
| Cursor (claude-opus-5-5) | 3 approx. | 1 approx. | 0 | 1 |

**Starting point:** one project per datagen application; bare task
**Steering:** style
**Abandoned:** none
**Verified:** `make test`; datagen run against a local server. Not verified: PostgreSQL
**Look hardest at:** the project-name fallback for unlisted cells

<sub>Stats as of 7994b9d, counted from recall.</sub>
```
