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
