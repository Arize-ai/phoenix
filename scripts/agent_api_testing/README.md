# API Agent Testing

Scripts that measure whether an independent LLM agent, given only Phoenix's
OpenAPI schema and a task prompt, can construct working HTTP requests for
realistic use cases. Each subdirectory targets one route or concern.

## Subdirectories

| Directory | What it tests |
|---|---|
| [`span_filtering/`](./span_filtering/) | The `attribute` query param on `GET /v1/projects/{id}/spans` — round-trips OpenInference `user.id`, `session.id`, `metadata.*`, `tag.tags`, and ISO timestamps through real agents. |

## Adding a new test

Each subdirectory should be self-contained:

- `seed.py` — idempotently populate a running local Phoenix with fixtures.
- `prompts.md` — the agent-facing prompts plus the ground-truth expected
  match set. Keep this file **uncontaminated** (no hints, no rubric in the
  prompt text itself; rubric lives under the prompt as separate prose).
- `run_trial.py` — invoke `claude -p` and/or `codex exec` per prompt in an
  isolated cwd with no session state, capture JSONL transcripts.
- `README.md` — a few lines: what's tested, how to run, where results land.

Trials are intentionally not wired into CI (non-deterministic, slow, and
they hit paid model APIs). They are run on demand and the outputs are
reviewed manually.
