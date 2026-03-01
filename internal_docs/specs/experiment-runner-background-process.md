# Experiment Runner Background Process

## Table of Contents

| # | Section | Focus |
|---|---------|-------|
| 1 | [Executive Summary](#executive-summary) | What we built |
| 2 | [Architecture](#architecture) | Three concepts, data flow |
| 3 | [Data Model](#data-model) | Schema and state machine |
| 4 | [Core Components](#core-components) | ExperimentRunner, RunningExperiment, Jobs |
| 5 | [Design Decisions](#design-decisions) | Major design choices and rationale |
| 6 | [Lifecycle](#lifecycle) | Start, stop, resume, complete |
| 7 | [Multi-Replica Coordination](#multi-replica-coordination) | Heartbeat, ownership |
| 8 | [Error Handling](#error-handling) | Retries, failures, circuit breaker |
| — | [Appendix: Key Constants](#appendix-key-constants) | Configuration values |
| — | [Appendix: Related Documents](#appendix-related-documents) | Deep dives and references |

---

## Executive Summary

### What We Built

A background experiment runner that:

- **Survives UI disconnection** — Experiments continue when browser closes
- **Recovers from crashes** — Orphaned experiments resume on server restart
- **Schedules fairly** — Round-robin dispatch across concurrent experiments
- **Respects rate limits** — Adaptive token buckets, non-blocking checks
- **Supports stop/resume** — User can stop mid-experiment and resume later
- **Coordinates across replicas** — Heartbeat-based ownership for PostgreSQL deployments

### Key Files

| File | Purpose |
|------|---------|
| `src/phoenix/server/daemons/experiment_runner.py` | Core implementation |
| `src/phoenix/db/models.py` (ExperimentExecutionConfig) | Schema |
| `src/phoenix/server/api/mutations/experiment_mutations.py` | GraphQL mutations |

---

## Architecture

### Three Concepts

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   ExperimentRunner (Daemon Singleton)                                           │
│   ═══════════════════════════════════                                           │
│   • Experiment registry (_experiments dict)                                     │
│   • Fair dispatch (round-robin by last_served_at)                               │
│   • Concurrency control (semaphore, MAX_CONCURRENT=20)                          │
│   • Heartbeat loop (refresh claimed_at every 5 minutes)                         │
│   • Orphan recovery on startup                                                  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   RunningExperiment (N instances, in-memory while running)                      │
│   ════════════════════════════════════════════════════════                      │
│   • Task queue (paginated from DB, batch_size=10)                               │
│   • Eval queue (from completed tasks, higher priority)                          │
│   • Retry heap (with exponential backoff)                                       │
│   • In-flight tracking                                                          │
│   • Rate limit check (queries shared token bucket)                              │
│   • UI subscriber management                                                    │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Jobs (transient, self-executing)                                              │
│   ════════════════════════════════                                              │
│   • TaskJob: One dataset example × one repetition (streams to UI)               │
│   • EvalJob: One experiment run × one evaluator (no streaming)                  │
│   • Carries: data + RunningExperiment reference + cancel_scope                  │
│   • execute(): Makes LLM call, reports results to RunningExperiment             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
                       ┌─────────────────┐
                       │  Token Bucket   │
                       │  (per provider) │
                       └────────▲────────┘
                                │ check capacity
                                │
┌─────────────┐        ┌────────┴────┐  try_get_ready_job()  ┌──────────────┐
│ Subscribers │ stream │   Running   │◄──────────────────────│  Experiment  │
│    (UI)     │◄───────│  Experiment │                       │    Runner    │
└─────────────┘        │             │──────────────────────▶│   (daemon)   │
                       └──────▲──────┘        Job            └──────┬───────┘
                              │                                     │
                              │ reports results                     │ job.execute()
                              │ (success/rate_limit/                ▼
                              │  network_error/timeout)      ┌─────────────┐  request   ┌─────────────┐
                              └──────────────────────────────│    Job      │───────────▶│   LLM API   │
                                                             │ (TaskJob/   │◀───────────│             │
                                                             │  EvalJob)   │  response  └─────────────┘
                                                             └─────────────┘

Semaphore flow (MAX_CONCURRENT=20):
  1. Runner acquires semaphore slot
  2. Runner gets Job from RunningExperiment.try_get_ready_job()
  3. Runner spawns task: job.execute() → LLM API → reports to RunningExperiment → release semaphore
```

---

## Data Model

### ExperimentExecutionConfig Table

| Column | Type | Purpose |
|--------|------|---------|
| `experiment_id` | int (PK) | 1:1 relationship with experiment |
| `task_config` | JSON | Task configuration (prompt, model, etc.) |
| `evaluator_configs` | JSON | List of evaluator configurations |
| `claimed_at` | datetime? | Non-null = running; null = not running |
| `claimed_by` | string? | Replica ID that owns this experiment |
| `toggled_at` | datetime? | Last user stop/resume toggle (for cooldown) |
| `last_error` | string? | Error message for UI display |
| `created_at` | datetime | When config was created |

**Nuances**:
- `claimed_at` is the source of truth for running state—no separate `status` enum needed
- `toggled_at` is only set on user-initiated stop/resume, NOT on initial start or orphan recovery (so first stop isn't blocked by cooldown)
- `claimed_by` uses `token_hex(8)` to generate a unique replica ID per server instance

### State Machine

Running state is derived from `claimed_at`:

```
        ┌─────────────────┐
        │ claimed_at=NULL │  ← initial state (not running)
        └────────┬────────┘
                 │ start_experiment() / resume
                 ▼
        ┌─────────────────┐
        │ claimed_at=now  │  (running, heartbeat updates this)
        └────────┬────────┘
                 │ stop / complete / error
                 ▼
        ┌─────────────────┐
        │ claimed_at=NULL │  (check last_error for failure)
        └─────────────────┘
```

**Key insight**: "Completeness" is derived by querying for incomplete work. If none exists, experiment is done. No explicit `completed` state.

### What's NOT Stored (and Why)

| Field | Why Not Stored |
|-------|----------------|
| `pending_task_ids` | Query incomplete runs from DB on resume |
| `pending_eval_ids` | Evals are generated dynamically from completed tasks |
| `retry_queue` | Rebuilt from incomplete runs on resume |
| `used_browser_credentials` | All credentials are ephemeral for security |

**Key insight**: Resume queries incomplete runs fresh from the database. No queue state serialization needed—this dramatically simplifies crash recovery.

---

## Core Components

### ExperimentRunner (Daemon)

**What it does**: Singleton daemon that manages all running experiments. Runs as a background task for the lifetime of the server.

**Responsibilities**:
1. **Experiment registry** — In-memory dict mapping experiment_id → RunningExperiment
2. **Fair scheduling** — Round-robin dispatch ordered by `last_served_at` timestamp
3. **Concurrency control** — Semaphore limits total in-flight jobs across all experiments
4. **Heartbeat** — Periodically refreshes ownership claims in the database
5. **Orphan recovery** — On startup (and periodically), claims experiments with stale claims

**Main loop behavior**:
1. If no experiments registered, sleep until work arrives (event-driven, not polling)
2. Acquire a semaphore slot (blocks if at max concurrency)
3. Round-robin through experiments to find one with a ready job
4. Spawn the job execution as a concurrent task
5. On completion, callbacks update experiment state and release the semaphore

**Nuance**: The semaphore is acquired *before* finding a job. If no job is ready (all rate-limited), release the semaphore and sleep briefly before retrying.

### RunningExperiment

**What it does**: In-memory representation of a single running experiment. Exists only while the experiment is actively running on this replica.

**Responsibilities**:
1. **Queue management** — Task queue, eval queue, retry heap (priority: evals > retries > tasks)
2. **Rate limit gating** — Checks token bucket *before* returning a job to the daemon
3. **Callback handling** — Processes job outcomes (success, failure, rate limit, timeout)
4. **UI streaming** — Maintains subscriber list for real-time chunk streaming
5. **Completion detection** — When all queues empty and no more work in DB, signals done

**Queue priority** (highest to lowest):
1. **Eval queue** — Evaluations for completed tasks (fast, maintains flow)
2. **Retry heap** — Jobs ready for retry (sorted by `ready_at` timestamp)
3. **Task queue** — New tasks from dataset (paginated from DB in batches of 10)

**Nuance**: Tasks are loaded from the database in batches to avoid memory exhaustion on large datasets. The `_task_db_exhausted` flag tracks when all tasks have been loaded.

### Jobs (TaskJob / EvalJob)

**What they do**: Self-contained work units that execute LLM calls and invoke callbacks.

| Job Type | Purpose | Streams to UI? |
|----------|---------|----------------|
| TaskJob | Run prompt against one dataset example × one repetition | Yes |
| EvalJob | Run one evaluator against one experiment run | No |

**Job lifecycle**:
1. Created with all data needed for execution (no external lookups during execute)
2. Holds a reference to the parent RunningExperiment for reporting results
3. Executes within a cancel scope (for clean cancellation on stop)
4. Calls appropriate method on RunningExperiment based on outcome (success, rate limit, network error, timeout, permanent failure)

**Nuances**:
- Jobs are stateless—all context is passed at construction time
- The `retry_count` field tracks how many times this job has been retried
- Jobs carry their own timeout (default 120s) for hanging LLM calls
- DB writes within jobs are shielded from cancellation to prevent connection pool corruption

---

## Design Decisions

### Advisor Pattern for Rate Limiting

**Context**: Jobs need rate limit checks before making LLM calls. Two approaches:
- **Gatekeeper**: Job checks rate limit inside `execute()`, blocks or fails if limited
- **Advisor**: Experiment checks rate limit before returning job to daemon

**Decision**: Use the Advisor pattern—check capacity in `try_get_ready_job()` before popping a job.

**Consequences**:
- ✅ Daemon never blocks waiting for rate limits
- ✅ Round-robin fairness preserved—rate-limited experiments are skipped, others proceed
- ✅ No wasted semaphore slots on rate-limited jobs
- ⚠️ Rate limit key must be determinable without executing the job
- ⚠️ Token bucket must be shared across all experiments (not per-experiment)

### Round-Robin Fairness

**Context**: Multiple experiments may run concurrently. Need to prevent one experiment from monopolizing capacity.

**Decision**: Use round-robin dispatch ordered by `last_served_at` timestamp. Experiments with older timestamps get priority. New experiments initialize with `datetime.min` (oldest possible).

**Mechanism**:
1. Daemon sorts experiments by `last_served_at` (oldest first)
2. Iterates through experiments calling `try_get_ready_job()`
3. First experiment with a ready job (not rate-limited) wins the slot
4. `last_served_at` updated only when job actually dispatched

**Key behaviors**:

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| **New experiment joins** | Gets priority (datetime.min) | Immediate UI feedback for user who just clicked Start |
| **Experiment rate-limited** | Skipped, `last_served_at` unchanged | Doesn't "lose" its turn; checked first next time |
| **Experiment drops out** | Clean removal, no distortion | Remaining experiments continue fair alternation |
| **Same provider, different experiments** | Alternate fairly | Token bucket shared, round-robin decides who gets capacity |

**Consequences**:
- ✅ Equal opportunity fairness—each experiment gets proportional slots
- ✅ Work-conserving—rate-limited experiments don't block others
- ✅ Graceful join/leave—no fairness distortion on topology changes
- ⚠️ New experiments temporarily monopolize (by design, for UX)
- ⚠️ No priority mechanism—can't mark experiments as "urgent"

### Heartbeat-Based Ownership (vs. LISTEN/NOTIFY)

**Context**: Multiple replicas may run concurrently in PostgreSQL deployments. Need to prevent two replicas from running the same experiment.

**Decision**: Use heartbeat-based ownership with `claimed_at` timestamp, not PostgreSQL LISTEN/NOTIFY.

**Consequences**:
- ✅ Works with any database (SQLite, PostgreSQL)
- ✅ Simple to implement and reason about
- ✅ Orphan recovery is straightforward (stale claims = crashed replica)
- ⚠️ 10-minute delay before crashed experiments resume (acceptable trade-off)
- ⚠️ Requires periodic heartbeat loop (every 5 minutes)

### No Queue State Persistence

**Context**: When an experiment is stopped or the server crashes, we need to resume where we left off. Options:
- Serialize queue state (pending tasks, retry heap) to database
- Query incomplete runs from database on resume

**Decision**: No queue persistence. Resume queries incomplete runs fresh from the database.

**Consequences**:
- ✅ Dramatically simpler implementation
- ✅ No schema complexity for queue state
- ✅ Resume is idempotent—can't have stale queue state
- ⚠️ Resume may re-query already-completed work (filtered out by query)
- ⚠️ Retry backoff state is lost (jobs restart at backoff=0)

### Separate Circuit Breakers for Tasks and Evals

**Context**: When an LLM provider is down, individual retries waste time. Need fast failure detection.

**Decision**: Implement circuit breakers that trip after 5 consecutive failures. Use separate breakers for tasks and evals.

**Consequences**:
- ✅ Fast failure when provider is down (stops after 5 failures, not 5×N)
- ✅ Tasks and evals can use different providers—one failing doesn't kill the other
- ⚠️ One success resets the counter (by design—allows recovery)
- ⚠️ Circuit doesn't auto-reset with time (experiment stops, user must resume)

### Catch-and-Retry for Background Loops

**Context**: Heartbeat and orphan scan loops run in the same task group as the main dispatch loop. An unhandled exception would crash the entire daemon.

**Decision**: Wrap loop bodies in try/except, log errors, and retry on next interval.

**Alternatives considered**:

| Option | Behavior | Why not chosen |
|--------|----------|----------------|
| Stop experiments on failure | Stop all experiments when heartbeat fails | Complex state management; experiments can't make progress |
| Crash after N failures | Retry N times, then crash daemon | More complex; loses in-flight work |

**Consequences**:
- ✅ Simple implementation
- ✅ Transient DB errors don't kill running experiments
- ⚠️ Risk of split-brain if heartbeat stays broken (other replicas may steal experiments)
- ⚠️ Orphan recovery provides eventual consistency if split-brain occurs

---

## Lifecycle

### Start Experiment

**Preconditions**: Experiment config exists, experiment not already running

**Steps**:
1. **Claim ownership atomically** — Single UPDATE sets `claimed_at` and `claimed_by`
2. **Create in-memory state** — Instantiate RunningExperiment with queues and callbacks
3. **Register and wake daemon** — Add to registry, set work-available event

**Nuance**: The claim must be atomic (single UPDATE statement). Don't SELECT-then-UPDATE or you'll have race conditions with other replicas.

### Stop Experiment

**Actors that can stop an experiment**:

| Actor | Trigger | Needs cooldown? |
|-------|---------|-----------------|
| User (stop button) | GraphQL mutation | Yes (5 seconds) |
| User (close browser) | Connection close | No |
| Completion | All work done | No |
| Circuit breaker | 5 consecutive failures | No |
| Another replica | Stale claim detected | No |

**Steps**:
1. **Check cooldown** (user-initiated only) — If `toggled_at` within 5 seconds, reject
2. **Clear ownership atomically** — UPDATE sets `claimed_at=NULL`, `toggled_at=now`
3. **Remove from registry** — Use `pop()`, not `get()` (critical for race condition prevention)
4. **Cancel in-flight jobs** — Via anyio cancel scopes

**Nuances**:
- `stop()` on RunningExperiment does NOT call `on_done`—caller handles cleanup coordination
- Must use `pop()` to remove from registry atomically (prevents heartbeat race)
- Idempotent—safe to call multiple times

> **Deep dive**: See [Appendix: Stopping Deep Dive](./experiment-runner-background-process/appendix-stopping-deep-dive.md) for comprehensive analysis.

### Resume Experiment

**Preconditions**: Experiment config exists, experiment not currently running (`claimed_at` is NULL)

**Steps**:
1. **Validate not running** — Check `claimed_at IS NULL`
2. **Claim and start** — Same as start_experiment

**Key insight**: Resume doesn't restore queue state. It queries incomplete runs fresh from the database. This makes resume idempotent and crash-safe.

> **Deep dive**: See [Appendix: Resume Deep Dive](./experiment-runner-background-process/appendix-resume-deep-dive.md) for atomic claims and multi-replica races.

### Completion

**Detection**: After each job callback, check if all work is done:
- Task queue empty
- Eval queue empty  
- Retry heap empty
- No in-flight jobs
- No more tasks in database

**Steps**:
1. Set `_active = False`
2. Log completion summary (succeeded/failed counts)
3. Call `on_done` callback (removes from registry, clears ownership in DB)

---

## Multi-Replica Coordination

### Heartbeat Loop

**Purpose**: Prevent other replicas from stealing experiments we're actively running.

**Behavior**:
- Runs every 5 minutes
- Updates `claimed_at` for all experiments we own
- Detects lost ownership (experiment in memory but UPDATE didn't match)

**Lost ownership handling**: If an experiment is in memory but heartbeat UPDATE didn't return it, another replica or user took over. Stop the experiment locally (no DB update needed).

**Nuance**: Heartbeat only updates experiments where `claimed_by` matches our replica ID. This prevents accidentally refreshing experiments we don't own.

### Orphan Recovery

**Purpose**: Resume experiments orphaned by crashed replicas.

**When it runs**:
1. **At startup** — Immediate recovery of experiments orphaned during downtime
2. **Periodically** — Every 10-15 minutes (with jitter) to catch orphans from other replicas

**Orphan definition**: An experiment where `claimed_at` is older than `STALE_CLAIM_TIMEOUT` (10 minutes).

**Steps**:
1. Query for orphaned experiments (stale or null `claimed_at`)
2. For each orphan, attempt atomic claim (UPDATE with WHERE clause)
3. If claim succeeds, start the experiment

**Jitter**: Random 0-5 minute jitter on the periodic scan prevents thundering herd when multiple replicas restart simultaneously.

**Nuance**: Must start experiments outside the DB session to avoid deadlock (nested transactions).

### Race Condition Prevention

| Scenario | Prevention |
|----------|------------|
| Two replicas claim same orphan | Atomic `UPDATE...WHERE...RETURNING` |
| Stop while heartbeat runs | `stop_experiment` uses `pop()` to remove first |
| Resume while already running | Check `claimed_at IS NULL` before resume |
| Rapid stop/resume toggling | 5-second cooldown on user toggles (not initial start) |
| Job callback after stop | Check `_active` flag in all callbacks |
| Orphan recovery deadlock | Start experiments outside DB session |

### Concurrency Invariants

| Invariant | Enforcement |
|-----------|-------------|
| Status change → remove from registry | All stop paths use `pop()` not `get()` |
| No nested transactions on same row | Call `start_experiment()` outside session |
| Only one replica owns an experiment | Atomic `UPDATE...WHERE...RETURNING` |
| Stopped experiments don't queue work | Check `_active` in all callbacks |
| Job completion is clean | Let in-flight jobs finish, don't abort mid-flight |

---

## Error Handling

### Error Categories

| Category | Examples | Action | Retry? |
|----------|----------|--------|--------|
| **Rate limit** | 429 status, `UnavailableTokensError` | Requeue with backoff, update token bucket | Yes (unlimited) |
| **Transient** | Timeout, connection error, SQLAlchemyError | Requeue with backoff | Yes (up to 3) |
| **Permanent** | 400 status, invalid API key, bad request | Mark failed | No |

### Retry Policy

**Formula**: `backoff = base_delay × 2^(retry_count - 1)`

| Retry | Delay |
|-------|-------|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 4 seconds |

After 3 retries, transient errors become permanent failures.

**Rate limit handling**: Rate limit errors don't count toward the retry limit—they're requeued indefinitely with exponential backoff. The token bucket is also notified to slow down future requests.

### Circuit Breaker

**Purpose**: When an LLM provider is down, detect quickly and stop wasting retries.

**Behavior**:
- Tracks consecutive failures
- Trips after 5 consecutive failures
- One success resets the counter
- When tripped: notify UI subscribers, close streams, stop experiment

**Why separate breakers for tasks and evals**: They may use different LLM providers. A broken eval provider shouldn't stop task execution if the task provider is healthy.

### UI Error Communication

**When circuit trips**:
1. Send error payload to all subscribers
2. Close streams (triggers clean EndOfStream on client)
3. Clear subscriber list
4. Stop experiment
5. Record error in `last_error` field

**Nuance**: Must close streams explicitly—just sending an error payload doesn't end the subscription.

---

## Appendix: Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_CONCURRENT` | 20 | Global concurrency slots |
| `POLL_INTERVAL` | 0.1s | Seconds between dispatch attempts |
| `MAX_CONSECUTIVE_ERRORS` | 50 | Stop daemon after this many consecutive internal errors (catches programming bugs) |
| `STALE_CLAIM_TIMEOUT` | 10 min | When to consider a claim stale (from config) |
| `HEARTBEAT_INTERVAL` | 5 min | How often to refresh claims (`STALE_CLAIM_TIMEOUT / 2`) |
| `ORPHAN_SCAN_INTERVAL` | 10 min | Base interval for orphan scan (`= STALE_CLAIM_TIMEOUT`) |
| `ORPHAN_SCAN_JITTER` | 0-5 min | Random jitter to avoid thundering herd |
| `max_retries` | 3 | Per-job retry limit |
| `base_backoff_seconds` | 1.0 | Initial retry delay |
| `_task_batch_size` | 10 | Tasks loaded per DB query |
| `circuit_breaker_threshold` | 5 | Consecutive failures before trip |
| `job_timeout` | 120s | Default timeout for LLM calls |
| `shield_timeout` | 30s | Timeout for shielded DB writes |

## Appendix: File References

| Concept | File |
|---------|------|
| ExperimentRunner daemon | `experiment_runner.py` |
| RunningExperiment | `experiment_runner.py` |
| TaskJob / EvalJob | `experiment_runner.py` |
| Token bucket registry | `experiment_runner.py` |
| DB model | `models.py` |
| Stop/Resume mutations | `experiment_mutations.py` |

## Appendix: Related Documents

### Lifecycle (State Transitions)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [Lifecycle](./experiment-runner-background-process/appendix-lifecycle.md) | Overview with patterns and timelines | First read |
| [Stopping Deep Dive](./experiment-runner-background-process/appendix-stopping-deep-dive.md) | Formal analysis: 5 actors, proofs, checklist | When modifying stop logic |
| [Resume Deep Dive](./experiment-runner-background-process/appendix-resume-deep-dive.md) | Formal analysis: atomic claims, cooldown | When modifying resume logic |

### Rate Limiting

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [Rate Limiting](./experiment-runner-background-process/appendix-rate-limiting.md) | Design + provider reference | Rate limit changes |

### Reference Documents

| Document | Purpose |
|----------|---------|
| [FAQ](./experiment-runner-background-process/appendix-faq.md) | "Why" questions about constants and architecture |
| [Schema Design](./experiment-runner-background-process/appendix-schema.md) | Schema design decisions |
| [Error Types](./experiment-runner-background-process/appendix-error-types.md) | Provider SDK error hierarchies |

### Backup (Original Files)

Original unmerged files are preserved in `experiment-runner-background-process/backup/`.
