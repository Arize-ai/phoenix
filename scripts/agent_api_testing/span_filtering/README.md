# Span Filtering Trial

Measures whether independent LLM agents can construct correct
`GET /v1/projects/{id}/spans?attribute=...` URLs from just the OpenAPI
schema for realistic OpenInference-shaped queries.

## Prerequisites

- A local Phoenix reachable at `http://localhost:6006` (or pass `--base-url`).
- `claude` and/or `codex` CLIs on `$PATH`, authenticated.

## Run

```sh
# 1. Seed fixtures (idempotent — deletes and recreates the trial project).
uv run scripts/agent_api_testing/span_filtering/seed.py

# 2. Run the full trial matrix (4 agents × 7 prompts by default).
uv run scripts/agent_api_testing/span_filtering/run_trial.py

# Or scope it:
uv run scripts/agent_api_testing/span_filtering/run_trial.py \
  --agents claude:claude-sonnet-4-6,codex \
  --prompts P1,P2,P5
```

Each invocation runs in a fresh temp cwd with no persisted session.

## Outputs

Raw JSONL transcripts land at `trial-runs/<agent>/<prompt>.jsonl` (next
to `run_trial.py`; override with `--out-dir`). Review transcripts by
eye or with your own tooling — this harness does no extraction or
scoring.

## Files

- `seed.py` — populates the project with 6 OpenInference-shaped spans.
- `prompts.md` — P1–P7 (plus optional P8) with classification rubric.
  The prompt text is what the agent sees; rubrics are for manual
  scoring only — **never paste into the agent**.
- `run_trial.py` — the harness; spawns agents, streams stdout to
  JSONL files.

## Notes

Trials are non-deterministic and cost real API dollars. Not wired into CI.
Rerun `seed.py` between trials to reset state.
