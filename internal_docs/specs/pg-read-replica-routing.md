# Design Proposal: Read Replica Support (MVP)

## Problem

Phoenix currently uses one PostgreSQL engine/pool for both reads and writes. Under high ingestion load, read-heavy work (project page aggregates, annotation-name scans, pagination and span-tree loaders) competes with writes for the same pool and primary resources.

Users have also reported that large span pull workloads reduce ingestion speed. This is consistent with shared-pool/shared-primary contention between heavy read queries and write paths.

The bottleneck is not classic lock blocking (`SELECT` vs `INSERT`) but:

- connection-pool contention
- CPU/IO/WAL contention on the primary
- cache churn on a single node

Routing read-only traffic to a replica gives pool isolation and a separate buffer cache, which should reduce user-facing latency under load.

## Goals

- Route replica-safe reads to a read replica.
- Keep all writes on primary.
- Maintain backwards compatibility for deployments without replica configuration.
- Maintain backwards compatibility for SQLite deployments (`db.read()` and `db()` resolve to same engine).

## Non-goals

- No SQL/query logic rewrite as part of this change.
- No schema changes.
- No frontend behavior change.
- No replica infrastructure management from Phoenix (provisioning, failover, WAL/slot tuning).
- No attempt to control PostgreSQL replication internals from application code.
- No replication lag monitoring, circuit breakers, or client-side health checks (operator concern).
- No session stickiness or post-write pinning (defer until proven necessary).

## Scope Boundary (Phoenix as DB client)

Phoenix is a client of primary/replica databases. The boundary is:

- **Phoenix-owned**: endpoint/session routing (`read` vs `write`), and observability.
- **Operator-owned**: replica provisioning, replication settings, lag/slot/WAL tuning, failover orchestration, server-side read-only enforcement, and replica health monitoring.
- **Contract**: Operators are expected to set `default_transaction_read_only=on` on the replica role or server as an additional safety net.

## Current Architecture

### `DbSessionFactory`

Defined in `src/phoenix/server/types.py`:

```python
class DbSessionFactory:
    def __init__(
        self,
        db: Callable[[Optional[asyncio.Lock]], AbstractAsyncContextManager[AsyncSession]],
        dialect: str,
    ):
        self._db = db
        self.dialect = SupportedSQLDialect(dialect)
        self.lock: Optional[asyncio.Lock] = None
        self.should_not_insert_or_update = False

    def __call__(self) -> AbstractAsyncContextManager[AsyncSession]:
        return self._db(self.lock)
```

### Session factory function `_db()`

Defined in `src/phoenix/server/app.py`:

```python
def _db(
    engine: AsyncEngine,
) -> Callable[[Optional[asyncio.Lock]], AbstractAsyncContextManager[AsyncSession]]:
    Session = async_sessionmaker(engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory(lock: Optional[asyncio.Lock] = None) -> AsyncIterator[AsyncSession]:
        async with contextlib.AsyncExitStack() as stack:
            if lock:
                await stack.enter_async_context(lock)
            yield await stack.enter_async_context(Session.begin())

    return factory
```

Each `async with db() as session:` block is a single transaction. `Session.begin()` starts the transaction; the connection is acquired from the pool at this point (asyncpg acquires eagerly on `begin()`).

### Construction sites

The `DbSessionFactory` is constructed in **two places**, not one:

1. **`src/phoenix/server/cli/commands/serve.py:257-266`** — the main CLI entrypoint:
   ```python
   engine = create_engine(connection_str=db_connection_str, ...)
   shutdown_callbacks.extend(instrument_engine_if_enabled(engine))
   shutdown_callbacks.append(engine.dispose)
   factory = DbSessionFactory(db=_db(engine), dialect=engine.dialect.name)
   ```

2. **`src/phoenix/session/session.py:203-213`** — the notebook/embedded entrypoint:
   ```python
   engine = create_engine(connection_str=database_url, ...)
   shutdown_callbacks.extend(instrument_engine_if_enabled(engine))
   shutdown_callbacks.append(engine.dispose)
   factory = DbSessionFactory(db=_db(engine), dialect=engine.dialect.name)
   ```

Both must be updated.

### Consumer patterns

```
DbSessionFactory
├── Context.db              → GraphQL resolvers (reads + writes via info.context.db())
├── DataLoaders             → read-heavy path, all verified read-only (self._db())
├── BulkInserter            → writes (self._db())
├── DmlEventHandler         → write-driven invalidation + annotation lookups (self._db())
├── Facilitator             → startup writes and sync (self._db())
├── JwtStore/_Store         → auth-critical mixed reads/writes (self._db())
├── Daemons                 → experiment_runner/sweeper, retention, disk monitor, model store, ...
├── REST routers            → mixed by endpoint (request.app.state.db())
└── Subscriptions           → mixed read/write flows (info.context.db())
```

### Key observations from code review

- **DataLoaders are all read-only.** All 73 dataloaders in `src/phoenix/server/api/dataloaders/` use only `session.scalar()`, `session.scalars()`, `session.stream()`, and `session.get()`. No write operations found. Each loader receives `DbSessionFactory` in its `__init__` and stores it as `self._db`, then calls `async with self._db() as session:`.

- **GraphQL query resolvers are read-only.** `src/phoenix/server/api/queries.py` and all type resolvers in `src/phoenix/server/api/types/` delegate to dataloaders or execute read-only queries.

- **GraphQL mutations clearly write.** All files in `src/phoenix/server/api/mutations/` use `session.add()`, `session.delete()`, `session.commit()`, or `session.flush()`.

- **Subscriptions mix reads and writes in single sessions.** `src/phoenix/server/api/subscriptions.py` performs read-then-write in one transaction (e.g., check-then-insert for playground project at lines 287-309, experiment creation at lines 388-499). These must stay on primary.

- **The SQLite lock is set only for SQLite** (`app.py` lifespan function). For PostgreSQL, `self.lock` is `None`, so the lock path in `_db()` is a no-op. The lock mechanism does not interact with replica routing.

- **`should_not_insert_or_update` is a write-coordination flag** checked at request boundaries (REST auth guard, GraphQL permissions, gRPC interceptor). It lives on the factory, not the session, and is only relevant to write paths. Orthogonal to replica routing.

- **Schema handling is baked into ORM metadata.** `src/phoenix/db/models.py:633-634` sets `MetaData(schema=get_env_database_schema())`. When `PHOENIX_SQL_DATABASE_SCHEMA` is set, all ORM-generated SQL uses fully-qualified table names (`schema.table`). The replica engine does not need separate `search_path` configuration — the schema is embedded in every query by the ORM. The only place `SET search_path` is called is in `src/phoenix/db/migrations/env.py:99`, which only runs during migrations (primary-only).

- **IAM auth reads from global env vars.** `aio_postgresql_engine()` calls `get_env_postgres_use_aws_iam_auth()` from global config. If the primary uses IAM auth, replica engine creation also attempts IAM auth using the same AWS credentials.

- **`/readyz` checks primary health.** `app.py:707-715` runs `select(1)` against `request.app.state.db()` (which is `__call__()` → primary). This is correct — readiness should reflect the write path. No change needed.

### Aurora write-forwarding incompatibility

The existing analysis in `internal_docs/vignettes/postgresql/aurora-write-forwarding-analysis.md` documents that Phoenix is fundamentally incompatible with Aurora write forwarding (SAVEPOINTs in bulk ingestion, DDL in migrations). The read replica URL must point to a standard streaming replica or Aurora reader endpoint — **not** an Aurora reader with write forwarding enabled. This should be documented in the configuration guide.

## Proposed Architecture

`DbSessionFactory` gains a `read()` method and a new constructor. Same class, same module, same imports.

```
DbSessionFactory
├── .__call__()  → primary engine (always, unchanged default)
├── .read()      → replica engine when configured, else primary
├── .lock        → asyncio.Lock (SQLite only)
├── .dialect     → SupportedSQLDialect
├── .should_not_insert_or_update → bool
```

### Design decisions

**`__call__()` always routes to primary.** This is the safe default. Every existing callsite uses `db()` today and expects write capability. We do not add a configurable default route — the goal is to explicitly annotate read paths with `db.read()`, not to guess. `__call__()` is the migration-compatible fallback for any callsite not yet classified.

**`read()` falls back to primary when no replica is configured.** This means callsites can be annotated with `db.read()` immediately, even in deployments without a replica. The annotation is a routing hint; when no replica exists, it's a no-op.

**No automatic fallback on replica failure.** If the replica is configured but unreachable, read-path requests will fail with errors. The operator's remediation is to fix the replica or remove the env var and restart. See "Why no automatic fallback" below.

**No separate lock for the replica engine.** The lock exists only for SQLite concurrency. For PostgreSQL (the only dialect where replicas are relevant), the lock is always `None`. No new lock coordination is needed.

**The replica engine skips migrations.** Only the primary engine runs Alembic migrations. The replica engine is created with `migrate=False` to avoid attempting DDL on a read-only connection.

### Why no automatic fallback

We considered catching connection errors in `read()` and retrying on primary. This is more complex than it appears:

1. **Error timing is unpredictable.** SQLAlchemy with asyncpg acquires connections eagerly on `Session.begin()`, so connection-refused errors surface at context manager entry. But stale-connection errors (replica went down after pool creation) may surface mid-query, after the session has already been yielded. A fallback wrapper cannot re-yield a different session mid-transaction.

2. **Context manager yield semantics.** An `@asynccontextmanager` can only `yield` once. To fall back, we'd need to catch errors at `__aenter__` time (before yield) and swap the underlying session. This handles pool-empty and connection-refused but not mid-query failures on stale connections.

3. **Silent fallback masks infrastructure problems.** If reads silently fall back to primary, the operator loses the pool isolation benefit without any signal. The system "works" but the replica is doing nothing, and the primary is still overloaded.

4. **Operational remediation is simple.** Remove `PHOENIX_SQL_DATABASE_READ_REPLICA_URL` from the environment and restart. This is a standard infrastructure runbook step.

For MVP, we choose explicit failure over silent degradation. If operators need automatic fallback, it can be added as a wrapper around `read()` in a later phase, scoped to `__aenter__`-time errors only.

## Configuration

One new environment variable:

```
PHOENIX_SQL_DATABASE_READ_REPLICA_URL=postgresql://user:pass@replica-host:5432/phoenix
```

When this is set and the primary dialect is PostgreSQL, a second async engine is created for read routing. When unset, `read()` falls back to primary.

### Naming rationale

The `PHOENIX_SQL_DATABASE_` prefix matches the existing `PHOENIX_SQL_DATABASE_URL` and `PHOENIX_SQL_DATABASE_SCHEMA`. We use `READ_REPLICA_URL` rather than `REPLICA_URL` to make the intent explicit — this is for read routing, not a generic secondary.

### Component-based alternative

Phoenix also supports component-based PostgreSQL configuration (`PHOENIX_POSTGRES_HOST`, `PHOENIX_POSTGRES_PORT`, etc.). For consistency, we could add `PHOENIX_POSTGRES_REPLICA_HOST`, `PHOENIX_POSTGRES_REPLICA_PORT`, etc. However, for MVP a single URL variable is sufficient. Component-based configuration can be added later if operators request it.

### IAM auth interaction

`aio_postgresql_engine()` reads `PHOENIX_POSTGRES_USE_AWS_IAM_AUTH` from global config. When IAM auth is enabled, the replica engine also uses IAM auth with the same credentials. This is correct for AWS Aurora/RDS where the same IAM policy grants access to both writer and reader endpoints, and the IAM user is present on both. For non-AWS setups, the replica URL should include credentials directly.

### What we do not add

- No `DEFAULT_SESSION_ROUTE` flag — `__call__()` always routes to primary.
- No `FALLBACK_TO_PRIMARY` flag — no automatic fallback for MVP.
- No `MAX_LAG_SECONDS` or health check config — lag monitoring is an operator concern.
- No `POST_WRITE_STICKINESS_SECONDS` — defer until a concrete use case demands it.

Adding configuration creates a test matrix. Each flag doubles the number of deployment configurations we must reason about. For MVP, we pick the safe defaults and add knobs only when operators demonstrate they need different behavior.

### Startup validation

At startup, if `PHOENIX_SQL_DATABASE_READ_REPLICA_URL` is set:

- Validate the URL parses as a PostgreSQL connection string (fail fast on typos).
- Validate the primary dialect is PostgreSQL (replica routing is meaningless for SQLite; log a warning and ignore the env var).
- Attempt a test connection to the replica (`select(1)`) and log success/failure. Failure is a warning, not a fatal error — the operator may be starting Phoenix before the replica is ready.

## `DbSessionFactory` Changes

Add `read()` and change the constructor. Same class, same module, same name.

```python
class DbSessionFactory:
    def __init__(
        self,
        db: Callable[[Optional[asyncio.Lock]], AbstractAsyncContextManager[AsyncSession]],
        dialect: str,
        read_db: Optional[Callable[[Optional[asyncio.Lock]], AbstractAsyncContextManager[AsyncSession]]] = None,
    ):
        self._db = db
        self._read_db = read_db or db
        self.dialect = SupportedSQLDialect(dialect)
        self.lock: Optional[asyncio.Lock] = None
        self.should_not_insert_or_update = False

    def __call__(self) -> AbstractAsyncContextManager[AsyncSession]:
        return self._db(self.lock)

    def read(self) -> AbstractAsyncContextManager[AsyncSession]:
        return self._read_db(self.lock)
```

### What changes

- **Constructor:** `db` param is unchanged; new optional `read_db` param added. Only the two construction sites (`serve.py`, `session.py`) call the constructor.
- **New method:** `read()` routes to replica engine when configured, else primary.
- **`__call__()` is unchanged.** `db()` continues to route to primary.

### What doesn't change

- Class name, module, imports — all identical.
- `read_db` defaults to `db`, so without a replica configured, `read()` and `__call__()` are identical. SQLite deployments are unaffected.
- `.lock`, `.dialect`, `.should_not_insert_or_update` — all unchanged.

## Engine Wiring

In `serve.py` (and `session.py`), engine creation changes from:

```python
engine = create_engine(connection_str=db_connection_str, migrate=True, ...)
shutdown_callbacks.extend(instrument_engine_if_enabled(engine))
shutdown_callbacks.append(engine.dispose)
factory = DbSessionFactory(db=_db(engine), dialect=engine.dialect.name)
```

To:

```python
primary_engine = create_engine(connection_str=db_connection_str, migrate=True, ...)
shutdown_callbacks.extend(instrument_engine_if_enabled(primary_engine))
shutdown_callbacks.append(primary_engine.dispose)

replica_engine = None
replica_url = get_env_read_replica_url()  # new config function
if replica_url and SupportedSQLDialect(primary_engine.dialect.name) is SupportedSQLDialect.POSTGRESQL:
    replica_engine = create_engine(connection_str=replica_url, migrate=False, ...)
    shutdown_callbacks.extend(instrument_engine_if_enabled(replica_engine))
    shutdown_callbacks.append(replica_engine.dispose)

factory = DbSessionFactory(
    db=_db(primary_engine),
    read_db=_db(replica_engine) if replica_engine else None,
    dialect=primary_engine.dialect.name,
)
```

### `create_engine` with `migrate=False`

When `migrate=False`, `aio_postgresql_engine()` (`engines.py:201-202`) returns the configured engine immediately without creating a migration engine or running Alembic. The engine is otherwise identical to the primary engine — same connection args, same SSL config, same JSON serializer, same IAM auth handling.

### Schema handling

No special schema configuration is needed for the replica engine. Phoenix sets the schema at the ORM metadata level (`models.py:634: MetaData(schema=get_env_database_schema())`), which causes SQLAlchemy to emit fully-qualified table names in all generated SQL. The only `SET search_path` call is in the migration runner (`migrations/env.py:99`), which doesn't run on the replica (`migrate=False`).

### Considerations

- **Both engines must be disposed on shutdown.** Add `replica_engine.dispose` to shutdown callbacks alongside primary. The current shutdown pattern in the lifespan function (`app.py:695-697`) iterates all callbacks.

- **Both engines must be instrumented.** `instrument_engine_if_enabled()` (`app.py:960+`) attaches OpenTelemetry tracing to the engine. Call it for the replica engine too, so query telemetry covers both pools. The returned cleanup callbacks must also be registered for shutdown.

- **Pool sizing.** Each engine gets its own SQLAlchemy connection pool (default: `QueuePool` with `pool_size=5`, `max_overflow=10`). Two engines means up to 30 connections total (15 per engine) by default. Operators can tune per-engine via URL parameters (e.g., `?pool_size=10&max_overflow=20`). Document that total max connections = primary pool + replica pool.

- **`_db()` factory function is reusable as-is.** It takes an engine and returns a session factory callable. No changes needed.

- **`session.py` (notebook entrypoint) likely does not need replica support.** The notebook entrypoint is for local development (usually SQLite). But for consistency, it should accept the same `db`/`read_db` constructor. If `PHOENIX_SQL_DATABASE_READ_REPLICA_URL` is set in a notebook environment, it will work; if not, it's a no-op.

## Routing Policy

Base rule: if a session may mutate data at any point in the transaction, use `db()` (the default write path).

### What makes a callsite safe for `db.read()`

All four conditions must hold:

1. The entire `async with db.read() as session:` block uses only read operations: `session.scalar()`, `session.scalars()`, `session.stream()`, `session.get()`, `session.execute(select(...))`, `session.connection().run_sync()` with read-only SQL.
2. No ORM mutation methods: no `session.add()`, `session.add_all()`, `session.delete()`, `session.flush()`, `session.commit()` with dirty state.
3. No helper functions called within the block that perform writes (e.g., `insert_on_conflict`, upsert helpers).
4. The callsite tolerates eventual consistency (replica lag is typically sub-second but unbounded).

### What must stay on `db()` (primary)

- All `INSERT`, `UPDATE`, `DELETE`, DDL.
- All ORM mutators.
- Mixed read-then-write transactions (e.g., check-then-insert patterns in `subscriptions.py:287-309`).
- Auth/token paths — correctness requires primary consistency.
- Any path that reads data that was just written in a prior request and where staleness would cause user-visible incorrectness.
- `begin_nested()` / SAVEPOINT usage (only present in write paths: `bulk_inserter.py`, `insertion/types.py`, `jwt_store.py`, `experiment_mutations.py`).

### Why transport method is insufficient

`POST /v1/spans` is read-only (it's a query DSL endpoint). `GET /oauth2/{idp_name}/tokens` performs writes. Classify by DB behavior, not HTTP method.

## Callsite Migration: What Changes and What Doesn't

### Callsites to annotate with `db.read()` (MVP scope)

These are the highest-value, lowest-risk candidates — high query volume, verified read-only, and tolerant of eventual consistency.

#### GraphQL DataLoaders

All 73 dataloaders are verified read-only. They are the highest-volume read path (batched queries for every GraphQL field resolution).

**Current wiring:** In `app.py:762+`, `get_context()` constructs each DataLoader with the full factory:

```python
DataLoaders(
    span_by_id=SpanByIdDataLoader(db),
    project_by_name=ProjectByNameDataLoader(db),
    # ... 70+ more ...
)
```

Each loader stores `self._db = db` (typed as `DbSessionFactory`) and calls `async with self._db() as session:`.

**Migration approach:** Each loader changes its internal call from `self._db()` to `self._db.read()`:

```python
# Before (in each DataLoader's _load_fn):
async with self._db() as session:
    ...

# After:
async with self._db.read() as session:
    ...
```

**No type hint changes needed.** DataLoaders already type-hint their parameter as `db: DbSessionFactory`. The class now has `read()`, so calling `self._db.read()` is type-safe.

**Diff size:** Each of the 73 loader files changes one line (`self._db()` → `self._db.read()`). Mechanical search-and-replace.

#### GraphQL query resolvers

Some type resolvers in `src/phoenix/server/api/types/` call `info.context.db()` directly (not through a DataLoader). These should be changed to `info.context.db.read()`.

To find these: grep for `info.context.db()` in `src/phoenix/server/api/types/` and `src/phoenix/server/api/queries.py`. Each callsite should be verified as read-only before changing.

#### REST read-only endpoints (Tier 1)

Each endpoint verified as read-only by code review (no `session.add`, `session.delete`, `session.flush`, `session.commit`, or write SQL):

| Endpoint | Handler location | Verification |
|---|---|---|
| `POST /v1/spans` (query DSL) | `routers/v1/spans.py:459-529` | `session.run_sync(query)` — read-only pandas/Arrow |
| `GET /v1/projects/{id}/spans` | `routers/v1/spans.py:761-940` | `session.stream(stmt)` — cursor pagination |
| `GET /v1/projects/{id}/spans/otlpv1` | `routers/v1/spans.py` | Same pattern as above, OTLP format |
| `GET /v1/projects/{id}/traces` | `routers/v1/traces.py:91-249` | `session.scalars()`, `session.execute()` |
| `GET /v1/projects/{id}/sessions` | `routers/v1/sessions.py:278-354` | `session.scalars()` + batch trace load |
| `GET /v1/sessions/{id}` | `routers/v1/sessions.py:145-166` | `session.get()`, `session.scalars()` |
| `GET /v1/projects/{id}/span_annotations` | `routers/v1/span_annotations.py` | Read-only pagination |
| `GET /v1/projects/{id}/trace_annotations` | `routers/v1/trace_annotations.py` | Read-only pagination |
| `GET /v1/projects/{id}/session_annotations` | `routers/v1/session_annotations.py` | Read-only pagination |

These endpoints use `request.app.state.db()` — change to `request.app.state.db.read()`.

**Note:** `POST /v1/spans` is the highest-value target. This is the endpoint behind `get_spans_dataframe()` in the Phoenix client, and large span-pull workloads via this endpoint are the primary user-reported contention source.

#### Background daemon (single candidate)

- `src/phoenix/server/daemons/generative_model_store.py` — periodic reference-data reads. Change `self._db()` to `self._db.read()`. The daemon already receives `DbSessionFactory` — it just needs to call a different method.

### Callsites that stay on `db()` (no change needed for MVP)

These currently use `db()` which routes to primary. No change needed:

- All GraphQL mutations in `src/phoenix/server/api/mutations/`
- `src/phoenix/server/api/subscriptions.py` (mixed read/write in single transactions)
- `src/phoenix/db/bulk_inserter.py` (uses `begin_nested()` / SAVEPOINTs)
- `src/phoenix/db/insertion/types.py` (batch insert with SAVEPOINT fallback)
- `src/phoenix/db/facilitator.py`
- `src/phoenix/server/jwt_store.py` (uses `begin_nested()`)
- `src/phoenix/server/dml_event_handler.py`
- `src/phoenix/server/daemons/experiment_runner.py` (claim/heartbeat/persist — writes)
- `src/phoenix/server/daemons/experiment_sweeper.py`
- `src/phoenix/server/retention.py`
- `src/phoenix/server/daemons/span_cost_calculator.py`
- `src/phoenix/server/api/builtin_evaluator_sync.py`
- `src/phoenix/server/daemons/db_disk_usage_monitor.py` (controls insertion-blocking flag; must reflect primary)
- `src/phoenix/server/app.py::Scaffolder` (startup read + write)
- `GET /readyz` (must reflect primary write-path health)
- `GET /oauth2/{idp_name}/tokens` (user/token creation)
- All `/auth/*` endpoints

### Callsites to defer (classify later, after MVP)

These are read-only but lower volume or adjacent to write workflows where staleness is more visible:

- Dataset read/export endpoints (`/v1/datasets*`, CSV/JSONL downloads)
- Prompt/project listing endpoints (`/v1/prompts*`, `/v1/projects*`)
- Experiment read/export endpoints (`/v1/experiments*`)
- `GET /v1/users`, `GET /v1/user`
- `GET /v1/annotation_configs`, `GET /v1/annotation_configs/{id}`

No urgency — these can be migrated after MVP proves stable.

## Risks and Mitigations

### Risk: Accidental write on replica session

A callsite annotated `db.read()` that actually performs a write will fail at runtime with a PostgreSQL read-only transaction error (if the operator has set `default_transaction_read_only=on` on the replica) or with a replication conflict/error from the streaming replica itself.

**Mitigation (defense in depth):**
1. **Code review** — all Tier 1 callsites are verified read-only (see table above).
2. **Write-path lint** — CI grep check flags write patterns in files that use `db.read()`.
3. **Operator configuration** — `default_transaction_read_only=on` on the replica role/server provides database-level enforcement. This is the strongest guardrail — it catches misroutes that code review and lint cannot.

**Residual risk:** If the operator doesn't set read-only mode on a writable standby, and Phoenix misroutes a write, the write could succeed on the standby. On a standard streaming replica, this would cause a replication conflict (the replica would be promoted to a standalone instance or the write would be rejected). On Aurora reader endpoints, writes are rejected by default unless write forwarding is explicitly enabled. The risk is low but should be documented.

### Risk: Replica unavailable

The replica engine's connection pool fails to connect or returns stale connections.

**Behavior:** Read-path requests fail with a 500 error. Write-path requests are unaffected.

**Operator remediation:**
1. Fix the replica (restart, check replication lag, check network).
2. Or: remove `PHOENIX_SQL_DATABASE_READ_REPLICA_URL` and restart Phoenix to route all reads to primary.

**Why not automatic fallback:** See "Why no automatic fallback" above. Automatic fallback is complex and masks infrastructure problems. We may add opt-in fallback in a future phase if operators demonstrate need.

### Risk: Stale reads cause user-visible confusion

User creates a project, immediately navigates to the project page, and the project doesn't appear because the replica hasn't caught up.

**Assessment:** For MVP, this risk is mitigated by scope. Tier 1 covers bulk data retrieval (spans, traces, sessions) where sub-second staleness is invisible — users are querying historical data, not data they just created. The highest-risk flows (project creation, annotation creation, experiment creation) are not routed to replica in MVP. If staleness becomes a problem in Tier 2 flows, we can add request-level stickiness at that point — but we should not build it speculatively.

### Risk: Mixed read/write transaction misclassified

A callsite that currently only reads could be modified in a future PR to also write, without the author realizing it's on the read path.

**Mitigation:**
1. **CI lint** — a grep-based check flags write patterns (`session.add`, `session.delete`, `session.flush`, `session.commit`, `insert(`, `update(`, `delete(`) in files/functions that use `db.read()`. Simple shell script, not a custom static analyzer. Catches common cases cheaply.
2. **Explicit call-site signal** — code that reads uses `db.read()`, code that writes uses `db()`. A developer adding a write to a DataLoader will see `self._db.read()` and understand the session is read-routed. The `.read()` call is a visible marker in code review.
3. **Runtime failure** — if the replica has `default_transaction_read_only=on`, the write fails immediately with a clear error, rather than silently succeeding.

### Risk: Connection pool sizing

Two engines means two pools. Default total max connections = 30 (15 per engine: `pool_size=5` + `max_overflow=10`).

**Assessment:** For most deployments, this is fine. Document that operators should size `max_connections` on the replica to accommodate the additional pool. Pool parameters can be tuned per-engine via URL query parameters without any application code change.

### Risk: `session.py` (notebook) entrypoint divergence

The notebook entrypoint mirrors the CLI entrypoint's engine setup. If only one is updated, the constructor signature mismatch will cause a runtime error.

**Mitigation:** Both sites are updated in Phase 1. The test suite covers both entrypoints.

## Migration Plan

### Phase 1: Add API surface (no routing change)

1. Update `DbSessionFactory` in `src/phoenix/server/types.py`: add optional `read_db` param to constructor, add `read()` method.
2. Update both construction sites (`serve.py`, `session.py`) to pass `read_db=...` when a replica is configured.
4. Create replica engine from `PHOENIX_SQL_DATABASE_READ_REPLICA_URL` when available.
5. Instrument and register disposal for replica engine.
6. Add startup validation (URL parse check, dialect check, optional test connection).
7. Keep `__call__()` routing to primary. `read()` exists but nothing calls it. All behavior is unchanged.
8. Add `get_env_read_replica_url()` to `config.py` with docstring following existing env var conventions.
9. `should_not_insert_or_update` is already on the class. No consumer changes needed.

**Verification:** All existing tests pass. No callsites use `read()` yet. The replica engine exists but is unused.

### Phase 2: Annotate Tier 1 read paths

1. Update DataLoader `_load_fn` methods to call `self._db.read()` instead of `self._db()`.
2. Update GraphQL type resolvers that call `info.context.db()` to call `info.context.db.read()`.
3. Update Tier 1 REST endpoints to use `request.app.state.db.read()`.
4. Update `generative_model_store.py` to use `self._db.read()`.
5. Add session route counter metric (read vs write).

**Verification:** Unit tests pass for routing logic. Write-path lint passes. Manual test confirms Tier 1 endpoints work end-to-end with a replica URL.

### Phase 3: Stabilize and extend

1. Monitor read/write route metrics in production deployments.
2. Migrate Tier 2 endpoints based on operator feedback.
3. Add configuration knobs (strict failure mode, automatic fallback, stickiness) only if concrete production issues demand them.

### Gate between Phase 1 and Phase 2

Before enabling read routing in production:
- Unit tests pass for `DbSessionFactory` routing logic.
- Write-path lint passes (no write patterns in files using `.read()`).
- Manual review confirms no write operations in Tier 1 callsites (already done; see verification table).
- Manual test: start Phoenix with replica URL pointing to a valid read-only endpoint; confirm Tier 1 queries succeed and write paths are unaffected.
- Manual test: start Phoenix with replica URL pointing to an unreachable host; confirm read paths fail with clear errors and write paths are unaffected.

## Testing Strategy

### Unit tests

- `DbSessionFactory` with both engines: `read()` returns replica session, `__call__()` returns primary session.
- `DbSessionFactory` with `read_db=None`: `read()` falls back to primary (same session as `__call__()`).
- `__call__()` always returns primary session regardless of `read_db`.
- `read()` method works correctly with both engines and with `read_db=None` fallback.

### Write-path lint

A CI script that:

1. Identifies files containing `.read()` session calls (e.g., `self._db.read()`, `db.read()`, `request.app.state.db.read()`).
2. Greps those files for write patterns: `session\.add`, `session\.delete`, `session\.flush`, `\.commit\(`, `\binsert\(`, `\bupdate\(`, `\bdelete\(`.
3. Fails if any matches are found.

This won't catch writes via helper functions, but it catches the common patterns cheaply.

### Why no CI integration tests for routing

The existing integration test infrastructure uses random schemas per test package, 16 parallel workers, and hardcoded credentials (`tests/integration/conftest.py:88`). Adding a read-only DB role requires dynamic per-schema grants timed between migration completion and first read query — non-trivial fixture changes for the MVP scope.

**Accepted risk:** Without integration tests exercising `db.read()` paths against a read-only database, a misclassified callsite (one that actually writes despite our review) will only fail when an operator deploys Phoenix with a replica configured. The affected endpoint would return 500 errors in production until the callsite is reclassified to `db()`. This risk is limited to Tier 1 endpoints, all of which have been verified as structurally simple read-only queries (SELECT with pagination, no conditional writes or helper-function side effects).

**Why we accept it:** The alternative (retrofitting the test infrastructure) is disproportionate to the risk. The stronger guardrail is `default_transaction_read_only=on` on the replica — a Postgres-level enforcement that rejects any write with `ERROR: cannot execute INSERT in a read-only transaction`. This catches misroutes in production immediately with a clear error, and covers cases that CI can't (e.g., writes via dynamic dispatch or helper functions). We strongly recommend this setting in the operator documentation.

Integration tests for routing can be added later if a misroute occurs in practice.

## Observability (MVP)

- **Session route counter:** Increment a Prometheus counter on each `db.read()` or `db()` call, tagged by route. This tells operators how traffic splits between primary and replica.
- **Structured log on startup:** Log the replica engine URL (password-hidden) at INFO level when the replica engine is created, so operators can confirm configuration.
- **Standard SQLAlchemy pool metrics:** If `instrument_engine_if_enabled` is called on both engines, existing pool telemetry (checkout time, pool size, overflow) automatically covers the replica pool.

Defer until post-MVP: per-endpoint latency histograms by route, fallback counters (when fallback is added), lag tracking.

## Open Questions

1. Should we eventually offer automatic fallback to primary on replica failure? If so, should it be opt-in or opt-out?
2. Should we add component-based replica configuration (`PHOENIX_POSTGRES_REPLICA_HOST`, etc.) for parity with primary config?
3. Should the write-path lint be a pre-commit hook or a CI-only check?

## What This Does Not Change

- No query semantics changes.
- No schema changes.
- No SQLite behavior change (`db.read()` and `db()` resolve to same engine).
- No change to `should_not_insert_or_update` behavior (write-coordination flag, orthogonal to replica routing).
- No change to the `lock` mechanism (SQLite-only; replicas are PostgreSQL-only).
- No change to `/readyz` (already checks primary via `__call__()`).
- No change to gRPC ingestion paths (all writes, all on primary).
