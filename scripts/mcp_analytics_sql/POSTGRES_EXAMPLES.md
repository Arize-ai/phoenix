# PostgreSQL analytics SQL: product examples

These examples show what a person can learn from Phoenix data when an agent is
allowed to ask read-only SQL questions across telemetry, datasets, and
experiments.

> **PostgreSQL examples.** These queries were executed against a local
> PostgreSQL 17 server seeded with `seed_analytics_fixture.py`. PostgreSQL and
> SQLite use different syntax for percentiles, JSON, and time bucketing. Ask
> `describeSqlSchema` for the active dialect before reusing a query.

The `fixture-*` names and values below are deliberately planted examples. They
are useful for understanding query shape and interpretation, not evidence about
a real product.

## What this surface is for

Phoenix already provides product views for common questions such as “show me
recent traces.” Analytics SQL is for questions whose dimensions, joins, or
definitions cannot be known ahead of time:

- Is spend increasing because of longer conversations or a new model?
- Is a quality problem concentrated in one cohort of evaluation examples?
- Do slow runs cluster at a particular time?
- Is a dataset’s current version smaller because examples were deleted, or
  because the wrong revision history was counted?

The agent should discover the schema before writing SQL:

```python
return await call_tool(
    "describeSqlSchema",
    {
        "area": "telemetry",
        "detail": "detailed",
    },
)
```

That response tells the agent which tables exist, how to join them, which
virtual columns are available, and which database dialect is running.

## Example 1: “How much prompt traffic did this project use?”

### Product question

> Is `fixture-tokens` actually using 300 prompt tokens, or are we accidentally
> counting the trace rollup once for every span?

This is a billing and capacity question. A total that looks plausible but
double-counts parent and child spans leads directly to incorrect cost analysis.

### What the agent learned

`spans` has both per-span token fields and cumulative subtree fields. The schema
guidance says to sum the per-span field, not `cumulative_*`.

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        SELECT SUM(s.llm_token_count_prompt) AS total_prompt_tokens
        FROM spans s
        JOIN traces t ON s.trace_rowid = t.id
        JOIN projects p ON t.project_rowid = p.id
        WHERE p.name = 'fixture-tokens'
    """
    },
)
```

### Live result

```json
{
  "columns": ["total_prompt_tokens"],
  "rows": [[300]]
}
```

### Product interpretation

The project used **300 prompt tokens**. The fixture has three LLM spans at 100
tokens each, plus a parent CHAIN span whose cumulative total is also 300.
Summing both kinds of values would report 600 and make the project look twice
as expensive as it is.

## Example 2: “Are customers seeing a tail-latency incident?”

### Product question

> For `fixture-workload`, what does a typical request take, what does the slow
> tail take, and when does traffic peak?

Mean latency alone hides whether a small fraction of calls is painfully slow.
The p50/p95 pair distinguishes normal experience from tail experience; hourly
counts tell a PM whether the tail may be load-related.

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        SELECT
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.latency_ms) AS p50_latency_ms,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY s.latency_ms) AS p95_latency_ms,
          COUNT(*) AS span_count
        FROM spans s
        JOIN traces t ON s.trace_rowid = t.id
        JOIN projects p ON t.project_rowid = p.id
        WHERE p.name = 'fixture-workload'
    """
    },
)
```

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        SELECT
          DATE_TRUNC('hour', s.start_time) AS hour_start,
          COUNT(*) AS span_count
        FROM spans s
        JOIN traces t ON s.trace_rowid = t.id
        JOIN projects p ON t.project_rowid = p.id
        WHERE p.name = 'fixture-workload'
        GROUP BY DATE_TRUNC('hour', s.start_time)
        ORDER BY span_count DESC
        LIMIT 5
    """
    },
)
```

### Live result

| Measure | Result |
|---|---:|
| Total spans | 200 |
| Median (p50) latency | 80 ms |
| p95 latency | 900 ms |
| Busiest hour | 2026-07-31 15:00 UTC |
| Spans in that hour | 32 |

### Product interpretation

The normal experience is fast, while the slowest 5% are more than ten times
slower. The peak hour has 32 spans, versus 24 in the next busiest hours. That
does not establish a causal load problem, but it identifies a concrete cohort
for investigation: traces in the 15:00 UTC bucket, then their span tree and
retrieval/tool behavior.

`latency_ms` is a Phoenix virtual column. The server reports that it rewrote
the expression before execution, so the agent can see it used the published
abstraction rather than hand-written timestamp arithmetic.

## Example 3: “What is actually in the current evaluation dataset?”

### Product question

> How many examples are in `fixture-dataset` at its latest version?

This matters before comparing evaluation results. Counting every historical
revision can make an old, deleted example look like it is still part of the
current test set.

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        SELECT d.id AS dataset_id, dv.id AS version_id, dv.created_at
        FROM datasets d
        JOIN dataset_versions dv ON dv.dataset_id = d.id
        WHERE d.name = 'fixture-dataset'
        ORDER BY dv.created_at DESC, dv.id DESC
        LIMIT 5
    """
    },
)
```

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        WITH latest_version AS (
          SELECT dv.id
          FROM datasets d
          JOIN dataset_versions dv ON dv.dataset_id = d.id
          WHERE d.name = 'fixture-dataset'
          ORDER BY dv.created_at DESC, dv.id DESC
          LIMIT 1
        )
        SELECT COUNT(DISTINCT der.dataset_example_id) AS example_count
        FROM dataset_example_revisions der
        JOIN latest_version lv ON der.dataset_version_id = lv.id
    """
    },
)
```

### Live result

The newest dataset version was ID 5 and contained **2 examples**. The preceding
version contained 3.

### Product interpretation

The answer is not “count the rows in revision history.” It is “identify the
current version, then count distinct example IDs in that version.” The explicit
`id` tie-break is important in this fixture because both version rows share the
same creation timestamp. In a product surface, that ordering rule should be
documented if “latest” is a user-facing concept.

## What an MCP response tells the agent

Successful `executeSql` responses contain more than rows:

```json
{
  "columns": ["..."],
  "rows": [["..."]],
  "row_count": 1,
  "row_count_is_partial": false,
  "backend_validated": true,
  "applied": {
    "dialect": "postgresql",
    "read_only": true,
    "rewrites": ["schema_qualification", "limit_injection"]
  },
  "notes": []
}
```

For a PM, those fields answer practical trust questions:

- **Did the query actually run?** `backend_validated` is true.
- **Was the result truncated?** Check `row_count_is_partial` and `notes`.
- **Was it read-only?** `applied.read_only` is true.
- **Did Phoenix change the query safely?** `applied.rewrites` is explicit.
- **What database interpretation applied?** `applied.dialect` is
  `postgresql`.

## A sensible workflow

1. State the product decision, not a preselected SQL query.
2. Ask `describeSqlSchema` for the relevant area and tables.
3. Run a narrow aggregate or cohort query first.
4. Inspect the returned result metadata before drawing a conclusion.
5. Drill into a small set of traces or examples only after the aggregate points
   to a meaningful segment.

The outcome should be a decision or an investigation target—not a dashboard
reimplemented through an agent.
