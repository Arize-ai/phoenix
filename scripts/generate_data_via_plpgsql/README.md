# PostgreSQL Data Generation

These scripts generate high-volume trace and annotation data directly in a Phoenix PostgreSQL
database. They are intended for storage and query performance testing; use the OpenTelemetry
scenarios in `../generate_spans/` for UI fixtures and normal ingestion testing.

They require `psql` and accept the same `--db-host`, `--db-port`, `--db-name`, `--db-user`, and
`--db-password` options. The password defaults to `PGPASSWORD`, then `phoenix`.

## Usage

```bash
# Validate without connecting
uv run python scripts/generate_data_via_plpgsql/generate_spans.py --dry-run

# Generate 1,000 traces in ten bounded transactions
uv run python scripts/generate_data_via_plpgsql/generate_spans.py \
  --num-batches 10 \
  --traces-per-batch 100

# Add 0–1 evaluation scores to a sample of spans
uv run python scripts/generate_data_via_plpgsql/generate_span_annotations.py \
  --limit 10000 \
  --max-annotations-per-span 10

# Report project, trace, and span table sizes
uv run python scripts/generate_data_via_plpgsql/report_spans_table_sizes.py
```

Run any script with `--help` for all parameters. Span generation creates 400 hierarchically
related spans per trace, including a deliberate mix of inline and TOAST-sized attributes.

## Gotchas

**These writes bypass Phoenix's ingestion pipeline entirely.** The SQL inserts into
`projects`, `traces`, and `spans` directly, so anything Phoenix derives *during* ingestion
never happens for this data:

- **No cost rows.** `span_costs` is filled by the `SpanCostCalculator` daemon, which is fed
  from a queue by the ingestion path and never scans for spans it missed. Cost views stay
  empty for these projects, permanently — restarting Phoenix does not backfill them.
- **No sessions.** `project_sessions` is written in `db/insertion/span.py`. These spans carry
  no `session.id` attribute in any case, so session views stay empty too.

The asymmetry is easy to misread, because **token counts do work**: the SQL populates
`llm_token_count_*` and `cumulative_llm_token_count_*` itself. Seeing correct token rollups
next to empty cost panels is expected, not a bug. Use `../generate_spans/` when you need data
that behaves like real ingested traffic.

**400 spans per trace is fixed in the SQL, not a flag.** The shape is 8 + 56 + 336 across
three layers. Control volume with `--num-batches` and `--traces-per-batch`; a "small" run is
still 400 spans per trace.

**Attributes are deliberately TOAST-sized.** Each span carries roughly 4KB of random data
across two fields, because exercising out-of-line storage is the point. Row counts and
on-disk sizes therefore do not scale the way normal traffic does — do not read these numbers
as a capacity estimate for real workloads.

**`psql` must be on PATH, and failures abort the batch.** `_psql.py` runs with
`ON_ERROR_STOP=1`, so an error stops the script rather than leaving a partially applied
transaction.

**`report_spans_table_sizes.py` has no `--dry-run`.** Its two siblings do. It only reads, so
there is little to validate offline, but the interface is not uniform.

## Sample Queries to Run after Data is Generated

### Select Random Conversation ID
```sql
SELECT (attributes->'metadata'->>'conversation_id')::uuid AS conversation_id
FROM spans TABLESAMPLE SYSTEM (1)
WHERE attributes->'metadata'->>'conversation_id' IS NOT NULL
LIMIT 1;
```

### Select Spans by Conversation ID
```sql
SELECT *
FROM spans
WHERE attributes->'metadata'->>'conversation_id' = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY start_time;
```

### Show Spans Table Size Stats
```sql
SELECT 
    pg_size_pretty(pg_total_relation_size('spans')) AS total_size,
    pg_size_pretty(pg_relation_size('spans')) AS table_size,
    pg_size_pretty(pg_total_relation_size('spans') - pg_relation_size('spans')) AS index_size,
    (SELECT count(*) FROM spans) AS row_count,
    (SELECT last_value FROM spans_id_seq) AS current_sequence;
```

## Files

- `_psql.py` — shared database configuration and fail-fast `psql` execution.
- `generate_spans.py` / `.sql` — batched hierarchical trace generation.
- `generate_span_annotations.py` / `.sql` — configurable span annotation generation.
- `report_spans_table_sizes.py` / `.sql` — table size and row count reporting.
