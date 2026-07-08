# Aurora Replica Write Forwarding: Compatibility Analysis for Phoenix

## Summary

Aurora PostgreSQL's [local write forwarding](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-postgresql-write-forwarding-understanding.html) allows read replicas to forward write operations to the writer instance. **Phoenix is fundamentally incompatible with this feature.** Phoenix's runtime code and migrations both rely on SQL features that Aurora write forwarding explicitly does not support.

If Phoenix is connected to a reader endpoint with write forwarding enabled, it will fail on span ingestion (the hottest path due to SAVEPOINTs) and migrations (DDL at startup).

**The fix:** Connect Phoenix directly to the Aurora **writer endpoint**. Write forwarding is designed for lightweight, occasional DML from read replicas — not for a primary application workload.

---

## What Aurora write forwarding does not support

From the [AWS documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-postgresql-write-forwarding-limitations.html), the following SQL features are **not supported** through write forwarding:

| Category | Unsupported operations |
|---|---|
| **DDL** | CREATE, ALTER, DROP (all objects) |
| **SAVEPOINT** | Including implicit SAVEPOINTs from PL/pgSQL exception handling |
| **Sequences** | `nextval()`, `setval()` |
| **GRANT / REVOKE** | All privilege management |
| **LOCK** | Explicit table locks |
| **TRUNCATE** | Table truncation |
| **COPY** | Bulk data loading |
| **Cursors** | Must be closed before using write forwarding |
| **SELECT INTO** | Creating tables from queries |
| **Two-phase commit** | PREPARE TRANSACTION, COMMIT PREPARED, ROLLBACK PREPARED |
| **User-defined functions/procedures** | All UDFs and stored procedures |
| **LISTEN / NOTIFY** | Pub/sub notifications |
| **VACUUM / ANALYZE / CLUSTER** | Maintenance operations |

Write forwarding **only** supports: basic DML (`INSERT`, `UPDATE`, `DELETE`), `SELECT FOR UPDATE/SHARE`, `EXPLAIN`, and `PREPARE`/`EXECUTE`.

---

## Where Phoenix hits these limitations

### 1. SAVEPOINT — span ingestion, evaluations, JWT refresh (runtime)

Phoenix uses `session.begin_nested()` (which issues `SAVEPOINT` / `RELEASE SAVEPOINT` at the PostgreSQL level) extensively in its hottest code paths:

**`src/phoenix/db/bulk_inserter.py`** — the primary span/trace ingestion path:

```python
async with session.begin_nested():       # ← SAVEPOINT
    await op(session)
```

```python
async with session.begin_nested():       # ← SAVEPOINT
    result = await insert_span(session, span, project_name)
```

```python
async with session.begin_nested():       # ← SAVEPOINT
    await insert_evaluation(session, evaluation)
```

**`src/phoenix/db/insertion/types.py`** — bulk insert with individual fallback:

```python
async with session.begin_nested():       # ← SAVEPOINT (bulk attempt)
    events.extend(await self._events(session, *(p.item for p in parcels)))
# on failure, retries individually:
for p in parcels:
    async with session.begin_nested():   # ← SAVEPOINT (individual retry)
        events.extend(await self._events(session, p.item))
```

**`src/phoenix/server/jwt_store.py`** — token refresh:

```python
async with session.begin_nested():       # ← SAVEPOINT
    await self._delete_expired_tokens(session)
async with session.begin_nested():       # ← SAVEPOINT
    async for record, role in await session.stream(self._update_stmt):
```

**`src/phoenix/server/api/mutations/experiment_mutations.py`** — experiment deletion:

```python
savepoint = await session.begin_nested()  # ← SAVEPOINT
```

**Impact:** Every span ingested, every evaluation recorded, every JWT refresh, and every experiment deletion would fail. This is not an edge case — it's the default behavior on every request.

**Why Phoenix uses savepoints:** The `begin_nested()` pattern allows individual record failures (constraint violations, serialization errors) to be caught and retried without aborting the entire outer transaction. The bulk inserter uses this to fall back from batch inserts to individual inserts on failure. Without savepoints, a single bad span would roll back the entire batch.

### 2. DDL — all migrations (startup)

Phoenix migrations are DDL-heavy. Every migration creates tables, adds columns, creates indexes, or alters constraints. The migration log from a fresh database shows 100% DDL:

```
CREATE TABLE alembic_version (...)
CREATE TABLE projects (...)
CREATE TABLE traces (...)
CREATE TABLE spans (...)
ALTER TABLE spans ADD COLUMN ...
CREATE INDEX ix_spans_session_id ...
```

**Impact:** Phoenix cannot start up if there are pending migrations and the connection goes through a write-forwarding reader. On a fresh database, the very first step (`CREATE TABLE alembic_version`) would fail. On an existing database, startup succeeds only if the schema is already at head — any pending migration would fail.

### 3. Sequences — `nextval()` / `setval()` (ambiguous)

The AWS limitations page lists "Sequence updates: `nextval()`, `setval()`" as unsupported. Phoenix uses `SERIAL` primary keys on virtually every table, and `SERIAL` is syntactic sugar for `DEFAULT nextval('tablename_id_seq')`.

```sql
-- What Phoenix's CREATE TABLE produces:
id SERIAL NOT NULL
-- Which PostgreSQL expands to:
id integer NOT NULL DEFAULT nextval('projects_id_seq')
```

However, the scope of this limitation is **ambiguous in the AWS documentation**. Two interpretations are possible:

- **(a) Standalone calls only:** `SELECT nextval('my_seq')` or `SELECT setval('my_seq', 100)` issued directly from the reader session are unsupported, but `INSERT` statements that trigger `nextval()` via a `DEFAULT` value work fine — because the INSERT is forwarded to the writer, which evaluates the default locally.
- **(b) Any SQL triggering nextval():** Including implicit calls from INSERT into SERIAL columns.

Interpretation (a) is more likely because:
- `INSERT` is explicitly listed as supported DML.
- The docs state: "the entire statement is forwarded to the writer DB instance and run there" — the writer would evaluate `nextval()` on its own sequences.
- If (b) were true, the feature would be unusable for virtually every real-world PostgreSQL application, contradicting AWS's description of it for "read-heavy workloads that require occasional writes."

**Impact:** Likely no impact on runtime INSERTs (interpretation a). But this has not been verified empirically. If the customer encounters INSERT failures on SERIAL tables, this would confirm interpretation (b).

### 4. Other limitations to be aware of

- **RDS Proxy incompatibility**: Aurora write forwarding is not supported with RDS Proxy, per AWS docs. Customers cannot combine both features.
- **LOCK statements**: Advisory locks (`pg_advisory_lock` / `pg_advisory_xact_lock`) would not work through write forwarding. This is only relevant if migration serialization via advisory locks is added in the future (see `internal_docs/vignettes/postgres/advisory-lock-analysis.md`).

---

## Could SAVEPOINTs be removed?

In PostgreSQL, once any statement fails inside a transaction, the transaction enters an **aborted state** — every subsequent statement fails with `current transaction is aborted, commands ignored until end of transaction block`. The only recovery options are `ROLLBACK` (lose everything) or `ROLLBACK TO SAVEPOINT` (lose just the failed part). This is a PostgreSQL fundamental, not an application choice.

### What the SAVEPOINTs protect

| Call site | Pattern | What fails without it |
|---|---|---|
| `bulk_inserter.py` (spans) | One savepoint per span insert | One bad span kills all remaining spans in the batch |
| `bulk_inserter.py` (evals) | One savepoint per evaluation | One bad eval kills all remaining evals |
| `insertion/types.py` | Batch attempt → individual fallback | If the batch fails, can't retry individually (transaction is aborted) |
| `jwt_store.py` | Separate savepoints for delete + read | A failure in `_delete_expired_tokens` would prevent reading tokens |
| `experiment_mutations.py` | Savepoint around DELETE...RETURNING | Can't rollback the delete if unknown IDs are found |

### Possible alternatives (with tradeoffs)

1. **One transaction per span.** Replace `begin_nested()` with a separate `async with self._db() as session:` per span. Eliminates savepoints entirely, but N separate transactions instead of 1 transaction with N savepoints means more round trips and more overhead. For the bulk inserter processing hundreds of spans per cycle, this could be a meaningful performance regression.

2. **Use `ON CONFLICT` more aggressively.** If the failure mode is primarily constraint violations (duplicate keys, FK violations), `INSERT ... ON CONFLICT DO NOTHING` avoids the error entirely — no savepoint needed. This wouldn't help with all error types (serialization failures, data type errors), but could reduce savepoint usage in the common case. Would require auditing every insert path to understand which errors actually occur in practice.

3. **Pre-validate data** before inserting. Filter out obviously bad spans/evals before they hit the database. Same limitation: can't predict all failure modes (race conditions, serialization errors).

4. **`jwt_store.py` specifically** — the two savepoints here could likely be separate transactions. The delete-then-read doesn't appear to require atomicity — if the delete fails, it's fine to skip the read and retry on the next cycle.

### Bottom line

Some savepoints could be reduced (jwt_store, more aggressive ON CONFLICT), but the bulk inserter's savepoint-per-span pattern is the correct approach for resilient ingestion and cannot be eliminated without a performance or reliability regression. More importantly, even if every SAVEPOINT were removed, DDL in migrations remains unsupported — the customer would still need to connect to the writer endpoint.

## Why this isn't fixable at the application level

1. **Savepoints** are the correct pattern for resilient bulk ingestion (see above). Alternatives exist but trade performance or reliability.
2. **DDL** is inherent to database migrations. There is no migration tool that avoids DDL.
3. **Single connection string.** Phoenix uses one `PHOENIX_SQL_DATABASE_URL` for both runtime queries and migrations. Even if SAVEPOINTs were eliminated from runtime code, migrations would still need the writer endpoint. Supporting split routing (migrations → writer, runtime → reader with write forwarding) would require a second connection string and significant architectural changes — disproportionate to the benefit, since connecting to the writer directly solves the problem completely.

---

## Recommendation

**Connect Phoenix to the Aurora writer endpoint directly.** This is the only supported configuration.

```
# Correct: writer endpoint
PHOENIX_SQL_DATABASE_URL=postgresql://user:pass@my-cluster.cluster-xxxx.us-east-1.rds.amazonaws.com:5432/phoenix

# Incorrect: reader endpoint with write forwarding
PHOENIX_SQL_DATABASE_URL=postgresql://user:pass@my-cluster.cluster-ro-xxxx.us-east-1.rds.amazonaws.com:5432/phoenix
```

Aurora's write forwarding is designed for applications where read replicas occasionally need to perform simple DML (e.g., updating a "last_seen" timestamp from a read-heavy reporting service). It is not designed for — and cannot support — a primary application workload that uses DDL and savepoints.

If the goal is read scaling, the standard Aurora pattern is:
- **Writer endpoint** for Phoenix (all writes + reads that need strong consistency)
- **Reader endpoint** for separate read-only reporting/analytics workloads (e.g., Grafana dashboards querying traces)

Phoenix itself does not support split read/write routing (all queries go through the configured `PHOENIX_SQL_DATABASE_URL`), so there is no benefit to pointing Phoenix at a reader endpoint.

---

## Aurora product disambiguation

Amazon offers several PostgreSQL-compatible products under the Aurora umbrella. This analysis applies specifically to **Aurora PostgreSQL** with the local write forwarding feature enabled. For clarity:

| Product | Write forwarding | Affected by this analysis |
|---|---|---|
| **Aurora PostgreSQL** (standard) | Optional feature, off by default | Yes, if write forwarding is enabled |
| **Aurora PostgreSQL Limitless Database** | N/A (distributed writes) | No — different architecture entirely |
| **Aurora DSQL** | N/A (serverless distributed SQL) | Separate compatibility considerations (no PostgreSQL extensions, limited DDL in transactions) |

If the customer is on standard Aurora PostgreSQL and hasn't explicitly enabled `EnableLocalWriteForwarding`, write forwarding is off and this analysis doesn't apply — their issue may have a different root cause.
