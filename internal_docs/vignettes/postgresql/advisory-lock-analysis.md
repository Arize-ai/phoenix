# Advisory Lock Analysis

*2026-03-03*

## Table of contents

1. [Decision](#decision)
   - [Why the lock isn't needed today](#why-the-lock-isnt-needed-today)
   - [Why the PR's approach adds risk](#why-the-prs-approach-adds-risk)
   - [When to revisit](#when-to-revisit)
   - [Migration authoring guidelines](#migration-authoring-guidelines)
2. [How Alembic handles transactions](#how-alembic-handles-transactions)
   - [The two settings](#the-two-settings)
   - [Mode 1: All migrations in one transaction](#mode-1-all-migrations-in-one-transaction)
   - [Mode 2: One transaction per migration](#mode-2-one-transaction-per-migration)
   - [Mode 3: External transaction](#mode-3-external-transaction-overrides-everything)
   - [Mode 1 vs Mode 3](#mode-1-vs-mode-3)
   - [What Phoenix uses](#what-phoenix-uses)
3. [CREATE INDEX CONCURRENTLY](#create-index-concurrently)
4. [The env.py architectural lever](#the-envpy-architectural-lever)
   - [The change](#the-change)
   - [What this enables](#what-this-enables)
   - [What changes](#what-changes)
   - [Interaction with lock approaches](#interaction-with-lock-approaches)
   - [Should we change it?](#should-we-change-it)
5. [Industry precedent](#industry-precedent)
   - [Why session-level is the default](#why-session-level-is-the-industry-default-and-why-transaction-level-isnt)
   - [How other tools handle this](#how-other-tools-handle-this)
   - [Tradeoff summary](#tradeoff-summary)
   - [Implication for Phoenix](#implication-for-phoenix)
6. [Reference implementation](#reference-implementation)
   - [Transaction-level approach](#modified-run_migrations-in-envpy)
   - [Session-level alternative](#alternative-session-level-lock--phoenix_migration_database_url)
   - [Honest assessment](#honest-assessment)
7. [Schema scoping](#schema-scoping)

---

# Decision

## Why the lock isn't needed today

All existing migrations are DDL-heavy. Every `INSERT` is paired with a `CREATE TABLE` in the same `upgrade()` function. Phoenix's env.py wraps all migrations in a single outer transaction (see [How Alembic handles transactions](#how-alembic-handles-transactions)), and `CREATE TABLE` takes `ACCESS EXCLUSIVE` — which serializes concurrent execution. The second replica's `CREATE TABLE` fails, the transaction rolls back (including any DML), and on restart it sees the database is at head.

The correctness issue that advisory locks prevent — non-idempotent DML against a **pre-existing** table with no DDL in the same migration step — does not exist in this codebase. Phoenix's established pattern (create table + backfill in the same step) is structurally safe under concurrent execution.

Without the lock, concurrent startup is noisy (errors like `relation "foo" already exists`) but self-healing. For clean startup in multi-replica deployments, the standard pattern is running migrations in a Kubernetes init container or Helm pre-upgrade hook.

## Why the PR's approach adds risk

The PR used `pg_advisory_lock` (session-level), acquiring the lock outside Alembic and calling `conn.commit()` before passing the connection in. This forced session-level because a transaction-level lock would be released by that commit. An alternative — acquiring a transaction-level lock inside env.py's existing outer transaction — would avoid the risks below (see [Reference implementation](#reference-implementation)), but wasn't the approach taken.

Session-level locks are tied to the PostgreSQL backend connection, not the client connection. This breaks when those two are decoupled:

- **PgBouncer transaction mode with `DISCARD ALL` (the default):** After `conn.commit()`, PgBouncer returns the backend to its pool and runs `DISCARD ALL`, which releases the lock. The lock silently does nothing.
- **PgBouncer transaction mode without `DISCARD ALL`:** The lock persists on the idle backend in PgBouncer's pool. Other replicas block for 300s, time out, crash. The cluster is stuck for 10–60 minutes until PgBouncer closes that backend. This is a regression from the no-lock behavior.
- **OOM-kill / SIGKILL (any deployment):** If a pod is killed while holding the lock, PostgreSQL doesn't detect the dead connection until TCP keepalive fires (~6 minutes on RDS defaults, up to ~2 hours on bare-metal OS defaults). All other replicas block until then.

These risks could be mitigated with a direct connection that bypasses the pooler (the way Prisma uses `DIRECT_URL`). But Phoenix uses a single `PHOENIX_SQL_DATABASE_URL` for both runtime queries and migrations, so users behind poolers (Supabase, Neon, PgBouncer sidecars) have no way to opt into a direct connection for migrations today.

## When to revisit

Reopen this if either of the following happen:

1. **A migration adds non-idempotent DML against an existing table** — e.g., `INSERT INTO existing_table ...` without `ON CONFLICT` and without a `CREATE TABLE` in the same step. Concurrent execution would silently duplicate data.

A transaction-level lock (see [Reference implementation](#reference-implementation)) can be added without any new configuration — it works through PgBouncer as-is. A session-level lock would additionally require `PHOENIX_MIGRATION_DATABASE_URL` (a separate direct connection string, analogous to Prisma's `DIRECT_URL`) so users behind poolers can route migrations safely.

See the [Reference implementation](#reference-implementation) for how to do this, and [Industry precedent](#industry-precedent) for context on how other tools approach it.

## Migration authoring guidelines

Regardless of locking, these conventions keep migrations safe under concurrent execution:

- **Pair DML with DDL.** Inserts into newly created tables are safe — `CREATE TABLE` serializes the step.
- **Make standalone DML idempotent.** Use `INSERT ... ON CONFLICT DO NOTHING` or `WHERE NOT EXISTS` for any DML against existing tables.

---

# How Alembic handles transactions

Alembic's transaction behavior is controlled by two things: the settings passed to `context.configure()` and whether an external transaction is already open when Alembic starts. The interaction between these is subtle and directly relevant to advisory locking.

### The two settings

- **`transactional_ddl`** (default `True`): Whether the database supports DDL inside transactions. PostgreSQL does; MySQL does not. When `True`, Alembic wraps DDL in transactions. When `False`, DDL runs outside transactions (auto-committed by the database).
- **`transaction_per_migration`** (default `False`): Whether each migration step gets its own transaction or all steps share one.

### Mode 1: All migrations in one transaction (`transaction_per_migration=False`)

This is Alembic's default. All migration steps run in a single transaction. If any step fails, everything rolls back.

```
BEGIN
  ├── migration 1 (DDL/DML)
  ├── migration 2 (DDL/DML)
  ├── migration 3 (DDL/DML) ── FAIL → ROLLBACK (all 3 rolled back)
  │
  └── (or if all succeed) ─── COMMIT (all 3 committed atomically)
```

### Mode 2: One transaction per migration (`transaction_per_migration=True`)

Each migration step gets its own transaction. Steps are committed independently. If step 3 fails, steps 1 and 2 are already committed.

```
  ┌── BEGIN ── migration 1 ── COMMIT ──┐
  │                                    │
  ├── BEGIN ── migration 2 ── COMMIT ──┤  each independently committed
  │                                    │
  ├── BEGIN ── migration 3 ── FAIL ────┤  only step 3 rolls back
  │            ROLLBACK                │
  └────────────────────────────────────┘
```

**Drawbacks of Mode 2:**

- **Partial application on failure.** If migration 3 out of 5 fails, migrations 1 and 2 are already committed and cannot be rolled back. The database is in an intermediate schema state. On restart, Alembic picks up from migration 3 (since `alembic_version` was updated per-commit), but the failing migration must be idempotent enough to retry cleanly.
- **Incompatible with transaction-level advisory locks.** A `pg_advisory_xact_lock` is released when its transaction commits. In Mode 2, that means the lock is released after migration 1's `COMMIT` — the remaining migrations run unprotected. Holding a lock across the entire run requires either a session-level lock (with PgBouncer risks) or Mode 3.
- **Mid-run version visibility.** Each committed step makes its `alembic_version` update visible to other connections immediately. A concurrent process checking "am I at head?" mid-run could see a partial version and start running application code against an incomplete schema.
- **No caller-controlled injection point.** Like Mode 1, Alembic owns each per-step transaction. The caller can't inject logic (locks, session parameters) *inside* each transaction — only before or after the entire `run_migrations()` call.

Mode 2 trades atomicity for granularity. It's useful when individual migrations are large and you want to avoid holding long transactions (common in production `ALTER TABLE` scenarios). For Phoenix — where migrations run at startup before the app serves traffic — the all-or-nothing semantics of Mode 1/3 are strictly better, since a partial schema state at startup is harder to reason about than a clean rollback-and-retry.

### Mode 3: External transaction (overrides everything)

If the connection already has an open transaction when `context.configure()` is called, Alembic detects this via `connection.in_transaction()` and sets `_in_external_transaction = True` (verified in Alembic source: `alembic/runtime/migration.py` line 159). This causes **every** call to `begin_transaction()` — including the per-migration calls — to return `nullcontext()`. Alembic defers all transaction management to the caller.

`transaction_per_migration` has **no effect** in this mode — all steps run in the caller's transaction.

```
caller: connection.begin() ──► BEGIN
          │
          ├── context.configure(             MigrationContext.__init__():
          │     transaction_per_migration=     connection.in_transaction()? → Yes
          │       True,  ← IGNORED            _in_external_transaction = True
          │     ...)
          │
          ├── context.run_migrations() ───►  for each step:
          │                                    begin_transaction()
          │                                      → _in_external_transaction?
          │                                      → Yes → return nullcontext()
          │                                    run step (DDL/DML)
          │                                    (no per-step commit)
          │
caller: transaction.commit() ──► COMMIT  (all steps committed atomically)
          │
          │   (or on error:)
caller: transaction.rollback() ► ROLLBACK (all steps rolled back)
```

### Mode 1 vs Mode 3

Mode 1 and Mode 3 produce identical database behavior — all migrations run in a single transaction. The difference is **who controls the transaction**:

```
Mode 1 (Alembic controls):

  context.run_migrations()
    Alembic: BEGIN
      migration 1
      migration 2
    Alembic: COMMIT
  ← no way to inject logic inside the transaction


Mode 3 (caller controls):

  env.py: connection.begin()  ──► BEGIN
    _acquire_migration_lock()  ← caller can inject logic here
    context.run_migrations()
      migration 1
      migration 2
  env.py: transaction.commit() ──► COMMIT
```

In Mode 1, Alembic owns the transaction lifecycle. In Mode 3, the caller owns it and can inject logic before/after Alembic within the same transaction — such as acquiring an advisory lock, setting session parameters, or custom error handling. This is why Phoenix uses Mode 3: it gives env.py explicit control over the transaction, including `try`/`except`/`rollback`.

The practical consequence: Mode 3 is the prerequisite for the transaction-level advisory lock approach (acquiring `pg_advisory_xact_lock` inside the caller's transaction). Mode 1 doesn't offer a way to inject the lock inside Alembic's transaction.

### What Phoenix uses

Phoenix's `env.py` uses **Mode 3**. It calls `connection.begin()` before `context.configure()`, opening an external transaction. Even though it passes `transaction_per_migration=True`, this setting is overridden — all migrations run in the single outer transaction.

This is relevant because:

1. A `pg_advisory_xact_lock` acquired inside this outer transaction is held for the entire migration run — not released after the first step.
2. If a migration fails, all prior steps in the run are rolled back (not just the failing step).
3. The `alembic_version` table is updated per-step inside the transaction, but those updates are only visible to other connections after the final `COMMIT`.

---

# CREATE INDEX CONCURRENTLY

Phoenix's only concurrent index migration (`f1a6b2f0c9d5`) makes `CONCURRENTLY` **opt-in** via the `PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true` environment variable. By default, the index is created normally inside the transaction — fully protected by any advisory lock.

When opted in, the migration escapes env.py's transaction by calling `dbapi_conn.commit()` on the raw psycopg connection, then setting `dbapi_conn.autocommit = True`. This has two consequences for advisory locking:

- A **transaction-level** lock (`pg_advisory_xact_lock`) would be released by the `dbapi_conn.commit()` — the underlying transaction is committed before the concurrent index build starts, so the lock no longer protects it.
- A **session-level** lock (`pg_advisory_lock`) would survive the commit, but the migration itself runs outside any transaction, so a failure mid-build isn't rolled back regardless.

The `dbapi_conn.commit()` also commits all prior migrations in the same run, and `_disable_autocommit()` restores `autocommit = False` afterward. This splits the migration run into two transactions.

**When `PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true` (opt-in):**

```
connection.begin() ──► Transaction T1
                        │
                        ├── migration 1 ─────────────────── protected by xact lock
                        ├── migration 2 ─────────────────── protected by xact lock
                        ├── ...
                        ├── migration N-1 ───────────────── protected by xact lock
                        │
                        ├── migration N (concurrent index):
                        │     dbapi_conn.commit() ────────► T1 committed, xact lock released
                        │     autocommit = True
                        │     CREATE INDEX CONCURRENTLY ─── runs outside any transaction
                        │     autocommit = false
                        │
                       ╌╌╌  (implicit transaction boundary)
                        │
                        ├── migration N+1 ───────────────── Transaction T2 (NO lock)
                        ├── migration N+2 ───────────────── T2 (NO lock)
                        ├── ...
                        │
transaction.commit() ──► T2 committed
```

- **T1**: All migrations before the concurrent index. Committed by `dbapi_conn.commit()`. A `pg_advisory_xact_lock` acquired in T1 is released at this point.
- **T2**: Implicitly started by psycopg when the next migration's first SQL executes (psycopg starts an implicit transaction on the first statement after `autocommit = False`). Subsequent migrations run here **without** the advisory lock. Committed by env.py's final `transaction.commit()`.

If a migration in T2 fails, only T2 is rolled back — migrations in T1 were already committed. env.py's SQLAlchemy `transaction` object is unaware of this split (it believes one continuous transaction is open).

**When `PHOENIX_MIGRATE_INDEX_CONCURRENTLY` is unset (default):** The index is created normally inside the transaction. No transaction split occurs — the migration run behaves identically to the reference implementation diagram (single transaction, lock held throughout).

Concurrency is handled by `IF NOT EXISTS`: two replicas running the same migration simultaneously are serialized by PostgreSQL's catalog locks — one registers the index name first, the other sees it via `IF NOT EXISTS` and skips.

The real risk with `CONCURRENTLY` is crash mid-build, not concurrency: a failed build leaves an **INVALID** index in `pg_class` that `IF NOT EXISTS` silently skips on subsequent runs. The index exists by name but is not used by the query planner. This is inherent to how `CONCURRENTLY` works in PostgreSQL and is identical with or without the advisory lock. Recovery requires manual intervention:

```sql
-- Check for invalid indexes
SELECT indexrelid::regclass, indisvalid FROM pg_index WHERE NOT indisvalid;

-- Fix
DROP INDEX CONCURRENTLY IF EXISTS ix_spans_session_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_spans_session_id ...;
```

---

# The env.py architectural lever

Phoenix's env.py currently uses Mode 3 (external transaction). This is a choice, not a requirement. Switching to Mode 2 (per-migration transactions) would change the locking tradeoff landscape significantly.

### The change

Remove `connection.begin()` from env.py and let Alembic manage transactions per-step:

```python
# Current (Mode 3 — external transaction, transaction_per_migration has no effect)
def run_migrations(connection: Connection) -> None:
    transaction = connection.begin()
    try:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            transactional_ddl=True,
            transaction_per_migration=True,  # ← silently ignored
        )
        context.run_migrations()
        transaction.commit()
    except Exception:
        transaction.rollback()
        raise
    finally:
        connection.close()


# Modified (Mode 2 — Alembic manages per-migration transactions)
def run_migrations(connection: Connection) -> None:
    try:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            transactional_ddl=True,
            transaction_per_migration=True,  # ← now takes effect
        )
        context.run_migrations()
    finally:
        connection.close()
```

### What this enables

With Mode 2, a session-level lock acquired before `run_migrations()` works cleanly with no edge cases:

```
engine.connect() ──────► Connection
                          │
                          ├── pg_advisory_lock(key, schema_hash) ─── lock acquired
                          │
                          ├── run_migrations()
                          │     ├── BEGIN ── migration 1 ── COMMIT   (lock survives)
                          │     ├── BEGIN ── migration 2 ── COMMIT   (lock survives)
                          │     ├── migration N (CONCURRENTLY)       (lock survives)
                          │     ├── BEGIN ── migration N+1 ── COMMIT (lock survives)
                          │     └── ...
                          │
connection.close() ──────► lock released
```

The CONCURRENTLY problem disappears. In Mode 3, `dbapi_conn.commit()` commits the shared outer transaction and releases the xact lock. In Mode 2, there is no shared outer transaction — each migration has its own, and the session-level lock is independent of all of them.

### What changes

**Rollback behavior.** This is the main tradeoff.

```
Mode 3 (current — all-or-nothing):

  BEGIN
    migration 1 ── ok
    migration 2 ── ok
    migration 3 ── FAIL → ROLLBACK (all 3 rolled back, alembic_version unchanged)
  restart: runs all 3 again


Mode 2 (modified — partial progress):

  BEGIN ── migration 1 ── COMMIT (alembic_version updated, visible to others)
  BEGIN ── migration 2 ── COMMIT (alembic_version updated, visible to others)
  BEGIN ── migration 3 ── FAIL → ROLLBACK (only 3 rolled back)
  restart: resumes from migration 3
```

- **Mode 3**: All-or-nothing. A failure anywhere undoes everything. Clean but wasteful on restart (re-runs already-successful steps).
- **Mode 2**: Partial progress preserved. Alembic resumes from the failed step. More efficient, but the database can be in a partially-migrated state between steps.

Partial-migration visibility is the standard behavior for most migration tools (Flyway, Prisma, Django). It's not inherently dangerous — each migration step is individually self-consistent — but it's a behavior change for existing Phoenix deployments.

### Interaction with lock approaches

| | Mode 3 (current) | Mode 2 (modified) |
|---|---|---|
| Transaction-level lock | Held for entire run, but defeated by CONCURRENTLY | Not viable — released after first step |
| Session-level lock | Requires direct URL; survives CONCURRENTLY | Requires direct URL; survives CONCURRENTLY; **cleanest fit** |
| No lock | Crash-loop safe for DDL | Crash-loop safe for DDL; partial progress preserved |

Mode 2 makes the session-level lock the natural and only viable advisory lock approach. This is simpler to reason about — one approach instead of two — at the cost of requiring `PHOENIX_MIGRATION_DATABASE_URL` for users behind poolers.

### Should we change it?

Not as part of adding advisory locks. The env.py mode affects all migrations (rollback semantics, `alembic_version` visibility, error recovery) regardless of locking. It's a broader architectural decision that should be evaluated on its own merits — locking is one input, not the driver.

If we do switch to Mode 2 in the future, the session-level lock + `PHOENIX_MIGRATION_DATABASE_URL` becomes the clear choice: no CONCURRENTLY edge case, no T1/T2 split, no subtle transaction interactions. The reference implementation below (transaction-level lock in Mode 3) would no longer apply.

---

# Industry precedent

Advisory locks for migration serialization are the industry standard. There are two flavors:

- **Transaction-level** (`pg_advisory_xact_lock`): Released on `COMMIT`/`ROLLBACK`. Works through PgBouncer transaction mode because the lock lifetime is contained within a single transaction — exactly the window PgBouncer guarantees backend affinity. Waiting replicas block (not crash-loop), then check the schema history and skip completed steps. Clean.
- **Session-level** (`pg_advisory_lock`): Survives commits, released on connection close. Required when the lock must span multiple transactions — but breaks PgBouncer transaction mode because `COMMIT` causes PgBouncer to reassign the backend.

### Why session-level is the industry default (and why transaction-level isn't)

Most migration tools chose session-level locks for three reasons:

1. **Multi-transaction architecture.** Tools like Prisma perform multiple operations across a connection's lifecycle — introspect schema, diff against target, apply DDL, update version table, verify. These span multiple transactions. A transaction-level lock releases at the first `COMMIT`, leaving the remaining steps unprotected. Session-level locks survive `COMMIT` boundaries.

2. **`CREATE INDEX CONCURRENTLY` incompatibility.** This DDL statement cannot run inside a transaction. A `pg_advisory_xact_lock` is by definition inside a transaction, so they are mutually exclusive. Tools that support concurrent index creation need session-level locks (or must release the lock before the concurrent operation).

3. **Historical inertia and simplicity.** Session-level locks are straightforward: acquire once, close connection to release. Transaction-level locks require the tool to keep all protected work inside a single transaction, constraining the architecture. Most tools chose the simpler path and solve the PgBouncer problem out-of-band (e.g., Prisma's `directUrl`).

Flyway is the notable exception — it switched to transaction-level locks in 9.1.2 specifically for PgBouncer compatibility (see details below).

### How other tools handle this

- **Flyway** (verified from source) defaults to transaction-level advisory locks (`pg_try_advisory_xact_lock`) via `postgresql.transactional.lock=true`. This works because Flyway controls its own transaction lifecycle end-to-end, keeping the lock and all DDL in the same transaction — no special connection config needed for PgBouncer. Session-level locks are opt-in via `postgresql.transactional.lock=false` (needed for `CREATE INDEX CONCURRENTLY`, which can't run inside a transaction).
- **Prisma** (verified from source: `prisma-engines` `postgres.rs` line 367) uses session-level `pg_advisory_lock(72707369)` with a 10-second timeout. There is no explicit unlock — the lock is released when the connection is disposed. Prisma requires a separate `directUrl` / `DIRECT_URL` for migrations to bypass transaction-mode poolers. Users can disable locking entirely via `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK`.
- **Liquibase** (verified from docs) uses a table-based lock (`DATABASECHANGELOGLOCK`) instead of advisory locks. Works through poolers, but if a pod crashes mid-migration, the row stays locked until cleared via `liquibase release-locks` or manual `UPDATE ... SET locked = 0`.
- **Django** (verified from docs) does not lock migrations by default (relies on crash-loop recovery). Community packages like `django-pglock` provide general-purpose advisory lock primitives (not migration-specific). It defaults to session-level locks but warns about PgBouncer in its docs and offers `xact=True` for transaction-level locks as a pooler-safe alternative.

### Tradeoff summary

| | Session-level (`pg_advisory_lock`) | Transaction-level (`pg_advisory_xact_lock`) |
|---|---|---|
| Multi-transaction workflows | Works — lock survives commits | Breaks — lock released at first commit |
| `CREATE INDEX CONCURRENTLY` | Works — lock spans outside txn | Breaks — can't run inside a txn |
| PgBouncer transaction mode | Breaks — orphaned/released locks | Works — lock contained in txn window |
| Simplicity | Acquire once, close to release | Requires single-txn architecture |
| Used by | Prisma, Django (community) | Flyway (default since 9.1.2) |

### Implication for Phoenix

The PR chose session-level locks, following the Prisma pattern. It called `conn.commit()` after acquiring the lock to clear the transaction state so Alembic could manage its own transactions cleanly. (Session-level locks are unaffected by `COMMIT`/`ROLLBACK` — they persist until the session ends.)

```
engine.connect() ──────► Connection
                          │
                          ├── pg_advisory_lock(key) ─────── session lock acquired
                          ├── conn.commit() ─────────────── txn cleared (lock persists)
                          │
                          ├── command.upgrade() ──► env.py
                          │     connection.begin() ──► Transaction
                          │       ├── migration 1
                          │       ├── migration 2
                          │       ├── ...
                          │     transaction.commit()
                          │
connection.close() ──────► session lock released
```

This isn't the only option. Phoenix's env.py wraps all migrations in a single outer transaction (see [How Alembic handles transactions](#how-alembic-handles-transactions)). A transaction-level lock (`pg_advisory_xact_lock`) acquired inside that outer transaction would be held for the entire migration run and released automatically on commit — the Flyway pattern. This would work through PgBouncer without needing a separate `PHOENIX_MIGRATION_DATABASE_URL`.

If we revisit, try the transaction-level approach first — it covers all current migrations (including the index migration in its default non-concurrent mode) and is PgBouncer-safe. The one edge case is when a user opts into `PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true`, which escapes the transaction and releases the lock early. From that point the behavior falls back to unlocked — subsequent migrations rely on the authoring guidelines for safety (see [CREATE INDEX CONCURRENTLY](#create-index-concurrently) for the full analysis).

---

# Reference implementation

If we decide to add advisory locking, the most practical approach under the current env.py (Mode 3) is a transaction-level lock acquired inside the existing outer transaction (the Flyway pattern). This avoids the session-level risks described above and works through PgBouncer with no additional configuration.

```
connection.begin() ──► Transaction
                        │
                        ├── pg_advisory_xact_lock(key, schema_hash) ── lock acquired
                        │
                        ├── migration 1 ─────────────────── protected
                        ├── migration 2 ─────────────────── protected
                        ├── ...
                        ├── migration M ─────────────────── protected
                        │
transaction.commit() ──► lock released, all migrations committed atomically
```

### Modified `run_migrations()` in env.py

```python
from zlib import crc32
from sqlalchemy import Connection, text

_MIGRATION_LOCK_KEY = 0x50485801  # arbitrary, unique to Phoenix

def run_migrations(connection: Connection) -> None:
    transaction = connection.begin()
    try:
        _acquire_migration_lock(connection)
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            transactional_ddl=True,
            transaction_per_migration=True,
        )
        context.run_migrations()
        transaction.commit()
    except Exception:
        transaction.rollback()
        raise
    finally:
        connection.close()

def _acquire_migration_lock(connection: Connection) -> None:
    if connection.dialect.name != "postgresql":
        return
    schema = _get_schema() or "public"
    schema_hash = crc32(schema.encode("utf-8"))
    if schema_hash > 0x7FFFFFFF:
        schema_hash -= 0x100000000  # fit into int4
    connection.execute(
        text("SELECT pg_advisory_xact_lock(:key, :schema_hash)"),
        {"key": _MIGRATION_LOCK_KEY, "schema_hash": schema_hash},
    )
```

### What this gets right

1. **PgBouncer-safe** — the lock lifetime is contained within a single transaction, which is exactly the window PgBouncer guarantees backend affinity. No `PHOENIX_MIGRATION_DATABASE_URL` needed.
2. **OOM-kill safe** — if the process dies, PostgreSQL rolls back the transaction and releases the lock immediately (no TCP keepalive wait).
3. **Schema-scoped** — the two-argument form prevents independent deployments on different schemas from blocking each other.
4. **No-op for SQLite** — the dialect check skips locking entirely on SQLite.

### Where it falls short

The lock is defeated when a migration opts into `PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true`. The concurrent index migration calls `dbapi_conn.commit()` to escape the transaction, which releases the `pg_advisory_xact_lock` and commits all prior migrations. From that point forward, the lock is fully gone — the concurrent index build and all subsequent migrations fall back to unlocked behavior (see [CREATE INDEX CONCURRENTLY](#create-index-concurrently) for the full transaction-splitting diagram):

- The concurrent index itself is safe — `IF NOT EXISTS` handles the race.
- Subsequent DDL migrations are crash-loop safe — the second replica fails and retries.
- Subsequent non-idempotent DML against existing tables is **not safe** — the same risk as having no lock at all.

By default (without `CONCURRENTLY` opt-in), the lock covers the entire run. But the existence of the escape hatch means the lock is best-effort, not a guarantee.

### Alternative: Session-level lock + `PHOENIX_MIGRATION_DATABASE_URL`

A session-level lock (`pg_advisory_lock`) on a direct connection (bypassing the pooler) has one advantage the transaction-level approach does not: **it survives `CONCURRENTLY`**. The lock is held at the connection level, so `dbapi_conn.commit()` doesn't release it. No T1/T2 split, no defeated lock. Full coverage for all migrations.

The tradeoff is different, not strictly worse:

| | Transaction-level (above) | Session-level + direct URL |
|---|---|---|
| `CONCURRENTLY` opt-in | Defeated — lock released | Survives — lock held |
| PgBouncer | Works (no config needed) | Works (direct URL bypasses pooler) |
| OOM-kill | Safe — txn rolls back, lock released | Blocks — until TCP keepalive (~6 min RDS) |
| Config burden | None | Requires `PHOENIX_MIGRATION_DATABASE_URL` |

With a direct connection (no pooler), the OOM-kill risk is less severe than the scenarios described in the main body — other replicas simply wait on a direct connection to PostgreSQL, with no pooler backend contamination or cluster-wide deadlock. It's comparable to any other "process died holding a resource" scenario.

If full coverage matters more than zero-config, the session-level approach with a direct URL is the stronger choice.

### Honest assessment

The migration authoring guidelines (pair DML with DDL, make standalone DML idempotent) are the primary safety mechanism in all scenarios — with or without either lock approach, with or without `CONCURRENTLY`. Advisory locking adds defense-in-depth for the common case but:

- It solves a problem that doesn't currently exist (no migration has non-idempotent DML against a pre-existing table).
- The transaction-level approach is defeated in the `CONCURRENTLY` edge case, falling back to the same authoring guidelines.
- The session-level approach requires additional configuration (`PHOENIX_MIGRATION_DATABASE_URL`) and has OOM-kill exposure.
- Both approaches add code complexity that future contributors would need to understand.
- Code review is a more reliable gate for catching dangerous migrations than a runtime lock.

These implementations are here as a reference if we ever decide the defense-in-depth is worth the complexity. Neither should be shipped preemptively.

---

# Schema scoping

PostgreSQL advisory locks are database-scoped, not schema-scoped. If two independent Phoenix deployments share the same database with different schemas (via `PHOENIX_DATABASE_SCHEMA`), a naive single-key `pg_advisory_lock(key)` would cause them to serialize against each other unnecessarily — each blocking the other's migrations on startup.

This can be addressed via the two-argument form `pg_advisory_lock(key, schema_hash)`, using `crc32` of the schema name as the second argument.
