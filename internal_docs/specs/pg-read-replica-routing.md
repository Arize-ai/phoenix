# Read Replica Routing

**Status:** Implemented in #12532 (PostgreSQL replica) and extended in #15075 (SQLite read pool).

This document records the design and its rules. It names code by symbol rather than by file line or excerpt, so that refactors of engine wiring do not make it stale. To find the current wiring, search for the symbols it names.

## Problem

Phoenix originally used one PostgreSQL engine and connection pool for both reads and writes. Under high ingestion load, read-heavy work (project page aggregates, annotation-name scans, pagination, and span-tree loaders) competes with writes for the same pool and the same primary.

Large span pulls were reported to reduce ingestion speed. This is consistent with contention between heavy reads and writes on a shared pool and a shared primary.

The bottleneck is not lock blocking between `SELECT` and `INSERT`. It is:

- connection-pool contention;
- CPU, I/O, and WAL contention on the primary;
- buffer-cache churn on a single node.

Routing read-only traffic to a replica gives the reads their own pool and buffer cache, which reduces user-facing latency under load.

## Goals

- Route replica-safe reads to a read replica.
- Keep all writes on the primary.
- Keep deployments without a replica unchanged.
- Keep SQLite deployments working without configuration.

## Non-goals

- No rewrite of SQL or query logic.
- No schema changes.
- No frontend changes.
- No replica infrastructure management from Phoenix (provisioning, failover, WAL or replication-slot tuning).
- No replication-lag monitoring, circuit breakers, or client-side health checks; these are operator concerns.
- No session stickiness or post-write pinning until a concrete need appears.

## Scope boundary

Phoenix is a client of the primary and replica databases.

- **Phoenix owns** routing each session to the read or the write engine, and the related observability.
- **The operator owns** replica provisioning, replication settings, lag and WAL tuning, failover, server-side read-only enforcement, and replica health monitoring.
- **Contract:** Operators should set `default_transaction_read_only=on` on the replica role or server as a database-level safety net.

The replica URL must point to a standard streaming replica or an Aurora reader endpoint, not to an Aurora reader with write forwarding enabled. Phoenix is incompatible with Aurora write forwarding because bulk ingestion uses SAVEPOINTs and migrations use DDL (see `internal_docs/vignettes/postgresql/aurora-write-forwarding-analysis.md`).

## Design

### Session factory

`DbSessionFactory` (in `phoenix.server.types`) exposes two ways to open a session. Each `async with` block is one transaction.

- `db()` opens a session on the write engine (the primary). It is the default for every callsite and is always safe.
- `db.read()` opens a session on the read engine when one is configured, and on the write engine otherwise.

The constructor takes an optional `read_db` session callable; when it is absent, `read()` uses the write engine. Callsites can therefore use `db.read()` in every deployment, and the call is a routing hint that has no effect when no read engine exists.

### Read engines

The server setup (`_create_db_session_factory` in the `serve` command) chooses at most one read engine:

- **PostgreSQL with `PHOENIX_SQL_DATABASE_READ_REPLICA_URL` set:** a second engine is created from that URL with `migrate=False`. It is otherwise configured like the primary: the same connection arguments, SSL, JSON serializer, and IAM handling.
- **SQLite file database:** a read-only engine (`aio_sqlite_read_engine`, opened with `mode=ro`) gives each concurrent reader its own connection, so reads do not queue behind the writer's single connection. In-memory SQLite has no read engine, because a second connection to `:memory:` opens a different, empty database.
- **Any other case:** no read engine. If the replica URL is set with a non-PostgreSQL primary, the server logs a warning and ignores it.

The notebook entrypoint (`ThreadSession`) creates only a write engine.

### Rules every read engine must follow

- It never runs migrations. Only the primary runs Alembic.
- It is registered for the same lifecycle handling as the primary: server telemetry instruments it, and it is disposed on shutdown.
- It needs no separate schema configuration. The ORM metadata carries the schema (`PHOENIX_SQL_DATABASE_SCHEMA`), so generated SQL uses qualified table names. `SET search_path` runs only in the migration runner, which never runs on a read engine.
- It has its own connection pool. With the default `QueuePool` settings (`pool_size=5`, `max_overflow=10`), total connections are up to 15 per engine. Operators can tune each pool through URL query parameters, and must size the replica's `max_connections` for the extra pool.

### Design decisions

**`db()` always routes to the primary.** There is no configurable default route. Read paths are annotated explicitly with `db.read()`; any callsite not yet classified keeps using `db()`.

**No automatic fallback when the replica fails.** If the replica is configured but unreachable, requests on read paths fail with errors and write paths are unaffected. The remediation is to fix the replica, or to unset `PHOENIX_SQL_DATABASE_READ_REPLICA_URL` and restart. Fallback was rejected for these reasons:

1. Errors surface at different times. Connection-refused errors appear when the session begins, but stale-connection errors can appear mid-query, after the session has been handed to the caller, and a wrapper cannot swap the session at that point.
2. An `@asynccontextmanager` yields once, so a fallback can only cover errors raised before the yield.
3. Silent fallback hides the failure: the primary carries all the load again and the operator gets no signal.

If fallback is added later, it should be opt-in and limited to errors raised when the session begins.

### Configuration

One environment variable: `PHOENIX_SQL_DATABASE_READ_REPLICA_URL`, a PostgreSQL connection URL.

- The `PHOENIX_SQL_DATABASE_` prefix matches `PHOENIX_SQL_DATABASE_URL` and `PHOENIX_SQL_DATABASE_SCHEMA`. `READ_REPLICA_URL` states the purpose more precisely than `REPLICA_URL`.
- There is no component-based form (`PHOENIX_POSTGRES_REPLICA_HOST` and similar). A single URL is enough until operators ask for components.
- When `PHOENIX_POSTGRES_USE_AWS_IAM_AUTH` is enabled, the replica engine uses IAM authentication with the same credentials. This fits AWS Aurora and RDS, where one IAM policy grants access to the writer and reader endpoints. Other setups should put credentials in the replica URL.
- There are deliberately no flags for a default route, fallback, maximum lag, or post-write stickiness. Each flag doubles the configurations to reason about, so knobs are added only when operators show a need.

At startup, the server logs the replica host when it creates the replica engine, and the boot message shows the replica URL with the password hidden.

## Routing policy

Base rule: if a session may modify data at any point in its transaction, it uses `db()`.

### A callsite may use `db.read()` only when all of these hold

1. The whole block uses only read operations: `scalar`, `scalars`, `stream`, `get`, `execute(select(...))`, or `run_sync` with read-only SQL.
2. The block calls no ORM mutators: no `add`, `add_all`, `delete`, `flush`, or `commit` of pending changes.
3. The block calls no helper that writes, such as `insert_on_conflict` or other upsert helpers.
4. The caller tolerates stale data. Replica lag is usually under a second but has no upper bound. Code that must observe its own earlier writes must not use `db.read()`.

### These always stay on `db()`

- `INSERT`, `UPDATE`, `DELETE`, and DDL, and all ORM mutators.
- Transactions that read and then write, such as check-then-insert patterns in GraphQL subscriptions.
- `begin_nested()` and SAVEPOINT usage, which appears only on write paths (bulk insertion, JWT storage, and experiment mutations).
- Authentication and token paths, which need primary consistency.
- Any read where staleness would make a just-completed action appear not to have happened.
- `GET /readyz`, which must reflect the health of the write path.
- Paths that coordinate writes, such as the disk-usage monitor that sets `should_not_insert_or_update`.

### Classify by database behavior, not by HTTP method

`POST /v1/spans` is a read-only query endpoint. `GET /oauth2/{idp_name}/tokens` writes. The HTTP method does not indicate whether a handler writes.

### Callsite categories

- **Read-routed:** GraphQL dataloaders, GraphQL query and type resolvers that query directly, bulk span, trace, and session retrieval endpoints (including `POST /v1/spans`, which backs `get_spans_dataframe()` and was the main reported source of contention), and periodic reference-data reads such as the generative model store.
- **Write-routed:** GraphQL mutations and subscriptions, bulk insertion, the facilitator, JWT storage, DML event handling, experiment runner and sweeper, retention, span cost calculation, evaluator sync, disk-usage monitoring, startup scaffolding, readiness, and authentication.
- **Candidates for later classification:** read-only endpoints with lower volume, or close to write workflows where staleness is more visible, such as dataset, prompt, project, experiment, user, and annotation-config listings and exports.

When adding a callsite, apply the four conditions above. When in doubt, use `db()`.

## Risks and mitigations

### A read-routed session performs a write

With `default_transaction_read_only=on`, PostgreSQL rejects the write with a clear error. The SQLite read engine is opened read-only, so it rejects writes too. Without the PostgreSQL setting, a misrouted write fails on a streaming replica and is rejected by an Aurora reader endpoint unless write forwarding is enabled.

Mitigations: review each read-routed callsite against the routing conditions; keep `.read()` visible at the callsite so an author adding a write sees that the session is read-routed; and rely on the database-level read-only setting as the strongest safeguard.

### The replica is unavailable

Read-path requests fail with server errors; write paths are unaffected. The operator fixes the replica, or unsets the replica URL and restarts to route all reads to the primary.

### Stale reads confuse users

Read routing is limited to bulk retrieval of historical data, where sub-second lag is not visible. Flows where a user immediately reads what they just created (projects, annotations, experiments) stay on the primary. Stickiness can be added if a routed flow shows a real problem.

### A read path later gains a write

A future change can add a write to a read-routed block without the author noticing. The visible `.read()` call and the database-level read-only setting are the main protections; the write then fails immediately rather than succeeding silently.

### Connection pool sizing

Two engines mean two pools. Operators size the replica's `max_connections` for the replica pool and tune pools through URL parameters.

## Testing

- `tests/unit/server/cli/commands/test_serve.py` (PostgreSQL only): with a replica URL, `read()` sessions use the replica and `db()` sessions use the primary, and SQL on both engines produces spans under the request span; without a replica URL, both use the primary.
- `tests/unit/server/test_telemetry.py`: the SQLite primary and read pool are instrumented independently, and a partially built primary and read-engine configuration is cleaned up when setup fails.

There are no CI integration tests that run read-routed paths against a read-only database role. The integration suite uses a random schema per test package, parallel workers, and fixed credentials, so adding a read-only role would require per-schema grants timed between migration and the first read. The accepted risk is that a misclassified callsite fails only in a deployment with a replica; `default_transaction_read_only=on` makes that failure immediate and explicit.

## Deferred and open questions

The original proposal also planned these items, which were not built:

- startup validation of the replica URL and a test connection;
- a Prometheus counter of sessions by route (read or write);
- a CI check that flags write patterns in files that use `.read()`.

Open questions:

1. Should automatic fallback to the primary be offered, and if so, opt-in or opt-out?
2. Should the replica support component-based configuration for parity with the primary?
3. Should the notebook entrypoint support a replica?
