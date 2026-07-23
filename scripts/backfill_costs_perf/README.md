# Cost-backfill performance harness

A self-contained harness for exercising the historical cost-backfill endpoint

```
POST /v1/projects/{project_identifier}/spans/backfill_costs
```

under realistic conditions, and measuring whether it disturbs live ingestion.

It stands up a full Phoenix stack **built from the local source tree** (so the
endpoint under test is included), against either **SQLite** or **Postgres**,
and runs this scenario:

1. **Seed** a batch of mock historical LLM spans via OTLP ingestion
   (`/v1/traces`). These are normal LLM spans with model names and token
   counts, so Phoenix computes their costs at ingestion time.
2. **Delete** the resulting `span_cost` rows, simulating traces that were
   ingested *before* cost tracking existed — exactly the spans the backfill
   endpoint is meant to fill in.
3. **Fire new spans** at the ingestion endpoint continuously (a configurable
   spans/second load) into a separate live project.
4. **Run the backfill** over the historical project (paginated, one batch per
   request) *while the ingestion load is running*.
5. **Report** backfill throughput / per-batch latency, and ingestion request
   latency and error (503) rate during a quiet baseline window versus during
   the backfill.

Everything goes through the real HTTP surface — OTLP protobuf for ingestion,
JSON for the backfill loop — so the numbers reflect end-to-end server behavior.

## Files

| File | Purpose |
| --- | --- |
| `run_perf_test.py` | Orchestrator: brings the stack up, runs the scenario, prints results, tears down. |
| `docker-compose.sqlite.yml` | Phoenix on SQLite (single-writer) + a `dbtools` helper. |
| `docker-compose.postgres.yml` | Phoenix on Postgres 16. |

## Requirements

- Docker with the `docker compose` v2 plugin, and a running Docker daemon.
- The Phoenix dev Python environment (provides `httpx` and `opentelemetry-proto`).
  Run via `uv run` from the repo root.

## Usage

```bash
# SQLite backend, default settings (20k historical spans, ~200 spans/s load,
# 100 spans per backfill request)
uv run scripts/backfill_costs_perf/run_perf_test.py --backend sqlite

# Postgres backend, heavier load
uv run scripts/backfill_costs_perf/run_perf_test.py \
    --backend postgres --seed-spans 40000 --load-rate 300 --backfill-batch-size 1000
```

The first run builds the Phoenix image, which can take several minutes. Pass
`--no-build` on subsequent runs to reuse the image, and `--keep-up` to leave
the stack running for inspection (tear it down later with
`docker compose -p backfillperf -f <compose-file> down -v --remove-orphans`).

Each run removes any previous `backfillperf` stack and its backend volume before
starting. This keeps span and cost counts isolated to the current benchmark;
do not store data you need to retain in this throwaway stack.

Key options (see `--help` for all):

- `--seed-spans` — number of historical spans to seed and backfill.
- `--load-rate` / `--load-batch` — live ingestion spans/second and spans/request.
- Set `--load-rate 0` to run without concurrent ingestion.
- `--backfill-batch-size` — the `limit` query param for each backfill request.
- `--baseline-seconds` — how long to measure ingestion before backfill starts.

## Example output

```
================= RESULTS =================
Backend:              sqlite
Historical spans:     20000 seeded, 20000 re-costed by backfill

Backfill:
  batches:            20 (limit=1000)
  wall time:          18.4s
  throughput:         1087 spans/s
  batch latency:      p50=780ms p95=1120ms max=1330ms

Live ingestion (200 spans/s target, 50 spans/request):
  baseline               reqs=58    p50=  9.4ms p95=   21.0ms reqs/s=  3.9 503s=0 errors=0
  during backfill        reqs=71    p50= 12.1ms p95=   38.5ms reqs/s=  3.9 503s=0 errors=0

Ingestion impact:     p95 request latency 21.0ms -> 38.5ms (+83%), 0 rejected (503) during backfill
===========================================
```

Use it to compare backends (SQLite's single writer contends more than
Postgres), to tune `--backfill-batch-size` against ingestion impact, and to
measure the endpoint's impact — transaction time, latency changes, and
ingestion rejections — under concurrent load. Backfills can noticeably raise
ingestion latency, especially with SQLite or large batches.

## Notes

- The Phoenix image is **distroless** (no shell), so the harness cannot exec
  into it to edit the database. For SQLite, a small `dbtools` sidecar shares
  the database volume and performs the `span_cost` deletion / row counts; for
  Postgres, the harness uses `psql` in the `db` container. Deletion happens
  before the ingestion load starts, so there is no write contention with it.
- The historical project (`HISTORICAL_BACKFILL`) and live project
  (`LIVE_INGESTION`) are separate, so the backfill only ever touches the
  historical spans and the live load's costs are never disturbed.
- Both stacks cap the ingestion queue at 5,000 spans so backpressure remains
  observable during a sustained load test.
- This stack is for benchmarking only — it runs containers as root and uses
  throwaway credentials. Do not use it as a deployment reference.
