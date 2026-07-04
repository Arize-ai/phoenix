# Context Pruning Main Grid Plan

Date: 2026-07-04

The preregistered Type A/B quality grid is runnable through the matrix runner's
depth-sliced dataset mode:

```bash
PHOENIX_COLLECTOR_ENDPOINT=http://127.0.0.1:6007 \
PHOENIX_GRPC_PORT=6017 \
PHOENIX_ALLOW_EXTERNAL_RESOURCES=true \
PHOENIX_AGENTS_ASSISTANT_PROVIDER=ANTHROPIC \
PHOENIX_AGENTS_ASSISTANT_MODEL=claude-opus-4-6 \
uv run python -m evals.pxi.experiments.context_pruning.run_matrix \
  --preregistered-quality-grid \
  --repetitions 5 \
  --concurrency 1 \
  --name-prefix context-pruning-main \
  --base-url http://127.0.0.1:6007 \
  --provider ANTHROPIC \
  --model claude-opus-4-6 \
  --report-dir /private/tmp/context-pruning-main-reports
```

Dry-run verification:

```bash
uv run python -m evals.pxi.experiments.context_pruning.run_matrix \
  --preregistered-quality-grid \
  --dry-run \
  --report-dir /tmp/context-pruning-main-reports | wc -l
```

Expected cells: `50`.

Cell structure:

| Task set | Depths | Policies | Cells |
|---|---:|---|---:|
| Type A | 5K, 25K, 50K, 100K, 150K | P0, P1, P2 | 15 |
| Type A secondary | 50K, 150K | P1c, P3, P4, P5, P6 | 10 |
| Type B | 5K, 25K, 50K, 100K, 150K | P0, P1, P2 | 15 |
| Type B secondary | 50K, 150K | P1c, P3, P4, P5, P6 | 10 |

Total command count: `50`.
