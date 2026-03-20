# Collector Performance Improvements and Horizontal Scaling

## Overview

This document describes changes to the Phoenix OTEL collector's span ingestion pipeline that address three interrelated concerns:

1. **Performance** — Eliminate per-span recursive queries in favor of batch-level computation (~2x throughput on PostgreSQL)
2. **Horizontal scaling** — Fix 8 race conditions in `insert_span()` that assumed a single writer, making it safe to run multiple Phoenix instances against the same PostgreSQL database
3. **Correctness** — Replace arrival-order-dependent cumulative value computation with an order-independent algorithm

These concerns are interrelated: the upsert patterns that fix multi-node race conditions also eliminate redundant per-span queries, and the batch recomputation that replaces the recursive CTE is both faster and correct regardless of span arrival order.

## Problem Statement

### Performance Bottleneck

The collector's span insertion path performed expensive per-span work that scaled linearly with batch size:

1. **Per-span recursive CTE** — After inserting each span, a recursive common table expression walked the ancestor chain to propagate cumulative token/error counts upward. For a 1,000-span batch, this meant 1,000 recursive queries.
2. **Per-span project/session resolution** — Each span independently resolved its project name and session ID to database row IDs, issuing redundant queries when multiple spans in a batch shared the same project or session.
3. **Poll-based wake-up** — The `BulkInserter` loop polled on a fixed sleep interval (100ms) regardless of whether work was available, adding unnecessary latency between ingestion and processing.

### Multi-Node Race Conditions

The old `insert_span()` had 8 race conditions that assumed a single writer:

```
Race conditions in the old insert_span():

 Races 1-3: Entity creation TOCTOU (crash — span loss)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  Node A: SELECT Trace ... → None     Node B: SELECT Trace ... → None │
 │  Node A: INSERT Trace ──────────┐                                    │
 │  Node B: INSERT Trace ──────────┼── IntegrityError! Span dropped.    │
 │                                 │   (same for Project, Session)      │
 └──────────────────────────────────────────────────────────────────────┘

 Races 4-5: Time range lost updates (data corruption)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  DB state: trace.end_time = 100                                      │
 │  Node A reads 100, has span end_time=200 → writes 200                │
 │  Node B reads 100, has span end_time=150 → writes 150  (stale read!) │
 │  Result: end_time=150, should be 200                                 │
 └──────────────────────────────────────────────────────────────────────┘

 Race 6: Cumulative value incorrectness (data corruption)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  Node B inserts child: CTE propagates to parent — parent doesn't     │
 │  exist yet (A hasn't committed). Updates 0 rows.                     │
 │  Node A inserts parent: child accumulation misses B's child.         │
 │  Both commit. Cumulative values permanently wrong.                   │
 └──────────────────────────────────────────────────────────────────────┘

 Race 7: Cache invalidation is per-process (stale UI)
 Race 8: SQLite is fundamentally incompatible with multi-node
```

### Why Not Trace-Affinity Routing

We evaluated four strategies for safe horizontal scaling and chose DB-level fixes:

| Strategy                             | Pros                                                | Cons                                                      |
| ------------------------------------ | --------------------------------------------------- | --------------------------------------------------------- |
| **DB-level fixes + repair** (chosen) | No infrastructure deps, prerequisite for all others | Repair task for edge cases                                |
| Receive-then-redistribute            | Strong affinity                                     | Extra network hop, service discovery, consistent hashing  |
| Shared queue (Redis/Kafka)           | Strong partitioning                                 | Infrastructure dependency, serialization overhead         |
| LB-assisted routing                  | Transparent                                         | Only works for Phoenix SDK, multi-trace requests break it |

**Key insight**: gRPC uses HTTP/2 persistent connections. The OTEL SDK in an LLM app sends all spans from one process over one connection, which the load balancer assigns to one Phoenix node. Cross-node trace splitting is a rare edge case (~5%). The DB-level fixes handle 100% of cases correctly, and the repair daemon catches the rare cross-node cumulative value inconsistencies.

### The Recursive CTE Problem

The old cumulative value system used two complementary per-span queries:

```
For each span inserted:
  1. Child accumulation: SELECT SUM(cumulative_*) FROM spans WHERE parent_id = ?
  2. Ancestor propagation CTE:
       WITH RECURSIVE ancestors AS (
         SELECT id, parent_id FROM spans WHERE id = ?
         UNION ALL
         SELECT s.id, s.parent_id FROM spans s
         JOIN ancestors a ON s.id = a.parent_id
       )
       UPDATE spans SET cumulative_* = cumulative_* + ? WHERE id IN (SELECT id FROM ancestors)
```

This approach has two problems:

- **Performance**: O(depth) recursive query per span, multiplied by batch size
- **Correctness**: Arrival-order dependent — if a child span arrives before its parent, no ancestor exists to propagate to, and cumulative values are permanently under-counted

```
Old path — per-span ancestor CTE:
┌─────────────────────────────────────────────────────────┐
│ For each span in batch (1000 spans):                    │
│   ┌─────────────────────────────────────────┐           │
│   │ INSERT span                             │ 1 query   │
│   │ SELECT children's cumulative values     │ 1 query   │
│   │ WITH RECURSIVE ancestors ... UPDATE     │ 1 query   │
│   │ UPSERT trace                            │ 1 query   │
│   │ UPSERT/resolve project                  │ 1 query   │
│   │ UPSERT/resolve session                  │ 0-1 query │
│   └─────────────────────────────────────────┘           │
│   ≈ 5 queries × 1000 spans = ~5,000 queries             │
└─────────────────────────────────────────────────────────┘
```

## Solution

The changes reorganize the insertion pipeline into three phases: batch pre-resolution, simplified per-span insertion, and batch-level cumulative recomputation.

```
New path — batch pre-resolution + post-order recompute:
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Batch pre-resolution (2 queries total)         │
│   ┌─────────────────────────────────────────┐           │
│   │ resolve_projects(all project names)     │ 1 query   │
│   │ resolve_sessions(all session IDs)       │ 1 query   │
│   └─────────────────────────────────────────┘           │
│                                                         │
│ Phase 2: Per-span insertion (simplified)                │
│   ┌─────────────────────────────────────────┐           │
│   │ For each span:                          │           │
│   │   INSERT span                           │ 1 query   │
│   │   UPSERT trace (time range only)        │ 1 query   │
│   │   UPDATE/UPSERT session (if needed)     │ 0-1 query │
│   │   (no recursive CTE)                    │           │
│   └─────────────────────────────────────────┘           │
│   ≈ 2-3 queries × 1000 spans + 2 = ~2,500 queries       │
│                                                         │
│ Phase 3: Batch cumulative recompute (1 pass)            │
│   ┌─────────────────────────────────────────┐           │
│   │ SELECT all spans for affected traces    │ 1 query   │
│   │ In-memory post-order DFS                │ 0 queries │
│   │ Bulk UPDATE cumulative columns          │ 1 query   │
│   └─────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
                    ┌─────────────────────┐
                    │   gRPC / HTTP API   │
                    │  (span ingestion)   │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │    BulkInserter     │
                    │  (async task loop)  │
                    │                     │
                    │  _wake_event.set()  │◄──── enqueue_span()
                    │  _wake_event.wait() │      enqueue_eval()
                    │                     │      enqueue_op()
                    └────────┬────────────┘
                             │
                    ┌────────▼─────────────┐
                    │  _insert_spans()     │
                    │                      │
                    │  1. Snapshot batch   │
                    │  2. Pre-resolve      │──── resolve_projects()
                    │     project/session  │──── resolve_sessions()
                    │  3. Per-span insert  │──── insert_span(propagate_ancestors=False)
                    │  4. Batch recompute  │──── recompute_trace_cumulative_values()
                    │  5. Calculate costs  │
                    └──────────────────────┘
```

## Changes by Component

### 1. Event-Driven Wake-Up (`bulk_inserter.py`)

Replaced the fixed-interval sleep with an `asyncio.Event`-based wake-up mechanism.

**Before**: `await asyncio.sleep(0.1)` — always waited 100ms between polls
**After**: `await asyncio.wait_for(self._wake_event.wait(), timeout=0.1)` — wakes immediately when work arrives, falls back to 100ms timeout

The event is set on every enqueue path (`_enqueue_span`, `_enqueue_evaluation`, `_enqueue_operation`, `_enqueue_annotations`) and cleared at the start of `_wait_for_work()`.

Graceful shutdown uses `asyncio.wait_for(task, timeout=5.0)` instead of immediate cancellation, allowing in-flight batches to complete.

### 2. Batch Pre-Resolution (`span.py`)

Two new functions resolve project names and session IDs in bulk before the per-span loop:

- **`resolve_projects(session, project_names)`** — Single query to resolve all project names to row IDs. Inserts any missing projects with `ON CONFLICT DO NOTHING`.
- **`resolve_sessions(session, session_ids)`** — Single `SELECT ... WHERE IN` to cache session ID → row ID mappings.

Results are passed to `insert_span()` as `project_cache` and `session_cache` dicts, eliminating redundant per-span resolution.

### 3. Cumulative Value Recomputation (`cumulative.py`)

New module replacing the per-span recursive CTE with a batch-level post-order tree traversal:

```python
def _get_cumulative_counts(spans: Sequence[models.Span]) -> list[CumulativeCount]:
    """Iterative post-order DFS over the span tree.

    1. Build parent→children adjacency map
    2. Initialize each span with own values (errors, tokens)
    3. Post-order traverse from roots: each parent accumulates children's counts
    """
```

**Key properties**:

- **Arrival-order independent** — Operates on the full set of spans per trace, not incrementally. Produces correct results regardless of which spans arrived first.
- **Handles disjoint fragments** — Spans whose parent is not in the batch get own-values only (no crash, no incorrect accumulation).
- **Single bulk UPDATE** — All cumulative column updates are batched into one `session.execute(update(Span), updates)`.

```
Post-order traversal example:

         Root (tokens: 5)
        /                \
   Child-A (tokens: 3)   Child-B (tokens: 2)
      |
   Grandchild (tokens: 1)

Traversal order: Grandchild → Child-A → Child-B → Root

After accumulation:
  Grandchild: cumulative_tokens = 1  (own)
  Child-A:    cumulative_tokens = 4  (own 3 + child 1)
  Child-B:    cumulative_tokens = 2  (own, no children)
  Root:       cumulative_tokens = 11 (own 5 + child-A 4 + child-B 2)
```

### 4. Concurrent-Safe Upserts (`span.py`) — Fixes Races 1-5

All entity creation and time range mutations replaced with atomic, idempotent SQL patterns:

**Entity creation (Races 1-3):** SELECT-then-INSERT replaced with `INSERT ... ON CONFLICT`:

```
Old (race-prone):                      New (concurrent-safe):
  SELECT Trace WHERE trace_id=?          INSERT Trace ... ON CONFLICT (trace_id)
  if None: INSERT Trace                    DO UPDATE SET
  (IntegrityError if two nodes race)         start_time = LEAST(existing, new),
                                             end_time = GREATEST(existing, new)
                                           RETURNING id, project_rowid, ...
```

**Time range updates (Races 4-5):** Python read-modify-write replaced with SQL atomic updates:

| Operation           | PostgreSQL                | SQLite               |
| ------------------- | ------------------------- | -------------------- |
| Expand `start_time` | `LEAST(existing, new)`    | `MIN(existing, new)` |
| Expand `end_time`   | `GREATEST(existing, new)` | `MAX(existing, new)` |

Both trace and session upserts use `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` to atomically create-or-update and return the row ID in a single statement. Under concurrent writes, PostgreSQL row-level locks serialize the UPDATEs — each writer reads the latest committed value after acquiring the lock.

**Session resolution has three priority paths:**

1. **Trace FK path** — `project_session_rowid` returned from trace UPSERT (session already linked)
2. **Cache-hit path** — `session_cache` dict from batch pre-resolution (skip DB entirely)
3. **Cache-miss path** — `_upsert_session()` fires a full upsert

### 5. Cumulative Repair Daemon (`cumulative_repair.py`) — Fixes Race 6

Safety-net background daemon that periodically recomputes cumulative values for all traces. Handles two scenarios:

- **Cross-node inconsistency** — When spans from the same trace are inserted by different nodes concurrently, each node's batch recompute sees incomplete data. The repair daemon catches these.
- **Interrupted batches** — App crash mid-insert may leave stale cumulative values.

```
Repair daemon lifecycle:

  ┌──────────────────────────────────────────────────┐
  │            CumulativeRepairTask                  │
  │                                                  │
  │  PostgreSQL only (no-op on SQLite)               │
  │                                                  │
  │  Every 30s (configurable):                       │
  │    SELECT 100 trace IDs                          │
  │      FOR UPDATE SKIP LOCKED  ◄── avoids          │
  │                                  contending      │
  │    For each trace:               with active     │
  │      Load all spans              BulkInserter    │
  │      Run _get_cumulative_counts()                │
  │      Bulk UPDATE cumulative columns              │
  └──────────────────────────────────────────────────┘
```

- **PostgreSQL only** — Uses `SELECT ... FOR UPDATE SKIP LOCKED` to avoid contending with active `BulkInserter` writes. Skipped entirely on SQLite (single-writer model handles it).
- **Batch patrol** — Processes 100 traces per cycle with a configurable interval (`PHOENIX_CUMULATIVE_REPAIR_INTERVAL_SEC`, default 30s, 0 to disable).
- **Reuses `recompute_trace_cumulative_values()`** — Same algorithm as the primary insertion path, ensuring consistency.

### 6. Cluster Mode Validation (`config.py`, `app.py`)

- **`PHOENIX_CLUSTER_MODE`** — Environment variable to indicate multi-node deployment
- **Startup warning** — If `PHOENIX_CLUSTER_MODE` is set but SQLite is the database backend, Phoenix logs a warning: SQLite does not support the row-level locking required for safe multi-node operation

### 7. ExperimentRun Fix (`chat_mutations.py`)

Changed ExperimentRun span cost tracking from `cumulative_llm_token_count_*` to `llm_token_count_*` columns. ExperimentRun records single-span usage, not subtree totals — the cumulative columns were incorrect for this use case.

## Horizontal Scaling Model

Each Phoenix instance has its own `BulkInserter`. Multiple instances against the same PostgreSQL:

```
                    ┌──────────────┐
                    │ Load Balancer│
                    └───┬───┬───┬──┘
                       │   │   │   gRPC persistent connections
                       ▼   ▼   ▼   (natural affinity: one SDK → one node)
                    ┌───────────────────────────────────┐
                    │  Phoenix Node A  │  Phoenix Node B│
                    │  BulkInserter    │  BulkInserter  │
                    │  (own batches)   │  (own batches) │
                    └───────┬───────────────┬───────────┘
                           │               │
                           ▼               ▼
                    ┌──────────────────────────┐
                    │      PostgreSQL          │
                    │  Row-level locks         │
                    │  ON CONFLICT upserts     │
                    │  SKIP LOCKED repair      │
                    └──────────────────────────┘
```

### What's Not Yet Implemented

- **PG LISTEN/NOTIFY for cross-node cache invalidation (Race 7)** — Each node's in-process caches (`CacheForDataLoaders`, `DmlEventHandler`) are not invalidated when another node inserts spans. Planned: `NOTIFY phoenix_span_insert` after batch insertion, with each node subscribing to invalidate local caches.
- **Race 8 (SQLite multi-node)** — Fundamentally impossible. Documented via the `PHOENIX_CLUSTER_MODE` startup warning.

## Performance Results

Benchmarked with `scripts/perf/collector/benchmark_span_insertion.py` — 20 measurement batches per configuration, 3 warmup batches discarded, randomized configuration order.

### PostgreSQL (local PG 14)

| Topology  | Batch Size | Old (spans/s) | New (spans/s) | Improvement | Query Reduction |
| --------- | ---------- | ------------- | ------------- | ----------- | --------------- |
| branching | 100        | 157           | 477           | **+204%**   | 19.7%           |
| branching | 500        | 245           | 429           | **+75%**    | 19.9%           |
| branching | 1000       | 245           | 480           | **+96%**    | 20.0%           |
| linear    | 100        | 218           | 489           | **+125%**   | 19.6%           |
| linear    | 500        | 252           | 480           | **+90%**    | 19.9%           |
| linear    | 1000       | 251           | 489           | **+95%**    | 20.0%           |
| mixed     | 100        | 192           | 477           | **+148%**   | 19.7%           |
| mixed     | 500        | 287           | 466           | **+62%**    | 19.9%           |
| mixed     | 1000       | 284           | 487           | **+72%**    | 20.0%           |

### SQLite (in-memory, sqlean)

| Topology  | Batch Size | Old (spans/s) | New (spans/s) | Improvement |
| --------- | ---------- | ------------- | ------------- | ----------- |
| branching | 100        | 317           | 449           | +41.6%      |
| branching | 500        | 329           | 442           | +34.5%      |
| branching | 1000       | 336           | 426           | +26.9%      |
| linear    | 100        | 304           | 449           | +47.8%      |
| linear    | 500        | 315           | 459           | +46.0%      |
| linear    | 1000       | 319           | 446           | +39.9%      |
| mixed     | 100        | 323           | 443           | +37.0%      |
| mixed     | 500        | 331           | 442           | +33.6%      |
| mixed     | 1000       | 320           | 453           | +41.4%      |

### Query Counts (PostgreSQL)

Measured via SQLAlchemy `before_cursor_execute` event hook. Counts include all SQL statements (INSERT, SELECT, UPDATE, SAVEPOINT, RELEASE).

| Batch Size | Topology  | Old Queries | New Queries | Reduction |
| ---------- | --------- | ----------- | ----------- | --------- |
| 100        | linear    | 500         | 402         | 19.6%     |
| 500        | linear    | 2,500       | 2,002       | 19.9%     |
| 1,000      | linear    | 5,000       | 4,002       | 20.0%     |
| 1,000      | branching | 5,445       | 4,358       | 20.0%     |

## Files Changed

| File                                                 | Change                                                                                                                     | Concern                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `src/phoenix/db/bulk_inserter.py`                    | Event-driven wake-up, batch pre-resolution, `propagate_ancestors=False`                                                    | Performance               |
| `src/phoenix/db/insertion/span.py`                   | `resolve_projects()`, `resolve_sessions()`, `_upsert_trace()`, `_upsert_session()`, `project_cache`/`session_cache` params | Performance + Scaling     |
| `src/phoenix/db/insertion/cumulative.py`             | **New** — `_get_cumulative_counts()`, `recompute_trace_cumulative_values()`                                                | Performance + Correctness |
| `src/phoenix/server/daemons/cumulative_repair.py`    | **New** — `CumulativeRepairTask` (PG-only safety net)                                                                      | Scaling                   |
| `src/phoenix/server/app.py`                          | Wire up `CumulativeRepairTask`, cluster mode warning                                                                       | Scaling                   |
| `src/phoenix/config.py`                              | `PHOENIX_CUMULATIVE_REPAIR_INTERVAL_SEC`, `PHOENIX_CLUSTER_MODE` env vars                                                  | Scaling                   |
| `src/phoenix/tracers.py`                             | Import shared `recompute_trace_cumulative_values`                                                                          | Correctness               |
| `src/phoenix/server/api/mutations/chat_mutations.py` | ExperimentRun: use own-value columns, not cumulative                                                                       | Correctness               |
| `tests/unit/db/test_bulk_inserter.py`                | Stabilize timing-flaky test with event-ordering assertions                                                                 | Testing                   |
| `tests/unit/db/test_cumulative.py`                   | Tests for disjoint fragments, repair daemon                                                                                | Testing                   |
| `tests/unit/db/test_span_insertion.py`               | Tests for session UPSERT paths, parity test rewrite                                                                        | Testing                   |
| `scripts/perf/collector/benchmark_span_insertion.py` | **New** — Reusable benchmark harness (SQLite + PG)                                                                         | Testing                   |

## Running the Benchmark

```bash
# SQLite (in-memory, default)
uv run python scripts/perf/collector/benchmark_span_insertion.py

# PostgreSQL
uv run python scripts/perf/collector/benchmark_span_insertion.py \
  --db-url postgresql://user@localhost/dbname

# Custom configuration
uv run python scripts/perf/collector/benchmark_span_insertion.py \
  --batch-sizes 100,500,1000 \
  --topologies linear,branching,mixed \
  --runs 20 \
  --output scripts/perf/collector/
```
