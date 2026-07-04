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
