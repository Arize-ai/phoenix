# Manual MCP analytics SQL examples

These examples were executed against a local Phoenix server using the MCP
code-mode `execute` tool. They show both sides of the surface:
`describeSqlSchema` for discovery and `executeSql` for read-only queries.

> **SQLite examples.** The live calls and SQL spellings in this document were
> executed against SQLite. Use `describeSqlSchema` to check the active dialect
> before copying a query to PostgreSQL; JSON functions and time bucketing
> spellings may differ.

The exact IDs, timestamps, engine version, and fixture rows in a different
deployment will differ. The result shapes and the fixture answers should not.

## Calling tools in code mode

First discover the tools:

```text
search({ "query": "describe SQL schema and execute read-only analytics SQL" })
get_schema({ "tools": ["describeSqlSchema", "executeSql"], "detail": "full" })
```

Then pass an async Python block to the MCP `execute` tool. The only available
function inside the block is `call_tool(name, params)`.

```python
return await call_tool("describeSqlSchema", {"detail": "brief"})
```

A client that exposes tools directly can call `describeSqlSchema` and
`executeSql` with the inner parameter objects below instead.

## `describeSqlSchema` examples

### 1. Browse the catalog

```python
return await call_tool("describeSqlSchema", {"detail": "brief"})
```

The local SQLite server returned this abbreviated shape:

```json
{
  "dialect": "sqlite",
  "areas": {
    "telemetry": {
      "tables": {
        "projects": {"grain": "One row per project"},
        "traces": {"grain": "One row per trace"},
        "spans": {"grain": "One row per span"}
      }
    },
    "datasets": {"tables": {"datasets": {}, "dataset_versions": {}}},
    "experiments": {"tables": {"experiments": {}, "experiment_runs": {}}}
  },
  "engine": {"name": "SQLite", "extensions": ["text", "stats", "crypto"]},
  "limits": {"default_row_limit": 500, "max_row_limit": 5000, "row_byte_limit": 262144,
             "response_byte_limit": 4194304},
  "guarantees": {"read_only": true, "runtime_backstop": "sqlite_progress_handler",
                 "snapshot_isolated": false,
                 "consistency_note": "Results are not snapshot-isolated; identical SQL may differ under concurrent ingestion."}
}
```

The real response lists every allowlisted table; the excerpt above is trimmed
only for readability.

### 2. Inspect the span-to-project join path

```python
return await call_tool(
    "describeSqlSchema",
    {
        "tables": ["spans"],
        "detail": "detailed",
    },
)
```

Relevant fields returned by the local server:

```json
{
  "grain": "One row per span",
  "time_column": "start_time",
  "joins": ["spans.trace_rowid = traces.id"],
  "path_to_area_root": [
    "spans.trace_rowid = traces.id",
    "traces.project_rowid = projects.id"
  ],
  "virtual_columns": ["graphql_node_id", "latency_ms"]
}
```

Use this path rather than inventing a project column on `spans`.

### 3. Find token-related tables and columns

```python
return await call_tool(
    "describeSqlSchema",
    {
        "area": "telemetry",
        "search": "token",
        "detail": "detailed",
    },
)
```

This returned `spans`, `span_costs`, and `span_cost_details`. In particular,
`spans` exposes `llm_token_count_prompt` and
`cumulative_llm_token_count_prompt`. Its full detail includes the warning not
to sum the cumulative column across spans.

### 4. Inspect a dataset revision model

```python
return await call_tool(
    "describeSqlSchema",
    {
        "area": "datasets",
        "tables": ["datasets", "dataset_versions", "dataset_example_revisions"],
        "detail": "full",
    },
)
```

Use `full` when the table-level documentation and examples matter. Use
`detailed` for the smaller column, join, and virtual-column payload.

## `executeSql` examples

Always discover the table and column names first. These queries use the
`fixture-*` projects seeded by `seed_analytics_fixture.py`.

### 1. Validate before execution

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        SELECT p.name, SUM(s.llm_token_count_prompt) AS prompt_tokens
        FROM projects p
        JOIN traces t ON t.project_rowid = p.id
        JOIN spans s ON s.trace_rowid = t.id
        WHERE p.name = 'fixture-tokens'
        GROUP BY p.name
    """,
        "validate_only": True,
    },
)
```

The local server returned no rows because it did not execute the statement,
but confirmed admission and backend validation:

```json
{
  "columns": [],
  "rows": [],
  "row_count": 0,
  "backend_validated": true,
  "applied": {
    "dialect": "sqlite",
    "rewrites": ["limit_injection"]
  }
}
```

### 2. Sum per-span prompt tokens

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        SELECT p.name, SUM(s.llm_token_count_prompt) AS prompt_tokens
        FROM projects p
        JOIN traces t ON t.project_rowid = p.id
        JOIN spans s ON s.trace_rowid = t.id
        WHERE p.name = 'fixture-tokens'
        GROUP BY p.name
    """,
    },
)
```

Live result:

```json
{
  "columns": ["name", "prompt_tokens"],
  "rows": [["fixture-tokens", 300]],
  "row_count": 1,
  "row_count_is_partial": false,
  "backend_validated": true,
  "notes": []
}
```

The per-span column is intentional: summing `cumulative_*` would count
subtree totals repeatedly.

### 3. Use the advertised `latency_ms` virtual column

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        SELECT
          percentile(s.latency_ms, 50) AS p50_ms,
          percentile(s.latency_ms, 95) AS p95_ms
        FROM spans s
        JOIN traces t ON s.trace_rowid = t.id
        JOIN projects p ON t.project_rowid = p.id
        WHERE p.name = 'fixture-workload'
    """,
    },
)
```

Live result:

```json
{
  "columns": ["p50_ms", "p95_ms"],
  "rows": [[80.00016212463379, 900.0000953674316]],
  "row_count": 1,
  "backend_validated": true,
  "applied": {
    "rewrites": ["latency_ms", "limit_injection"]
  }
}
```

The fixture oracle rounds these values to p50 = 80 ms and p95 = 900 ms. The
`latency_ms` rewrite is visible in `applied.rewrites`.

### 4. Limit an exploratory query explicitly

```python
return await call_tool(
    "executeSql",
    {
        "sql": """
        SELECT s.span_id, s.name, s.span_kind, s.latency_ms
        FROM spans s
        JOIN traces t ON s.trace_rowid = t.id
        JOIN projects p ON t.project_rowid = p.id
        WHERE p.name = 'fixture-workload'
        ORDER BY s.start_time
    """,
        "row_limit": 25,
    },
)
```

The response tells the caller whether the result was cut short:

```json
{
  "row_count": 25,
  "row_count_is_partial": true,
  "notes": ["row_limit reached"],
  "applied": {"row_limit": 25}
}
```

## Reading an execution envelope

Every successful `executeSql` response contains:

| Field | Meaning |
|---|---|
| `columns` / `rows` | Result-set values, with row cells ordered by `columns` |
| `row_count` / `row_count_is_partial` | Returned-row count and whether a cap truncated it |
| `applied` | Row limit, dialect, and SQL rewrites the server applied |
| `backend_validated` | Whether the target database validated the admitted statement |
| `notes` | Non-fatal response warnings |

The server imposes
no window of its own, so nothing narrowed the result behind the caller's back.

The envelope carries only what can differ between two calls. The caps, the
read-only guarantee, and the runtime backstop are properties of the surface, not
of any one answer, and `describeSqlSchema` states them once under `limits` and
`guarantees`.
