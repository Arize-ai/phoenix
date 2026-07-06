# Context Pruning Live Results

Date: 2026-07-05

Local Phoenix:
- Endpoint: `http://localhost:6007`
- Working dir: `/private/tmp/context-pruning-phoenix-main`
- Database: `/private/tmp/context-pruning-phoenix-main/phoenix.db`
- Model: `ANTHROPIC/claude-opus-4-6`

## Cost-Capped Main Checkpoint

The original preregistered matrix was stopped before completion to keep live Anthropic spend
under $300. The completed checkpoint is still interpretable:

- Completed cells: 20
- Completed task runs: 3,632
- Measured Anthropic cost: $231.07
- Main Type A summaries: `main-grid/SUMMARY.md`, `main-grid/USAGE.md`
- Budgeted Type B confirmation: `main-grid/BUDGET_SUMMARY.md`, `main-grid/BUDGET_USAGE.md`

Completed Type A quality cells:

| Dataset | Policy | Pass rate | Cost |
|---|---|---:|---:|
| `context_pruning_type_a_5k` | p0 | 185/200 (92.5%) | $4.82 |
| `context_pruning_type_a_5k` | p1 | 183/200 (91.5%) | $4.75 |
| `context_pruning_type_a_5k` | p2 | 182/200 (91.0%) | $4.87 |
| `context_pruning_type_a_25k` | p0 | 183/200 (91.5%) | $12.26 |
| `context_pruning_type_a_25k` | p1 | 182/200 (91.0%) | $12.33 |
| `context_pruning_type_a_25k` | p2 | 183/200 (91.5%) | $12.38 |
| `context_pruning_type_a_50k` | p0 | 190/200 (95.0%) | $20.59 |
| `context_pruning_type_a_50k` | p1 | 185/200 (92.5%) | $6.39 |
| `context_pruning_type_a_50k` | p1c | 184/200 (92.0%) | $6.56 |
| `context_pruning_type_a_50k` | p2 | 195/200 (97.5%) | $47.58 |
| `context_pruning_type_a_50k` | p3 | 195/200 (97.5%) | $2.81 |
| `context_pruning_type_a_50k` | p4 | 192/200 (96.0%) | $2.89 |
| `context_pruning_type_a_50k` | p5 | 195/200 (97.5%) | $2.80 |
| `context_pruning_type_a_50k` | p6 | 184/200 (92.0%) | $21.17 |
| `context_pruning_type_a_100k` | p0 | 195/200 (97.5%) | $37.62 |
| `context_pruning_type_a_100k` | p1 | 185/200 (92.5%) | $8.12 |

Budgeted Type B 50K confirmation, three repetitions:

| Policy | Pass rate | Cost | Median latency |
|---|---:|---:|---:|
| p0 | 95/108 (88.0%) | $15.40 | 4,280 ms |
| p1 | 78/108 (72.2%) | $4.21 | 4,659 ms |
| p3 | 12/108 (11.1%) | $1.96 | 5,909 ms |
| p5 | 88/108 (81.5%) | $1.56 | 6,231 ms |

Interpretation:
- The full 50-cell preregistered matrix is not necessary for useful conclusions and would exceed
  the $300 budget. The cost-capped checkpoint should be treated as the live pilot plus a targeted
  Type B confirmation, not as the full preregistered result.
- Type A shows meaningful policy tradeoffs: P3/P5/P4 at 50K preserved high quality at roughly
  $2.8 per 200-run cell, while P2 also preserved quality but cost $47.6 because same-provider
  summarization reduced cache leverage and added output tokens.
- Type B shows a different regime: P1 degrades quality moderately, P3 fails because the retained
  noop summary/trailing context drops required historical needles, and corrected P5 recovers much
  of the baseline at low token cost. This is useful evidence that history-independent and
  history-dependent tasks must be analyzed separately.
- P5 was corrected during the run to retain synthetic `Project note:` oracle excerpts when no
  explicit `terms=` parameter is provided; the budgeted Type B P5 row above is the corrected
  rerun (`context-pruning-budget-context_pruning_type_b_50k-p5-fixed`).

## Cache Smoke

Command:

```bash
PHOENIX_COLLECTOR_ENDPOINT=http://127.0.0.1:6007 \
PHOENIX_GRPC_PORT=6017 \
PHOENIX_ALLOW_EXTERNAL_RESOURCES=true \
PHOENIX_AGENTS_ASSISTANT_PROVIDER=ANTHROPIC \
PHOENIX_AGENTS_ASSISTANT_MODEL=claude-opus-4-6 \
uv run python -m evals.pxi.harness.run_experiment \
  --dataset context_pruning_cache_smoke \
  --splits dev \
  --concurrency 1 \
  --repetitions 1 \
  --experiment-name context-pruning-cache-smoke-live \
  --report-dir /private/tmp/context-pruning-live-reports
```

Experiment: `context-pruning-cache-smoke-live`

| Example | input_tokens | output_tokens | cache_read_tokens | cache_write_tokens | latency_ms |
|---|---:|---:|---:|---:|---:|
| cache-smoke-1 | 19731 | 85 | 0 | 19728 | 5223 |
| cache-smoke-2 | 19731 | 85 | 19728 | 0 | 2909 |

Evaluator pass rates:

| Evaluator | Passed | Total |
|---|---:|---:|
| correct_tools_called | 2 | 2 |
| tool_call_args_match | 2 | 2 |
| tool_call_count_within_limit | 2 | 2 |

Acceptance result: nonzero `cache_read_tokens` was observed on the repeated examples.

## Admission Gates

Command pattern:

```bash
PHOENIX_COLLECTOR_ENDPOINT=http://127.0.0.1:6007 \
PHOENIX_GRPC_PORT=6017 \
PHOENIX_ALLOW_EXTERNAL_RESOURCES=true \
PHOENIX_AGENTS_ASSISTANT_PROVIDER=ANTHROPIC \
PHOENIX_AGENTS_ASSISTANT_MODEL=claude-opus-4-6 \
uv run python -m evals.pxi.experiments.context_pruning.run_matrix \
  --dataset <gate-dataset> \
  --policies p0 \
  --repetitions 1 \
  --concurrency 1 \
  --name-prefix context-pruning-gate-v3 \
  --base-url http://127.0.0.1:6007 \
  --provider ANTHROPIC \
  --model claude-opus-4-6 \
  --report-dir /private/tmp/context-pruning-live-gate-reports
```

Consolidated report: `evals/pxi/experiments/context-pruning/gates/REPORT.md`.

| Gate | Dataset | Pass rate | Criterion | Result |
|---|---|---:|---:|---|
| Type A zero-history | `context_pruning_gate_type_a_zero` | 38/40 (95%) | >=80% | pass |
| Type B zero-history | `context_pruning_gate_type_b_zero` | 0/36 (0%) | <=20% | pass |
| Type B 5K positive control | `context_pruning_gate_type_b_5k` | 35/36 (97%) | >=80% | pass |

## Seeded Pilot

Commands:

```bash
PHOENIX_COLLECTOR_ENDPOINT=http://127.0.0.1:6007 \
PHOENIX_GRPC_PORT=6017 \
PHOENIX_ALLOW_EXTERNAL_RESOURCES=true \
PHOENIX_AGENTS_ASSISTANT_PROVIDER=ANTHROPIC \
PHOENIX_AGENTS_ASSISTANT_MODEL=claude-opus-4-6 \
uv run python -m evals.pxi.experiments.context_pruning.run_matrix \
  --dataset context_pruning_pilot \
  --policies p0,p1,p2 \
  --repetitions 1 \
  --concurrency 1 \
  --name-prefix context-pruning-pilot-current \
  --base-url http://127.0.0.1:6007 \
  --provider ANTHROPIC \
  --model claude-opus-4-6 \
  --report-dir /private/tmp/context-pruning-current-pilot-reports
```

Usage and latency:

| Experiment | Runs | input_tokens | output_tokens | cache_read_tokens | cache_write_tokens | median_latency_ms | illustrative_cost_usd |
|---|---:|---:|---:|---:|---:|---:|---:|
| context-pruning-pilot-current...p0 | 14 | 980358 | 1291 | 161434 | 818882 | 4591 | 5.231215 |
| context-pruning-pilot-current...p1 | 14 | 400432 | 1402 | 287841 | 112549 | 3638 | 0.882612 |
| context-pruning-pilot-current...p2 | 14 | 902051 | 2611 | 287841 | 15912 | 3491 | 3.300136 |

Evaluator pass rates:

| Experiment | Evaluator | Passed | Total |
|---|---|---:|---:|
| P0 full history | correct_tools_called | 14 | 14 |
| P0 full history | tool_call_args_match | 14 | 14 |
| P0 full history | tool_call_count_within_limit | 14 | 14 |
| P1 threshold tool-result clearing | correct_tools_called | 11 | 14 |
| P1 threshold tool-result clearing | tool_call_args_match | 11 | 14 |
| P1 threshold tool-result clearing | tool_call_count_within_limit | 14 | 14 |
| P2 threshold summarization | correct_tools_called | 14 | 14 |
| P2 threshold summarization | tool_call_args_match | 14 | 14 |
| P2 threshold summarization | tool_call_count_within_limit | 14 | 14 |

Interpretation:
- P1 reduced illustrative cost by 83.1% vs. P0 on this one-repetition pilot, but failed the
  three high-depth Type-B tool-result examples included in the pilot.
- P2 preserved 14/14 deterministic quality while reducing illustrative cost by 36.9% vs. P0;
  its summarizer call usage is included in the `policy_usage` totals.
- This is a smoke/pilot artifact, not the final preregistered 5-run, two-model grid.

## Continuation Policy Smoke

Additional local Phoenix:
- Endpoint: `http://localhost:6007`
- Working dir: `/private/tmp/phoenix-context-pruning-cont`
- Database: `/private/tmp/phoenix-context-pruning-cont/phoenix.db`

Command:

```bash
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6007 \
PHOENIX_AGENTS_ASSISTANT_PROVIDER=ANTHROPIC \
PHOENIX_AGENTS_ASSISTANT_MODEL=claude-opus-4-6 \
uv run python -m evals.pxi.experiments.context_pruning.run_matrix \
  --dataset context_pruning_pilot \
  --policies "p2:threshold=0,trailing_tokens=2000,max_summary_tokens=500;p3:threshold=0,trailing_tokens=2000;p4:threshold=0,trailing_tokens=2000" \
  --repetitions 1 \
  --concurrency 1 \
  --name-prefix context-pruning-cont-final \
  --base-url http://localhost:6007 \
  --provider ANTHROPIC \
  --model claude-opus-4-6 \
  --report-dir /private/tmp/context-pruning-cont-final-results
```

Usage and latency:

| Experiment | Runs | input_tokens | output_tokens | cache_read_tokens | cache_write_tokens | avg_latency_ms | task_errors | illustrative_cost_usd |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| context-pruning-cont-final...p2-threshold-0-trailing_tokens-2000-max_summary_tokens-500 | 14 | 240436 | 1841 | 211710 | 28678 | 7111.5 | 0 | 0.331358 |
| context-pruning-cont-final...p3-threshold-0-trailing_tokens-2000 | 14 | 203054 | 1823 | 188417 | 14595 | 4151.0 | 0 | 0.231212 |
| context-pruning-cont-final...p4-threshold-0-trailing_tokens-2000 | 14 | 202776 | 1959 | 188277 | 14457 | 4625.6 | 0 | 0.233680 |

Evaluator pass rates:

| Experiment | Evaluator | Passed | Total |
|---|---|---:|---:|
| P2 low-threshold extractive summary | correct_tools_called | 11 | 14 |
| P2 low-threshold extractive summary | tool_call_args_match | 8 | 14 |
| P2 low-threshold extractive summary | tool_call_count_within_limit | 14 | 14 |
| P3 low-threshold noop summary | correct_tools_called | 10 | 14 |
| P3 low-threshold noop summary | tool_call_args_match | 8 | 14 |
| P3 low-threshold noop summary | tool_call_count_within_limit | 14 | 14 |
| P4 low-threshold naive truncation | correct_tools_called | 8 | 14 |
| P4 low-threshold naive truncation | tool_call_args_match | 8 | 14 |
| P4 low-threshold naive truncation | tool_call_count_within_limit | 14 | 14 |

Implementation note: P2 now calls the same-provider LLM summarizer in the request path and
records summarizer `policy_usage` separately from the final agent turn usage.
