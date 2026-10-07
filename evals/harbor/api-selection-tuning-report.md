# API-selection tuning on the dev set (2026-10-06)

Goal: make agents call SQL when a question is an aggregate and REST/GraphQL when it names one
entity, by editing prompts and tool text only. Measured on the 124-task `api-selection-dev`
set (52 SQL, 72 HTTP) over the scrubbed `phoenix.db` fixture. The test set was run once before and once after tuning (section below).

- Dashboard (10 phases, confusion matrices, per-domain and per-phase views):
  https://claude.ai/artifact/NZsLdQqhrNBivQm64vouSC
- Phoenix dataset: https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments
- Branch `harbor-sql-api-benchmarks` (PR #16778), commits `6db24053c3` (infra), `0d00fe3311`
  (routing rule), `a590b28ec0` (PXI fix). Not yet pushed: the rebase onto main needs
  `git push --force-with-lease origin harbor-sql-api-benchmarks`.

Cells below read **routing accuracy / SQL precision / SQL recall / reward**, with "ran
`executeSql`" as the positive class. Each cell links to its Phoenix experiment. One trial per
task; differences under about 0.05 are within run-to-run noise.

## Headline: baseline versus final, full dev runs

| Condition | baseline | round 3 full re-run | final (round 4) full re-run |
|---|---|---|---|
| Claude Code + MCP · Fable 5.1 | 0.78 / 0.71 / 0.81 / 0.90 ([6394](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2Mzk0)) | 0.78 / 0.67 / 0.94 / 0.94 ([6434](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM0)) | 0.78 / 0.67 / 0.94 / 0.94 ([6434](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM0)) |
| Claude Code + MCP · Opus 5 | 0.72 / 0.61 / 0.92 / 0.89 ([6395](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2Mzk1)) | 0.73 / 0.61 / 0.98 / 0.93 ([6435](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM1)) | 0.73 / 0.61 / 0.98 / 0.93 ([6435](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM1)) |
| Codex + MCP · GPT-6 Astra | 0.65 / 0.56 / 0.87 / 0.93 ([6396](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2Mzk2)) | 0.85 / 0.74 / 0.98 / 0.94 ([6436](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM2)) | 0.85 / 0.74 / 0.98 / 0.94 ([6436](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM2)) |
| Codex + MCP · GPT-5.6 | 0.74 / 0.69 / 0.71 / 0.86 ([6397](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2Mzk3)) | 0.84 / 0.72 / 1.00 / 0.90 ([6437](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM3)) | 0.84 / 0.72 / 1.00 / 0.90 ([6437](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM3)) |
| PXI · Fable 5.1 | 0.92 / 1.00 / 0.81 / 0.95 ([6398](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2Mzk4)) | 0.89 / 0.80 / 0.98 / 0.93 ([6438](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM4)) | 0.97 / 0.96 / 0.96 / 0.94 ([6442](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQy)) |
| PXI · Opus 5 | 0.91 / 1.00 / 0.79 / 0.97 ([6399](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2Mzk5)) | 0.76 / 0.64 / 0.96 / 0.94 ([6439](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDM5)) | 0.87 / 0.79 / 0.94 / 0.94 ([6443](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQz)) |
| PXI · GPT-6 Astra | 0.86 / 0.75 / 1.00 / 0.93 ([6400](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDAw)) | 0.93 / 0.85 / 1.00 / 0.93 ([6440](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQw)) | 0.95 / 0.90 / 1.00 / 0.93 ([6444](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQ0)) |
| PXI · GPT-5.6 | 0.81 / 0.72 / 0.92 / 0.93 ([6401](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDAx)) | 0.85 / 0.73 / 1.00 / 0.92 ([6441](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQx)) | 0.92 / 0.85 / 0.98 / 0.94 ([6445](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQ1)) |

Claude Code and Codex are unchanged between the round-3 and final columns (round 4 only
touched PXI). SQL recall, the problem being tuned, went from 0.71–0.92 to 0.94–1.00 in every
condition. Seven of eight conditions improved or held on accuracy; PXI Opus traded 21 points
of precision for 15 of recall and sits 4 points under baseline. Reward moved by at most 0.04.
The final columns for Claude Code were run with the REST tool map, which the PR later dropped;
the shipped text scored 0.73 / 0.60 / 1.00 / 0.95 and 0.69 / 0.57 / 0.98 / 0.92 (ablation D
below).

## What changed

All edits are text. The shared rule lives in `PHOENIX_MCP_DATA_ACCESS_INSTRUCTIONS.xml` beside
the other prompts; `src/phoenix/server/mcp/routing.py` loads it and repeats its two sentences on
the tools.

1. **Rule sentences.** SQL "when the answer is computed over many traces, spans, sessions, runs,
   or examples at once ... do not page through REST results and aggregate them in code"; REST
   "when the question identifies one thing and wants its fields or what hangs off it, even as a
   count or a list". Shown in the MCP server `initialize` instructions, the `executeSql` and
   `describeSqlSchema` descriptions, and the code-mode `execute` description.
2. **REST tool map (dropped).** The server instructions named the lookup tool per resource
   (`getProject`, `getSpans(project_identifier, trace_id)`, `getSession`, `getDataset`,
   `getExperiment`, `listExperimentRuns`, `getPromptVersionLatest`, ...). It added 4–5 points
   for Claude Code on dev (ablation D) and nothing elsewhere, and was dropped from the PR as not
   worth a tool list in the prompt. The shipped block tells the client to find the tool with
   `search`, `tags`, or `list_tools`.
3. **REST before SQL, entity first.** The instructions and `executeSql` description lead with the
   REST rule and open with "first ask whether the question names one entity".
4. **PXI keeps GraphQL.** PXI appends the server's instructions to its own; the new block said
   "REST or SQL" and never mentioned GraphQL, so PXI dropped `phoenix-gql` for SQL on lookups.
   `without_data_access()` strips that block for PXI, and PXI's own XML carries a lookup-first
   rule naming `phoenix-gql`.

## How it went: rounds

Rounds 1–3 re-ran only the tasks that failed in the previous round, so these columns are
projections (previous results kept for everything else). Experiments link to the rerun jobs.

| Condition | round 1 (projected) | round 2 (projected) | round 3 (projected) |
|---|---|---|---|
| Claude Code + MCP · Fable 5.1 | 0.84 / 0.72 / 1.00 / 0.96 ([6412](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDEy)) | 0.84 / 0.72 / 1.00 / 0.94 ([6418](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDE4)) | 0.84 / 0.72 / 1.00 / 0.94 ([6427](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDI3)) |
| Claude Code + MCP · Opus 5 | 0.73 / 0.61 / 0.98 / 0.92 ([6413](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDEz)) | 0.74 / 0.62 / 0.98 / 0.91 ([6419](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDE5)) | 0.79 / 0.67 / 0.98 / 0.91 ([6426](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDI2)) |
| Codex + MCP · GPT-6 Astra | 0.84 / 0.72 / 1.00 / 0.93 ([6414](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDE0)) | 0.88 / 0.78 / 1.00 / 0.93 ([6420](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDIw)) | 0.89 / 0.79 / 1.00 / 0.94 ([6428](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDI4)) |
| Codex + MCP · GPT-5.6 | 0.87 / 0.76 / 1.00 / 0.90 ([6411](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDEx)) | 0.88 / 0.78 / 1.00 / 0.92 ([6421](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDIx)) | 0.91 / 0.83 / 1.00 / 0.91 ([6429](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDI5)) |
| PXI · Fable 5.1 | 0.99 / 1.00 / 0.98 / 0.95 ([6417](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDE3)) | 0.99 / 1.00 / 0.98 / 0.97 ([6422](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDIy)) | 0.99 / 1.00 / 0.98 / 0.97 ([6430](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDMw)) |
| PXI · Opus 5 | 0.98 / 1.00 / 0.96 / 0.98 ([6410](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDEw)) | 0.99 / 1.00 / 0.98 / 0.98 ([6423](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDIz)) | 0.99 / 1.00 / 0.98 / 0.98 ([6431](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDMx)) |
| PXI · GPT-6 Astra | 0.92 / 0.84 / 1.00 / 0.94 ([6416](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDE2)) | 0.97 / 0.93 / 1.00 / 0.93 ([6424](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDI0)) | 0.98 / 0.95 / 1.00 / 0.94 ([6432](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDMy)) |
| PXI · GPT-5.6 | 0.91 / 0.83 / 1.00 / 0.94 ([6415](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDE1)) | 0.94 / 0.88 / 1.00 / 0.94 ([6425](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDI1)) | 0.95 / 0.90 / 1.00 / 0.94 ([6433](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDMz)) |

The round-3 full re-run (table above) exposed what the projections hid: PXI Claude lookups had
collapsed (Opus HTTP routing 1.00 → 0.61). Round 4 fixed that. Lesson: confirm every round
with a full run or a sample of previously passing tasks.

## Ablations (full dev runs)

**A** = rule sentences only. **C** = sentences + REST map, SQL listed first. **D** = final text
minus the REST map. Claude Code:

| Condition | Ablation A · coding agents, round-1 text only | Ablation C · Claude Code, round-1 text + REST map | Ablation D · Claude Code, final text minus the REST map |
|---|---|---|---|
| Claude Code + MCP · Fable 5.1 | 0.63 / 0.53 / 1.00 / 0.95 ([6446](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQ2)) | 0.65 / 0.55 / 0.98 / 0.94 ([6468](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDY4)) | 0.73 / 0.60 / 1.00 / 0.95 ([6475](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDc1)) |
| Claude Code + MCP · Opus 5 | 0.61 / 0.52 / 0.98 / 0.94 ([6447](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQ3)) | 0.65 / 0.55 / 0.98 / 0.91 ([6469](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDY5)) | 0.69 / 0.57 / 0.98 / 0.92 ([6476](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDc2)) |

Codex with the rule sentences only (A):

| Condition | Ablation A · coding agents, round-1 text only |
|---|---|
| Codex + MCP · GPT-6 Astra | 0.80 / 0.68 / 1.00 / 0.92 ([6448](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQ4)) |
| Codex + MCP · GPT-5.6 | 0.84 / 0.73 / 0.98 / 0.87 ([6449](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDQ5)) |

**B** = PXI with the server block stripped but main's original one-line SQL hint:

| Condition | Ablation B · PXI, strip only |
|---|---|
| PXI · Fable 5.1 | 0.91 / 0.89 / 0.90 / 0.94 ([6450](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDUw)) |
| PXI · Opus 5 | 0.83 / 0.74 / 0.92 / 0.92 ([6451](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDUx)) |
| PXI · GPT-6 Astra | 0.93 / 0.85 / 1.00 / 0.92 ([6452](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDUy)) |
| PXI · GPT-5.6 | 0.79 / 0.69 / 0.92 / 0.90 ([6453](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMg==/experiments/RXhwZXJpbWVudDo2NDUz)) |

Verdict per item:

- Rule sentences: necessary. They alone take SQL recall to ~1.0 for every agent, at a cost of
  ~15 points of Claude Code precision.
- REST-first ordering and entity-first sentence: necessary for Claude Code; recovers 8–10 of
  those points (A → D).
- REST tool map: does nothing alone (A → C) but adds 4–5 points on top of the ordering
  (D → final), consistently for both Claude models. Irrelevant for Codex. Weakest item; dropped
  from the PR, so for Claude Code the shipped text is D (0.73 and 0.69 accuracy on dev).
- PXI strip: necessary (undoes the lookup collapse). PXI rewritten rule: necessary; the strip
  alone leaves PXI 4–13 points below final (B).

## Structural findings

- Every one of the 72 HTTP oracles answers through GraphQL, which the MCP server does not expose.
  57 of them have been answered through REST alone by at least one MCP coding run; 15 never have
  (evaluators, experiment jobs, model prices, prompt creation order, a settings flag). For
  Claude Code and Codex those 15 measure a missing surface, not a routing choice, and cap SQL
  precision near 0.79. PXI has GraphQL and is unaffected. Options: relabel them "either",
  exclude them for MCP agents, or expose GraphQL through MCP.
- Opus tries REST first after round 3 but falls back to SQL when the REST route needs a
  project id the question does not give (spans are project-scoped in REST).
- The Harbor plugin rewrites the Phoenix dataset from each job's task list, so concurrent subset
  jobs race and die at start ("Missing Phoenix examples"). Subset jobs must start staggered.
- The gpt-5-nano judge produced false negatives; the default is now gpt-5.5. Codex's JavaScript
  tool-calling mode was invisible to the API classifier until `SCRIPT_TOOLS` was added.

## Metrics to report

SQL recall (primary), SQL precision (guardrail), reward split by expected route (what routing is
for). Plain accuracy mixes both error types and is skewed by the 72/52 class balance.

## Test set: before and after (held out, 101 tasks, each run once in full)

Baseline is the pre-tuning commit `6db24053c3` (same judge and classifier fixes, no routing text);
final is `a590b28ec0`. Dataset: https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments.
Cells read accuracy / SQL precision / SQL recall / reward.

| Condition | Test · baseline (pre-tuning) | Test · final |
|---|---|---|
| Claude Code + MCP · Fable 5.1 | 0.77 / 0.67 / 0.85 / 0.95 ([6480](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDgw)) | 0.75 / 0.62 / 0.95 / 0.97 ([6497](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDk3)) |
| Claude Code + MCP · Opus 5 | 0.73 / 0.60 / 0.97 / 0.92 ([6481](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDgx)) | 0.66 / 0.54 / 0.97 / 0.97 ([6498](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDk4)) |
| Codex + MCP · GPT-6 Astra | 0.67 / 0.56 / 0.85 / 0.96 ([6482](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDgy)) | 0.77 / 0.65 / 0.93 / 0.96 ([6499](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDk5)) |
| Codex + MCP · GPT-5.6 | 0.78 / 0.68 / 0.85 / 0.93 ([6483](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDgz)) | 0.82 / 0.69 / 1.00 / 0.93 ([6500](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NTAw)) |
| PXI · Fable 5.1 | 0.90 / 1.00 / 0.75 / 0.94 ([6484](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDg0)) | 0.87 / 0.83 / 0.85 / 0.93 ([6501](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NTAx)) |
| PXI · Opus 5 | 0.87 / 0.94 / 0.72 / 0.94 ([6485](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDg1)) | 0.87 / 0.80 / 0.90 / 0.92 ([6502](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NTAy)) |
| PXI · GPT-6 Astra | 0.85 / 0.73 / 1.00 / 0.96 ([6486](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDg2)) | 0.94 / 0.89 / 0.97 / 0.95 ([6503](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NTAz)) |
| PXI · GPT-5.6 | 0.79 / 0.68 / 0.90 / 0.94 ([6487](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NDg3)) | 0.94 / 0.90 / 0.95 / 0.90 ([6504](https://phoenix-devs.up.railway.app/datasets/RGF0YXNldDoyMw==/experiments/RXhwZXJpbWVudDo2NTA0)) |

The final column was run with the REST tool map. The shipped text drops it (ablation D), which
on dev cost Claude Code 4–5 points of accuracy; the test split has not been re-run without it.

On the test split 48 HTTP tasks were answered through REST alone by some MCP coding run and
13 never were (dataset-evaluators, default-retention-policy, evaluator-builtins, evaluator-datasets, evaluator-language-sandbox, evaluator-llm-prompt, experiment-failed-examples, model-pattern, model-price-types, project-retention-policy, prompt-labels, sandbox-providers, span-in-dataset).

## Open decisions

1. Whether the Claude Code precision trade on the test set is acceptable, or whether the routing text should be softened for Claude Code.
2. The 15 GraphQL-only HTTP tasks.
3. Whether to spend one more PXI-only round on Opus precision.
