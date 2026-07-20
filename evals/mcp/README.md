# MCP Surface Benchmark

Measures what it actually costs an agent to answer observability questions
through three different presentations of the same Phoenix API.

The claim under test is the one in `blogs/code-mode.md`: that code mode saves
context by cutting the catalog tax and the data-shuttle tax. This harness turns
that into numbers, on real traces, with correctness checked.

## The arms

| Arm | Surface | Isolates |
|---|---|---|
| `code_mode` | Phoenix `/mcp`, code mode on | Progressive disclosure **and** sandboxed execution |
| `tool_groups` | Phoenix `/mcp`, `PHOENIX_ENABLE_MCP_CODE_MODE=false` | Progressive disclosure alone |
| `phoenix_mcp` | `@arizeai/phoenix-mcp` over stdio | Conventional full-catalog tool calling |

The middle arm is the interesting one. Without it, any win could be attributed
to either idea; with it, the `code_mode` vs `tool_groups` gap is the sandbox's
contribution and the `tool_groups` vs `phoenix_mcp` gap is disclosure's.

Everything else is held constant: same model, same system prompt, same
questions, same usage limits, sequential execution.

## How it runs: one agent per pytest session

The benchmark is a pytest suite built on the phoenix-client pytest plugin
(`@pytest.mark.phoenix`). One session puts **one** agent under test — selected
with `MCP_BENCHMARK_ARM` — and the plugin records that session as a fresh
experiment on the shared `mcp-surface-benchmark` dataset. Putting two agents
under test means two sessions in succession:

```bash
MCP_BENCHMARK_ARM=phoenix_mcp uv run pytest evals/mcp -c evals/mcp/pytest.ini
MCP_BENCHMARK_ARM=code_mode   uv run pytest evals/mcp -c evals/mcp/pytest.ini
```

Each session leaves two records:

- **A Phoenix experiment** on the `mcp-surface-benchmark` dataset. The prose
  answer is the run output; judged correctness and every cost metric (turns,
  tool calls, catalog tokens, data-shuttle tokens, peak context, wall clock)
  are annotations — so successive arms compare metric-by-metric in the
  experiment-comparison UI with no further tooling.
- **A session artifact** at `evals/mcp/results/session-<arm>-<stamp>.json`,
  self-describing (arm, model, catalog probe, no-tools baseline, and the
  ground-truth bundle the judge used, plus every run row). The offline tools
  below work from these.

A test item **fails** when the arm's run errored or the judge marked the answer
wrong — the pytest pass/fail column is judged correctness, not harness health.
Everything is recorded before the assert, so a red session still produced a
complete artifact and experiment.

## Layout

- `conftest.py` / `pytest.ini` / `tests/` — the pytest harness. Session-scoped
  fixtures own the arm, ground truth, catalog probe, and no-tools baseline.
- `questions.py` — the question set, grouped by structural shape.
- `harness/` — the machinery: `arms.py` (the three surfaces), `runner.py`
  (per-run measurement), `ground_truth.py` (deterministic references over
  `/v1`), `judge.py` (LLM grading), `environment.py` (env resolution),
  `sessions.py` (artifact format).
- `report.py` / `analyze.py` / `rejudge.py` — offline tools over saved
  artifacts.
- `results/` — session artifacts, plus legacy pre-pytest `runs-*.jsonl` grids
  and `FINDINGS.md`.

## What gets measured

Per run:

- **turns** — model requests, i.e. round trips through the agent loop
- **tool calls** — successful MCP tool invocations
- **catalog tokens** — input tokens on the *first* request, net of a no-tools
  baseline. This is the tool definitions, before any work happens.
- **data-shuttle tokens** — input tokens across the rest of the run. Every
  subsequent request re-sends the transcript, so this is what intermediate
  results cost.
- **output tokens**, **peak context**, **wall clock**

Cache reads and writes are recorded but kept out of the headline numbers: a
cached catalog still occupies the context window, and window pressure is the
thing being measured.

**Correctness is graded, not assumed.** `harness/ground_truth.py` computes
reference answers straight from `/v1` over plain HTTP, independent of either
MCP surface. An LLM judge compares each arm's prose answer to those references
with the tolerances stated in each question's rubric. An arm that answers
cheaply and wrongly scores as wrong.

## Question shapes

The set spans the range deliberately, including cases where code mode should
*lose*:

| Shape | Example | Expectation |
|---|---|---|
| `trivial_lookup` | "How many projects?" | Code mode pays discovery round trips for a one-call question |
| `single_fetch` | "What span kinds are in `support-agent`?" | Roughly even |
| `aggregation` | "p50/p95/max LLM latency" | Code mode wins — reduction happens in the sandbox |
| `error_theming` | "Bucket the failures by theme" | Code mode wins |
| `cross_project_sweep` | "Compare four projects" | Code mode wins largest — N fetches, one summary |
| `needle_in_haystack` | "Find the single slowest span" | Code mode wins |
| `cross_resource_join` | "Datasets with experiments" | Code mode wins — a join across two endpoints |
| `grouped_aggregation` | "LLM latency by model" | Code mode wins |

A benchmark that only asked questions in the last six rows would not be worth
publishing.

## Setup

### 1. Phoenix with code mode (the default)

Any running Phoenix works; code mode is on by default.

```bash
uv run python -m phoenix.server.main serve
```

### 2. A second Phoenix with code mode off (only for the `tool_groups` arm)

The toggle is process-level, so the `tool_groups` arm needs its own instance
pointed at the same data:

```bash
PHOENIX_ENABLE_MCP_CODE_MODE=false PHOENIX_PORT=6007 \
  uv run python -m phoenix.server.main serve
```

Both processes read the same SQLite file. The benchmark is read-only, so this
is safe, but do not run a write-heavy workload against either at the same time.
Sessions for the other two arms never touch this instance.

### 3. An API key

All three arms authenticate as the same Phoenix user. Export it or put it in a
`.env` at the repo root:

```bash
export PHOENIX_API_KEY=<system or user key from Settings > API Keys>
```

### 4. Node

The `phoenix_mcp` arm runs the published server via `npx`, which downloads it
on first use.

## Running

```bash
# One arm, full question set
MCP_BENCHMARK_ARM=code_mode uv run pytest evals/mcp -c evals/mcp/pytest.ini

# Smoke test one question
MCP_BENCHMARK_ARM=code_mode uv run pytest evals/mcp -c evals/mcp/pytest.ini -k llm_latency_percentiles

# Three runs per question (plugin-native repetitions; all land in one experiment)
MCP_BENCHMARK_ARM=code_mode PHOENIX_TEST_REPETITIONS=3 uv run pytest evals/mcp -c evals/mcp/pytest.ini

# Agent traces to Phoenix via OpenInference, alongside the experiment records
MCP_BENCHMARK_ARM=code_mode MCP_BENCHMARK_TRACE=1 uv run pytest evals/mcp -c evals/mcp/pytest.ini
```

Configuration is env vars (a repo-root `.env` is read; real env wins):

| Variable | Default | Meaning |
|---|---|---|
| `MCP_BENCHMARK_ARM` | *(required)* | The agent under test this session |
| `MCP_BENCHMARK_MODEL` | `anthropic:claude-sonnet-5` | Model driving the arm |
| `MCP_BENCHMARK_JUDGE_MODEL` | the model above | Model grading answers |
| `PHOENIX_BASE_URL` | `http://localhost:6006` | Code-mode Phoenix; also ground truth |
| `PHOENIX_TOOL_GROUPS_URL` | `http://localhost:6007` | Code-mode-off Phoenix |
| `PHOENIX_API_KEY` | *(required)* | Auth for every arm |
| `PHOENIX_TEST_REPETITIONS` | `1` | Runs per question (phoenix plugin) |
| `MCP_BENCHMARK_TRACE` | off | OpenInference traces for agent runs |
| `PHOENIX_TEST_TRACKING` | on | Set `false` to skip experiment recording |

Experiment recording goes to the phoenix-client default endpoint
(`PHOENIX_COLLECTOR_ENDPOINT`, else `http://localhost:6006`) — usually the same
Phoenix the benchmark reads. That is deliberate dogfooding and safe: ground
truth is computed *after* the plugin bootstraps its dataset, so the benchmark's
own dataset is part of what both the reference and the agent see.

## Offline tools

```bash
# Cross-arm markdown report — the catalog/headline/per-shape tables
uv run python -m evals.mcp.report evals/mcp/results/session-*.json

# Per-question table, headline ratios, and literal tool-call sequences
uv run python -m evals.mcp.analyze evals/mcp/results/session-*.json

# Re-grade stored answers after fixing a ground-truth bug — no agent re-runs
uv run python -m evals.mcp.rejudge evals/mcp/results/session-<arm>-<stamp>.json
```

`rejudge` exists because a wrong reference should not cost a whole grid.
Re-running would also resample stochastic agent behaviour, making the corrected
numbers incomparable to the run being fixed. `analyze` and `rejudge` also read
the legacy pre-pytest `runs-*.jsonl` files in `results/`.

### Always cross-judge before believing a correctness split

The judge is blind to which arm produced an answer — it sees the question, the
rubric, the reference, and the answer text, and nothing else. That is necessary
but not sufficient, because the default judge is the same model driving the
agents.

Re-grade with a different model family before quoting any accuracy number:

```bash
uv run python -m evals.mcp.rejudge evals/mcp/results/session-<arm>-<stamp>.json \
    --model openai:gpt-5
```

On the first full run this mattered. Re-running the Claude judge reproduced all
16 verdicts exactly, so the split was not sampling noise — but GPT-5 still
disagreed on one answer, and it was right: a code-mode answer whose computed
table was correct stated the wrong total in its prose summary. The same-family
judge had scored that arm 8/8; the cross-family judge found 7/8. Treat a perfect
score from a same-family judge as unverified.

Cost scales as `arms x questions x repetitions`, each run being one agent run
plus one judge call. The full 3x8 grid is 24 agent runs across three sessions.

## Reading the results

The report leads with the catalog table, because that cost is paid on every
single question regardless of what is asked. Then the headline table pairs cost
against accuracy — read them together or not at all. Then a per-shape
breakdown, which is where the story lives: the shapes should separate cleanly,
and if `trivial_lookup` does not favour the conventional arm, something is
wrong with the harness rather than surprisingly good news.

## Fairness properties worth re-checking if you change anything

Two things have to hold or the comparison is meaningless, and neither is
self-evident — both arms reach Phoenix through different endpoints.

**Both arms see the same spans.** `spanSearch`'s OTLP endpoint and the npm
server's `get-spans` return the same 100 rows in the same most-recent-first
order — verified by matching on `(span name, start timestamp)`, 100 of 100. The
questions' "most recent 100 spans" phrasing is therefore accurate, and ground
truth reads that same window. If either endpoint's default ordering changes,
this silently stops being true and every span question turns into two arms
answering about different data.

**The target projects must be static across the succession of sessions.**
Ground truth is recomputed at the start of each session, so within a session
grading is self-consistent even on a moving instance. But the *comparison*
assumes every arm answered about the same data: if traces are still arriving,
arm B's session sees a different "most recent 100 spans" window than arm A's
did, and the cross-arm tables quietly compare different questions. Point the
benchmark at projects that are not being written to, or verify first:

```bash
# newest span should be identical across the two probes
curl -s -H "Authorization: Bearer $PHOENIX_API_KEY" \
  "$PHOENIX_BASE_URL/v1/projects/support-agent/spans/otlpv1?limit=1" | head -c 200
```

(The benchmark's own experiment recording does not violate this: it writes
annotations and dataset rows, not spans to the benchmark projects. The one
reference it moves is `datasets_with_experiments`, which is why ground truth is
recomputed per session after the plugin bootstraps.)

**The gap is not the wire format.** The npm server returns flattened spans;
`spanSearch` returns raw OTLP with typed attribute envelopes. For the same 100
spans the flattened form is 2.37x smaller (123,110 chars vs 292,293). The
conventional arm has the *better* format and still loses — so the result is
about how many times a payload crosses the context window, not how big it is.

## Caveats

- **One model.** Results are Claude Sonnet 5's tool-calling behaviour by
  default. `MCP_BENCHMARK_MODEL` changes it; conclusions may not transfer.
- **One dataset.** Numbers depend on the traces in your Phoenix. The absolute
  values are not portable; the ratios between arms are the point.
- **Variance is real, and it is asymmetric.** Measured across 16 repeated cells,
  `code_mode`'s total tokens vary by a median of 22% run to run (worst 122%);
  `phoenix_mcp` varies by 2% (worst 19%). Code mode's cost depends on whether its
  first script crashed and how many rewrites followed, so a single run can land
  a fifth away from its own mean. One repetition shows the shape of the result;
  it is not enough to publish a multiplier. Our own single-run pass reported
  ratios that three repeats moved substantially — see `results/FINDINGS.md`.
- **The npm arm is a different codebase**, not just a different presentation. It
  is hand-written with its own pagination and response shaping, so part of any
  gap is implementation rather than architecture. The `tool_groups` arm is the
  controlled comparison; `phoenix_mcp` is the real-world baseline.
