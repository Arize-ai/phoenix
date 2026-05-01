# alyx-data

Stage 1 of the alyx-data project: a reproducible, idempotent pipeline that
pulls 90 days of production traces from Arize's `copilot-prod` project (Alyx,
the observability assistant) and emits **three layered artifacts** on disk.

**Scope:** experimental, local-only. No human annotation, no scoring, no
uploading. The raw layer is canonical and immutable; every later layer is a
derivation that can be regenerated without re-hitting the Arize API.

## Pipeline

```
Layer 0 -- Export      data/raw/<window>/chunk_*.parquet
Layer 1 -- Extract     data/clean/user-queries-extracted.parquet
        \  +Flag       data/clean/user-queries.parquet         <- canonical
Layer 2 -- Trajectories data/trajectories/spans.parquet
                        data/trajectories/sessions.parquet
```

Each step writes its artifact to disk; reruns from any point are cheap.

## Setup

```bash
cd ~/Projects/phoenix-clones/alyx-data/alyx-data
uv sync
```

Credentials are loaded from `~/Projects/phoenix/.env` (which contains
`export ARIZE_API_KEY=...`). A local `.env` here will override if present.

## Running

```bash
# One-shot: run all steps (skips any with existing outputs)
uv run python run_pipeline.py

# Quick 2-day sanity run -- verifies the full pipeline shape
uv run python run_pipeline.py --probe

# Resume from a specific step (forces it + everything downstream)
uv run python run_pipeline.py --from-step flag
uv run python run_pipeline.py --from-step trajectories

# Force re-run all steps
uv run python run_pipeline.py --force

# Custom window
uv run python run_pipeline.py --window-days 30
```

Expected runtime for the 90-day window: **~15 min** (predecessor benchmark).
Expected output sizes:

| Layer        | Path                                           | Rows  | Size    |
|--------------|------------------------------------------------|-------|---------|
| 0 raw spans  | `data/raw/copilot-prod-spans-*/chunk_*.parquet`| ~388k | ~1.4 GB |
| 1 queries    | `data/clean/user-queries.parquet`              | ~24k  | ~10 MB  |
| 2 spans      | `data/trajectories/spans.parquet`              | ~388k | ~600 MB |
| 2 sessions   | `data/trajectories/sessions.parquet`           | ~3.8k | ~5 MB   |

## Artifacts

All under `data/` (gitignored):

- `data/raw/copilot-prod-spans-<start>_to_<end>/`
  - `chunk_*.parquet` -- raw OpenInference spans, per 2-week chunk
  - `_manifest.json`  -- chunk inventory (paths, time ranges, row counts)
- `data/clean/`
  - `user-queries-extracted.parquet` -- intermediate (one row per user query)
  - `user-queries.parquet`            -- **canonical Layer 1**, with flags
- `data/trajectories/`
  - `spans.parquet`    -- one row per span (joinable to sessions)
  - `sessions.parquet` -- one row per session, with ordered query/router lists

## Layer 1 flags vs. drops

Unlike the predecessor `pxi-eval-dataset` pipeline, Layer 1 here adds boolean
flag columns instead of dropping rows. The only HARD validity drop is
`is_empty`. See `docs/filter-rules.md` for the rule definitions.

| Flag                    | Meaning                                                             |
|-------------------------|---------------------------------------------------------------------|
| `is_internal`           | `user_email` in internal domain, OR org in internal allowlist       |
| `is_empty`              | normalized query length < `min_query_chars` (HARD DROP at L1)       |
| `is_trivial`            | normalized query is in the curated trivial set (`test`, `hi`, ...)  |
| `is_naked_identifier`   | query is a bare UUID, S3 URI, URL, hex hash, email, or long number  |
| `is_seed_button_match`  | first-turn query seen across >= N distinct users (canned-suggestion)|

Stages 2 and 3 of the alyx-data project decide what to do with each flag.

## Storage & privacy

Raw trace data is **local-only**, gitignored. Trajectories include LLM
outputs, tool outputs, and intermediate agent reasoning -- broader surface
than just user-query text. Defer any sharing/upload until a privacy review.

## Layout

```
alyx-data/
├── pyproject.toml
├── README.md
├── run_pipeline.py
├── docs/
│   ├── data-schema.md      # Layer 0/1/2 column docs + provenance
│   └── filter-rules.md     # validity drops + flag definitions
├── src/pipeline/
│   ├── __init__.py
│   ├── config.py           # paths, IDs, thresholds, env loading
│   ├── export.py           # Layer 0 -- chunked Arize span export
│   ├── extract.py          # Layer 1a -- root AGENT spans -> user-query rows
│   ├── flag.py             # Layer 1b -- annotate with scope flags
│   └── trajectories.py     # Layer 2  -- per-span + per-session reconstruction
└── data/                   # all gitignored; produced by the pipeline
```
