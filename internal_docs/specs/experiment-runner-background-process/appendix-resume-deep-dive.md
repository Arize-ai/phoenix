# Appendix: Resuming Experiments — A Deep Dive

## Overview

A stopped experiment can be resumed. The question is: **what does "resume" mean, and what are the edge cases?**

This seems simple until you consider:

**Challenges**:
- Multiple replicas may try to resume simultaneously (user double-click, load balancer routing)
- Orphaned experiments need automatic recovery (crashed replica)
- Work must be reconstructed from database state
- Resume must be safe even if experiment is already running

**Solutions** (analyzed in this document):
- Atomic claim pattern prevents double-resume
- Cooldown prevents rapid stop/resume thrashing
- Database-derived work reconstruction ensures correctness

---

## Table of Contents

1. [State Model](#state-model)
2. [The Actors](#the-actors)
3. [The Race Condition Problem](#the-race-condition-problem)
4. [The Atomic Claim Pattern](#the-atomic-claim-pattern)
5. [Multi-Replica Resume Analysis](#multi-replica-resume-analysis)
6. [Work Reconstruction](#work-reconstruction)
7. [Cooldown Mechanism](#cooldown-mechanism)
8. [Invariants and Guarantees](#invariants-and-guarantees)
9. [Known Limitations](#known-limitations)
10. [Summary](#summary)
11. [Implementation Verification Checklist](#implementation-verification-checklist)

---

## State Model

An experiment's "resumability" is determined by database state:

| Field | Meaning | Resume Allowed? |
|-------|---------|-----------------|
| `claimed_at = NULL` | Not running | Yes |
| `claimed_at = recent` | Running (active heartbeat) | No |
| `claimed_at = stale` | Orphaned (crashed replica) | Yes (orphan scan) |

**Key insight**: The database is the source of truth. A replica cannot know if an experiment is "really" running without checking the database. The `claimed_at` timestamp, combined with heartbeat, provides liveness detection.

### Experiment Lifecycle States

```
                    ┌─────────────┐
                    │   CREATED   │
                    │ claimed_at  │
                    │   = NULL    │
                    └──────┬──────┘
                           │ start_experiment()
                           ▼
                    ┌─────────────┐
       ┌───────────▶│   RUNNING   │◀───────────┐
       │            │ claimed_at  │            │
       │            │  = recent   │            │
       │            └──────┬──────┘            │
       │                   │                   │
  resume_mutation()        │           orphan_scan()
       │                   │                   │
       │        ┌──────────┴──────────┐        │
       │        │                     │        │
       │        ▼                     ▼        │
       │  ┌─────────────┐      ┌─────────────┐ │
       │  │   STOPPED   │      │  ORPHANED   │ │
       │  │ claimed_at  │      │ claimed_at  │ │
       │  │   = NULL    │      │   = stale   │ │
       │  └──────┬──────┘      └──────┬──────┘ │
       │         │                    │        │
       └─────────┘                    └────────┘
```

---

## The Actors

Two actors can resume an experiment:

### 1. User Resume (via Mutation)

User clicks "Resume" in the UI. The mutation:
1. Checks cooldown (prevents rapid toggling)
2. Atomically claims the experiment (`WHERE claimed_at IS NULL`)
3. Starts in-memory processing

```python
# Atomic claim: only succeeds if not currently running
stmt = (
    update(ExperimentExecutionConfig)
    .where(experiment_id == exp_id)
    .where(claimed_at.is_(None))  # Only if stopped
    .values(claimed_at=now, claimed_by=replica_id, status="RUNNING", cooldown_until=now+cooldown)
    .returning(ExperimentExecutionConfig)
)
```

### 2. Orphan Scan (Automatic Recovery)

Background daemon periodically scans for orphaned experiments:
1. Finds experiments where `claimed_at < cutoff` (stale)
2. Atomically claims them (`WHERE claimed_at < cutoff`)
3. Resumes processing

```python
# Atomic claim: only succeeds if still stale
claim_stmt = (
    update(ExperimentExecutionConfig)
    .where(experiment_id == exp_id)
    .where(claimed_at < cutoff)  # Only if still stale
    .values(claimed_at=now, claimed_by=replica_id)
    .returning(experiment_id)
)
```

### Why These Are Different

| Aspect | User Resume | Orphan Scan |
|--------|-------------|-------------|
| Trigger | User action | Automatic |
| Condition | `claimed_at IS NULL` | `claimed_at < cutoff` |
| Sets `cooldown_until` | Yes (`now + 5s`) | No (shouldn't block user) |
| Clears `last_error` | Yes | Yes |

**Important**: Orphan scan does NOT set `cooldown_until`. This ensures users can immediately stop an auto-recovered experiment without hitting the cooldown.

---

## The Race Condition Problem

### Scenario: Double-Click Resume

```
User double-clicks "Resume" button rapidly
Request 1 hits Replica A
Request 2 hits Replica B (load balancer)
```

Without protection, both replicas might:
1. Read `claimed_at = NULL` → "safe to resume"
2. Both write `claimed_at = now`
3. Both start processing → duplicate work!

### Scenario: User Resume vs Orphan Scan

```
1. Experiment 123 was running on Replica A
2. A crashes, claim becomes stale
3. User on Replica B clicks "Resume" 
4. Replica C's orphan scan finds experiment 123
5. Both B and C try to resume simultaneously
```

### Scenario: Multiple Orphan Scanners

```
Replicas A, B, C all run orphan scan around the same time
All find experiment 123 is orphaned
All try to claim it
```

---

## The Atomic Claim Pattern

The solution is **atomic conditional update**. Instead of read-then-write:

```python
# WRONG: Race condition (time-of-check to time-of-use)
config = await session.get(ExperimentExecutionConfig, exp_id)
if config.claimed_at is None:  # Check
    config.claimed_at = now     # Write - but someone else might have claimed!
```

We use an atomic UPDATE with WHERE clause:

```python
# CORRECT: Atomic claim
stmt = (
    update(ExperimentExecutionConfig)
    .where(experiment_id == exp_id)
    .where(claimed_at.is_(None))  # Condition in WHERE, not separate check
    .values(claimed_at=now, claimed_by=replica_id)
    .returning(ExperimentExecutionConfig)
)
result = await session.execute(stmt)
updated = result.scalar_one_or_none()

if updated is None:
    # Atomic operation failed - someone else claimed it (or already running)
    ...
```

**Why this works**: The database executes the UPDATE atomically. If two replicas execute simultaneously:
- Both send `UPDATE ... WHERE claimed_at IS NULL`
- Database serializes them (row-level lock)
- First one succeeds, sets `claimed_at = now`
- Second one's WHERE clause fails (claimed_at is no longer NULL)
- Second one gets 0 rows updated → knows it lost the race

---

## Multi-Replica Resume Analysis

### Race 1: User Double-Click on Same Replica

```
1. User clicks Resume (Request 1)
2. User clicks Resume again (Request 2) - same replica
```

**Timeline**:
```
Request 1: UPDATE SET claimed_at=now WHERE claimed_at IS NULL → 1 row
Request 2: UPDATE SET claimed_at=now WHERE claimed_at IS NULL → 0 rows
```

**Result**:
- Request 1 succeeds, starts experiment
- Request 2 sees `updated_config = None`
- Request 2 checks: was it already running? `config.claimed_at IS NOT NULL` → Yes
- Request 2 returns `resumed=True` (idempotent success)

**Verdict**: Safe. One claim succeeds, other returns idempotent success.

### Race 2: User Double-Click on Different Replicas

```
1. User clicks Resume (Request 1 → Replica A)
2. User clicks Resume (Request 2 → Replica B) - load balancer split
```

**Timeline**:
```
A: UPDATE SET claimed_at=now WHERE claimed_at IS NULL → 1 row
B: UPDATE SET claimed_at=now WHERE claimed_at IS NULL → 0 rows
```

**Result**: Same as Race 1. Atomic UPDATE ensures only one wins.

**Verdict**: Safe. Database serialization prevents double-claim.

### Race 3: User Resume vs Orphan Scan

```
Replica A: User clicks Resume
Replica B: Orphan scan finds stale experiment
```

**Case A: User wins first**:
```
A: UPDATE SET claimed_at=T1 WHERE claimed_at IS NULL → 1 row
B: UPDATE SET claimed_at=T2 WHERE claimed_at < cutoff → 0 rows (claimed_at=T1, not stale)
```
- A claims successfully
- B's WHERE fails (T1 is recent, not < cutoff)

**Case B: Orphan scan wins first**:
```
B: UPDATE SET claimed_at=T1 WHERE claimed_at < cutoff → 1 row
A: UPDATE SET claimed_at=T2 WHERE claimed_at IS NULL → 0 rows (claimed_at=T1, not NULL)
```
- B claims successfully
- A's WHERE fails (claimed_at is no longer NULL)
- A checks: was it already running? Yes → returns `resumed=True`

**Verdict**: Safe. Both orderings result in exactly one claim.

### Race 4: Multiple Orphan Scanners

```
Replicas A, B, C all run orphan scan
All find experiment 123 with stale claimed_at
```

**Timeline**:
```
A: UPDATE SET claimed_at=T1 WHERE claimed_at < cutoff → 1 row
B: UPDATE SET claimed_at=T2 WHERE claimed_at < cutoff → 0 rows (T1 > cutoff)
C: UPDATE SET claimed_at=T3 WHERE claimed_at < cutoff → 0 rows (T1 > cutoff)
```

**Result**: First scanner wins, others get 0 rows and log "claimed by another replica".

**Verdict**: Safe. Atomic update serializes competing claims.

### Race 5: Resume During Graceful Shutdown

```
1. User clicks Resume on Replica A
2. A is in graceful shutdown (hasn't released claims yet)
```

**Timeline**:
```
A.mutation: UPDATE SET claimed_at=now WHERE claimed_at IS NULL
```

**If experiment is in A's graceful shutdown**:
- `claimed_at` is still set (shutdown preserves ownership)
- WHERE fails → `updated_config = None`
- Mutation checks: already running? Yes → `resumed=True`

**After A shuts down**:
- Claim becomes stale
- Orphan scan eventually reclaims

**Verdict**: Safe. Resume fails gracefully, orphan scan handles recovery.

---

## Work Reconstruction

### The Key Insight

Resume does **NOT** restore in-memory queue state. It queries incomplete work fresh from the database.

```python
# Called during initialization of RunningExperiment
stmt = get_experiment_incomplete_runs_query(
    experiment,
    dialect,
    cursor_example_rowid=offset,
    limit=batch_size,
)
```

### What "Incomplete" Means

An experiment run is incomplete if:
1. **Missing**: No `experiment_run` record exists for this (example, repetition) pair
2. **Failed**: An `experiment_run` record exists but has an error

The query finds all examples where `successful_count < repetitions`.

### Why Database-Derived Work is Safe

**Scenario**: Experiment stopped mid-flight, some jobs completed, some didn't.

```
Before stop:
- Jobs 1-5: Completed (in DB)
- Jobs 6-8: In-flight (processing)
- Jobs 9-20: Queued (in memory)

After stop:
- Jobs 1-5: Still in DB (completed)
- Jobs 6-8: Lost (never wrote to DB due to shield timeout or cancellation)
- Jobs 9-20: Lost (memory cleared)

On resume:
- Query: "Find incomplete runs"
- Result: Jobs 6-20 (no successful run record)
- Queued for processing: Jobs 6-20
```

**Critical**: Jobs 6-8 might have been partially completed when stopped. The upsert-based writes handle this:
- If job 6's result was written: Query won't include it (it's complete)
- If job 6's result wasn't written: Query includes it (will be re-executed)

### Duplicate Work Protection

Job writes use upserts with unique constraint:

```sql
INSERT INTO experiment_runs (experiment_id, dataset_example_id, repetition_number, ...)
ON CONFLICT (experiment_id, dataset_example_id, repetition_number)
DO UPDATE SET ...
```

If the same job runs twice (due to race conditions or resume), the second write simply overwrites. No corruption, just redundant work.

---

## Cooldown Mechanism

### Purpose

Prevent rapid stop/resume thrashing that wastes work:

```
T0: User clicks Stop
T1: Experiment stops, 10 jobs cancelled
T2: User clicks Resume (immediately)
T3: Experiment resumes, re-queues 10 jobs
T4: User clicks Stop (oops, wrong button)
T5: Experiment stops, 10 jobs cancelled again
...
```

### Implementation

The cooldown check is folded into the atomic UPDATE's WHERE clause to prevent TOCTOU races:

```python
# In resume mutation — single atomic UPDATE with cooldown in WHERE:
stmt = (
    update(ExperimentExecutionConfig)
    .where(experiment_id == exp_id)
    .where(claimed_at.is_(None))
    .where(or_(cooldown_until.is_(None), cooldown_until <= now))
    .values(claimed_at=now, claimed_by=replica_id, status="RUNNING",
            cooldown_until=now + EXPERIMENT_TOGGLE_COOLDOWN)
)
# If 0 rows: SELECT to diagnose (not found, already running, or cooldown active)
```

### What Sets `cooldown_until`

| Operation | Sets `cooldown_until`? | Why |
|-----------|----------------------|-----|
| User stop | Yes (`now + 5s`) | Enables cooldown |
| User resume | Yes (`now + 5s`) | Enables cooldown |
| Natural completion | No | Internal, not user action |
| Circuit breaker | No | Internal, not user action |
| Orphan scan claim | No | Shouldn't block user |
| Initial start | No | Shouldn't block first stop |

**Key**: Orphan scan does NOT set `cooldown_until`. This ensures:
- Auto-recovered experiments can be stopped immediately
- User retains full control after crash recovery

### Cooldown vs Idempotency

Cooldown only applies to **opposite** operations (stop→resume, resume→stop).

Duplicate operations (resume→resume, stop→stop) are handled by idempotency:
- Resume when running → already running, idempotent return
- Stop when stopped → already stopped, idempotent return

---

## Invariants and Guarantees

### Safety Properties

#### S1: Single Owner

> **At any time, at most one replica owns a given experiment.**

**Proof**:
1. Ownership is established by atomic UPDATE with WHERE clause
2. WHERE clause ensures UPDATE only succeeds if precondition holds
3. Database serializes concurrent UPDATEs on same row
4. Only one UPDATE can succeed when multiple replicas race ∎

#### S2: No Lost Resume

> **If the mutation's atomic claim succeeds, the experiment will start on that replica.**

**Proof**:
1. `start_experiment()` is called after atomic claim succeeds
2. `start_experiment()` creates RunningExperiment and adds to registry
3. Experiment begins processing ∎

**Note**: If `start_experiment()` crashes, the experiment has `claimed_at` set but nothing is running. This is the "orphan" state, recovered by orphan scan.

#### S3: Idempotent Resume

> **Multiple resume requests for the same experiment result in exactly one running instance.**

**Proof**:
1. First request: atomic claim succeeds, experiment starts
2. Subsequent requests: atomic claim fails (claimed_at no longer NULL)
3. Mutation checks: is it running? If yes, return success
4. Result: One running instance, all requests return success ∎

#### S4: Resume Correctness

> **Resumed experiment processes exactly the incomplete work (no duplicates, no omissions).**

**Proof**:
1. Work is derived from `get_experiment_incomplete_runs_query()`
2. Query returns examples where `successful_count < repetitions`
3. Completed work has `experiment_run` records → not returned by query
4. Incomplete work has no record (or error record) → returned by query
5. Upserts handle any races → no corruption ∎

### Liveness Properties

#### L1: Orphan Recovery

> **If a replica crashes while owning an experiment, another replica will eventually resume it.**

**Proof**:
1. Crashed replica stops sending heartbeats
2. `claimed_at` becomes stale (no updates)
3. Orphan scan finds `claimed_at < cutoff`
4. Orphan scan claims and resumes ∎

**Bound**: `STALE_CLAIM_TIMEOUT + ORPHAN_SCAN_INTERVAL` (typically 10-15 minutes)

#### L2: Cooldown Expiry

> **A stopped experiment can eventually be resumed (cooldown expires).**

**Proof**:
1. Stop sets `cooldown_until = now + 5s`
2. After 5 seconds, `cooldown_until <= now`
3. Resume WHERE clause passes ∎

**Bound**: `EXPERIMENT_TOGGLE_COOLDOWN` (5 seconds)

### What We Cannot Guarantee

#### No Duplicate Work During Transition

During resume, if the previous runner was in graceful shutdown:
- Previous runner may complete some jobs (shielded operations)
- New runner may re-queue the same jobs (not yet in DB)
- Both may write results

**Mitigation**: Upserts handle duplicate writes safely.

#### Instant Resume

Resume cannot be instant because:
1. Atomic claim requires database round-trip
2. Work reconstruction requires database query
3. `start_experiment()` has initialization overhead

---

## Known Limitations

### Limitation 1: Stale Cooldown State After Crash

This is NOT a problem with cooldown itself (cooldown is a solution). It's an edge case where cooldown state persists unexpectedly after crash recovery.

**Scenario**:
1. User stops experiment at T0 (sets `cooldown_until = T0 + 5s`)
2. Server crashes at T0 + 2 seconds
3. User restarts server at T0 + 3 seconds
4. User tries to resume immediately
5. `cooldown_until = T0 + 5s` is still in DB, only 3 seconds elapsed
6. Resume rejected due to cooldown (unexpected!)

**Impact**: Minor UX annoyance. Wait 2 more seconds.

**Why not mitigated**:
- This is a rare edge case (crash during active user interaction)
- Clearing `cooldown_until` on startup could re-enable the rapid-toggle abuse cooldown prevents
- The 5-second wait is brief

### Limitation 2: Orphan Scan Delay

Orphan recovery has significant delay:
- `STALE_CLAIM_TIMEOUT`: 10 minutes (must wait for claim to become stale)
- `ORPHAN_SCAN_INTERVAL`: 5 minutes (scan frequency)
- Worst case: 15 minutes before recovery

**Impact**: Experiments may be "stuck" for up to 15 minutes after crash.

**Why not mitigated**: 
- Shorter timeout risks false positives (claiming running experiments)
- More frequent scans wastes resources
- Trade-off between recovery time and safety

**Alternative**: Users can manually resume immediately (no need to wait for orphan scan).

### Limitation 3: Evaluator State Not Preserved

Evaluator configuration is stored, but evaluator internal state (e.g., LLM client connection pools) is not:

```
Before crash: Evaluator has warm connection pool, cached auth tokens
After resume: Evaluator creates fresh connections, re-authenticates
```

**Impact**: Slight performance penalty on resume. First few jobs may be slower.

**Why not mitigated**: Serializing connection state is complex and error-prone.

### Summary of Limitations

| Limitation | Severity | Status |
|------------|----------|--------|
| Stale cooldown after crash | Low | Rare edge case; wait a few seconds |
| Orphan scan delay | Medium | Accept trade-off; users can resume manually |
| Evaluator state lost | Low | Accept performance penalty |

---

## Summary

### The Core Insight

Resume is an **atomic ownership transfer**:
1. Atomic UPDATE with WHERE clause ensures single owner
2. Database serialization prevents race conditions
3. Idempotent response handles duplicate requests

### The Atomic Claim Pattern

```sql
-- User resume: claim if stopped
UPDATE SET claimed_at=now, claimed_by=replica_id
WHERE experiment_id=X AND claimed_at IS NULL

-- Orphan scan: claim if stale
UPDATE SET claimed_at=now, claimed_by=replica_id
WHERE experiment_id=X AND claimed_at < cutoff
```

Both patterns:
- Use atomic UPDATE (no separate read-then-write)
- Include condition in WHERE clause
- Check RETURNING to detect race loss

### Multi-Replica Safety

| Scenario | What Happens | Result |
|----------|--------------|--------|
| Double-click (same replica) | Second UPDATE fails (claimed_at changed) | Idempotent success |
| Double-click (different replicas) | Database serializes, one wins | Idempotent success |
| User vs orphan scan | First to execute wins | Single owner |
| Multiple orphan scanners | First to execute wins | Single owner |

### Work Reconstruction

- Resume queries DB for incomplete runs (not cached state)
- Upserts handle duplicate work from races
- Circuit breaker state is lost (acceptable trade-off)

---

## Implementation Verification Checklist

### Atomic Claim (User Resume)

- [x] **Uses UPDATE with WHERE clause** (not read-then-write)
- [x] **WHERE includes `claimed_at IS NULL`** condition
- [x] **Uses RETURNING** to detect if claim succeeded
- [x] **Returns idempotent success** if already running
- [x] **Sets `cooldown_until`** to enable cooldown
- [x] **Cooldown check in WHERE clause** (not separate SELECT — prevents TOCTOU)

### Atomic Claim (Orphan Scan)

- [x] **Uses UPDATE with WHERE clause** (not read-then-write)
- [x] **WHERE includes `claimed_at < cutoff`** condition
- [x] **Uses RETURNING** to detect if claim succeeded
- [x] **Does NOT set `cooldown_until`** (allows immediate user control)
- [x] **Clears `last_error`** on successful claim

### Cooldown

- [x] **Cooldown enforced atomically in UPDATE WHERE clause** (not a separate check)
- [x] **Rejects if `cooldown_until > now`**
- [x] **Sets `cooldown_until = now + 5s` on successful resume**

### Work Reconstruction

- [x] **Queries incomplete runs from DB** (not cached state)
- [x] **Uses `get_experiment_incomplete_runs_query()`**
- [x] **Pagination support** for large datasets

### Multi-Replica Safety

- [x] **Single owner guarantee** via atomic UPDATE
- [x] **Race losers return gracefully** (idempotent or logged)
- [x] **Orphan scan uses jitter** to prevent thundering herd

### Error Handling

- [x] **Clears `last_error` on resume** (fresh start)
- [x] **Logs claim failures** for debugging
- [x] **start_experiment() failure** leaves orphan (recovered by scan)

---

## Verification Commands

To verify the implementation:

1. **Read the resume-related methods**:
   ```
   - resume_experiment mutation (experiment_mutations.py)
   - _resume_orphaned() method
   - start_experiment() method
   - get_experiment_incomplete_runs_query()
   ```

2. **Search for atomic claim pattern**:
   ```
   - All resume paths use UPDATE with WHERE (not read-then-write)
   - WHERE clause includes ownership condition
   - RETURNING used to detect success
   ```

3. **Trace race scenarios**:
   ```
   - User double-click → atomic claim serializes
   - User vs orphan scan → first wins
   - Multiple orphan scanners → first wins
   ```

4. **Verify invariants**:
   ```
   - S1: Atomic UPDATE ensures single owner
   - S3: Idempotent response for duplicate requests
   - L1: Orphan scan eventually recovers crashed experiments
   ```
