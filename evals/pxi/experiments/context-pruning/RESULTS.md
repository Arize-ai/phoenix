# Context Pruning Stage 1 Live Results

Date: 2026-07-04

Local Phoenix:
- Endpoint: `http://localhost:6007`
- Working dir: `/private/tmp/phoenix-context-pruning`
- Database: `/private/tmp/phoenix-context-pruning/phoenix.db`
- Model: `ANTHROPIC/claude-opus-4-6`

## Cache Smoke

Command:

```bash
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6007 \
PHOENIX_AGENTS_ASSISTANT_PROVIDER=ANTHROPIC \
PHOENIX_AGENTS_ASSISTANT_MODEL=claude-opus-4-6 \
uv run python -m evals.pxi.harness.run_experiment \
  --dataset context_pruning_cache_smoke \
  --splits dev \
  --concurrency 1 \
  --experiment-name context-pruning-cache-smoke-rerun
```

Experiment: `context-pruning-cache-smoke-rerun`

| Example | input_tokens | output_tokens | cache_read_tokens | cache_write_tokens | latency_ms |
|---|---:|---:|---:|---:|---:|
| cache-smoke-1 | 20605 | 85 | 20602 | 0 | 4724 |
| cache-smoke-2 | 20605 | 85 | 20602 | 0 | 3363 |

Evaluator pass rates:

| Evaluator | Passed | Total |
|---|---:|---:|
| correct_tools_called | 2 | 2 |
| tool_call_args_match | 2 | 2 |
| tool_call_count_within_limit | 2 | 2 |

Acceptance result: nonzero `cache_read_tokens` was observed on the repeated examples.

## Seeded Pilot

Commands:

```bash
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6007 \
PHOENIX_AGENTS_ASSISTANT_PROVIDER=ANTHROPIC \
PHOENIX_AGENTS_ASSISTANT_MODEL=claude-opus-4-6 \
uv run python -m evals.pxi.harness.run_experiment \
  --dataset context_pruning_pilot \
  --splits dev \
  --concurrency 1 \
  --experiment-name context-pruning-pilot-p0

PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6007 \
PHOENIX_AGENTS_ASSISTANT_PROVIDER=ANTHROPIC \
PHOENIX_AGENTS_ASSISTANT_MODEL=claude-opus-4-6 \
uv run python -m evals.pxi.harness.run_experiment \
  --dataset context_pruning_pilot \
  --splits dev \
  --concurrency 1 \
  --policy p1c \
  --experiment-name context-pruning-pilot-p1c
```

Usage and latency:

| Experiment | Runs | input_tokens | output_tokens | cache_read_tokens | cache_write_tokens | avg_latency_ms | illustrative_cost_usd |
|---|---:|---:|---:|---:|---:|---:|---:|
| context-pruning-pilot-p0 | 14 | 444152 | 1528 | 182036 | 262074 | 4698 | 1.767391 |
| context-pruning-pilot-p1c | 14 | 281121 | 1514 | 173852 | 107227 | 4299 | 0.795155 |

Evaluator pass rates:

| Experiment | Evaluator | Passed | Total |
|---|---|---:|---:|
| context-pruning-pilot-p0 | correct_tools_called | 10 | 14 |
| context-pruning-pilot-p0 | tool_call_args_match | 9 | 14 |
| context-pruning-pilot-p0 | tool_call_count_within_limit | 14 | 14 |
| context-pruning-pilot-p1c | correct_tools_called | 8 | 14 |
| context-pruning-pilot-p1c | tool_call_args_match | 8 | 14 |
| context-pruning-pilot-p1c | tool_call_count_within_limit | 14 | 14 |

Interpretation:
- P1c reduced total input tokens by 36.7% and cache-write tokens by 59.1% on this seeded pilot.
- P1c also reduced deterministic tool/arg pass rates on the seeded Type-B needle tasks, as expected for aggressive continuous clearing.
- This is a smoke/pilot artifact, not the final preregistered grid.

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

Implementation note: the current P2 implementation uses deterministic extractive compaction
inside the request path. It validates the harness and policy shape, but it is not the final
LLM summarizer arm described in the preregistration.
