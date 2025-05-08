# Data Generation Scripts

This directory contains scripts for generating synthetic trace data in PostgreSQL.

## Getting Started

Generate spans:
```bash
python generate_spans.py --num-batches 10 --traces-per-batch 100
```

Add annotations to spans:
```bash
python generate_span_annotations.py
```

Check table sizes for `spans`, `traces`, and `projects`:
```bash
python report_spans_table_sizes.py
```

## Sample Queries to Run after Data is Generated

### Select Random Conversation ID
```sql
SELECT (attributes->'metadata'->>'conversation_id')::uuid as conversation_id
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
    pg_size_pretty(pg_total_relation_size('spans')) as total_size,
    pg_size_pretty(pg_relation_size('spans')) as table_size,
    pg_size_pretty(pg_total_relation_size('spans') - pg_relation_size('spans')) as index_size,
    (SELECT count(*) FROM spans) as row_count,
    (SELECT last_value FROM spans_id_seq) as current_sequence;
```

## Files

- `generate_spans.sql` - Generates spans with realistic timing and metadata
- `generate_spans.py` - Python wrapper to run generate_spans.sql in batches
- `generate_span_annotations.sql` - Adds annotations to existing spans
- `generate_span_annotations.py` - Python wrapper for span annotations
- `report_spans_table_sizes.sql` - Reports table sizes and row counts
- `report_spans_table_sizes.py` - Python wrapper for table size reporting