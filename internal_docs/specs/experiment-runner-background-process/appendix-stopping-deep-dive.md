# Appendix: Stopping Experiments — A Deep Dive

## The Problem

An experiment runner processes work in the background. At some point, processing must stop. The question is: **what does "stop" mean, and what should happen?**

This seems simple until you consider:
- Work may be in-flight when stop is requested
- Multiple processes may be coordinating
- Different situations require different cleanup behaviors
- State exists in multiple places (memory, database)

---

## Table of Contents

1. [State Model](#state-model)
2. [The Actors](#the-actors)
3. [The Concerns](#the-concerns)
4. [The Constraints](#the-constraints)
5. [Deriving the Design](#deriving-the-design)
   - [The Authority Model](#the-authority-model)
   - [Why Not Put DB Update in stop_experiment()?](#why-not-put-db-update-in-stop_experiment)
6. [Multi-Replica Coordination](#multi-replica-coordination)
7. [Concurrency Analysis](#concurrency-analysis)
   - [Race Conditions](#race-conditions)
   - [Edge Cases](#edge-cases)
   - [Design Trade-offs](#design-trade-offs-considered-and-rejected)
8. [Invariants and Guarantees](#invariants-and-guarantees)
   - [Safety Properties](#safety-properties)
   - [Liveness Properties](#liveness-properties)
   - [What We Cannot Guarantee](#what-we-cannot-guarantee)
   - [Formal Model Summary](#formal-model-summary)
   - [Robustness Assessment](#robustness-assessment)
9. [Known Limitations and Edge Cases](#known-limitations-and-edge-cases)
   - [Circuit Breaker State Lost on Ownership Transfer](#limitation-1-circuit-breaker-state-lost-on-ownership-transfer)
   - [Error Recording Lost on Conditional Update Failure](#limitation-2-error-recording-lost-on-conditional-update-failure)
   - [Initialization Race Window](#limitation-3-initialization-race-window)
10. [Summary](#summary)
11. [Implementation Verification Checklist](#implementation-verification-checklist)

---

## State Model

An experiment exists in two places:

| Location | What it represents | Examples |
|----------|-------------------|----------|
| **Database** | Persistent state, source of truth | `claimed_at`, `claimed_by`, task progress |
| **Memory** | Runtime state for active processing | queues, in-flight jobs, flags |

The database state determines whether an experiment *should* run. The memory state represents that it *is* running.

**Key insight**: These can be out of sync. The database might say "not running" while memory still has active jobs. This is the core challenge.

---

## The Actors

Five actors can stop an experiment. Each has a different **intention**:

### 1. Natural Completion

The experiment finishes all its work.

- **Intention**: Processing is done. Release ownership so experiment shows as complete.
- **Runner updates DB?** Yes — clear `claimed_by` to release ownership.

### 2. Circuit Breaker

Too many consecutive failures indicate a systemic problem (API down, network issues).

- **Intention**: Stop wasting resources. Record the error. Release ownership.
- **Runner updates DB?** Yes — clear `claimed_by` and record error.

### 3. User Stop

User clicks "Stop" in the UI.

- **Intention**: User wants to pause the experiment. Should be resumable later.
- **Runner updates DB?** No — mutation already cleared `claimed_by` before calling the runner.

### 4. Lost Ownership (Heartbeat)

The database says we don't own this experiment anymore. Someone else stopped it or claimed it.

- **Intention**: Stop processing work we don't own.
- **Runner updates DB?** No — whoever caused the ownership change already updated it.

### 5. Graceful Shutdown

The server is shutting down.

- **Intention**: Stop processing cleanly. Don't release ownership — we want to resume on restart.
- **Runner updates DB?** No — intentionally leave ownership so restart can resume.

### Summary of Intentions

| Actor | Should release ownership? | Runner updates DB? |
|-------|--------------------------|-------------------|
| Natural completion | Yes | Yes |
| Circuit breaker | Yes (with error) | Yes |
| User stop | Yes | No (mutation did it) |
| Lost ownership | N/A (already lost) | No |
| Graceful shutdown | No (want to resume) | No |

---

## The Concerns

When stopping, several concerns must be addressed:

### 1. In-Flight Work

Jobs may be running when stop is requested. What happens to them?

**Option A: Cancel immediately**
- Jobs get cancelled mid-execution
- Risk: Database writes interrupted → connection pool corruption

**Option B: Shield critical operations**
- Database writes use `shield=True` — they complete even after cancellation
- Jobs finish their DB write, then notice they're stopped
- Safer, but means jobs can complete *after* stop was called

We use Option B. This means:
- Stop sets a flag (`_active = False`)
- Shielded operations complete
- Completed jobs check the flag and discard results if stopped

**Timeline**:
```
T0: Job starts, begins LLM call
T1: stop() called, sets _active = False, cancels scope
T2: LLM call completes (was already in flight)
T3: Job's shielded DB write completes
T4: Job calls success handler
T5: Handler checks _active → False → discards result
```

### 2. Queued Work

Pending work in queues should be abandoned:
- Task queue (tasks waiting to run)
- Eval queue (evaluators waiting to run)
- Retry heap (failed jobs waiting to retry)

**Why clearing queues is safe**: Queued work is transient — it's derived from DB state. The database tracks which runs are complete (via `experiment_run` records). On resume, the runner queries the DB to find incomplete work and re-populates the queues. No work is permanently lost; it's just reconstructed from the source of truth.

### 3. Subscribers

UI clients subscribe to experiment progress. When stopped:
- Close streams so clients know to stop polling
- Prevents clients from waiting forever

### 4. Registry

The daemon tracks running experiments in a registry (`_experiments` dict). When stopped:
- Remove from registry so daemon doesn't try to manage it
- Allows garbage collection of the experiment object

### 5. Database Ownership

The database tracks who owns a running experiment:
- `claimed_at`: When ownership was claimed (NULL = not running)
- `claimed_by`: Which replica owns it

Releasing ownership means setting `claimed_by = NULL` (and `claimed_at = NULL`).

---

## The Constraints

### Constraint 1: Shielded Operations Complete After Stop

Because database writes are shielded, jobs can complete after `stop()`. Code must handle this:

```python
def on_task_success(self, result):
    if not self._active:
        return  # Stopped, discard result
    # Process result...
```

### Constraint 2: DB Updates Are Conditional

Not all stops should update the database:
- Lost ownership: DB already updated by whoever took ownership
- Graceful shutdown: Intentionally leave ownership for restart

### Constraint 3: Multi-Replica Race Conditions

Multiple replicas may interact with the same experiment:
- User on replica B stops experiment running on replica A
- Replica A's heartbeat must detect the change
- Replica A must stop its in-memory processing

### Constraint 4: Idempotency

Stop may be called multiple times:
- Job completes and calls stop
- Meanwhile, user also clicks stop
- Both paths must be safe

---

## Deriving the Design

Given these constraints, the design follows naturally — but there are subtle traps to avoid.

### The Authority Model

Every stop operation has an **authority level** determined by the caller's intent:

| Authority | Meaning | DB Update |
|-----------|---------|-----------|
| `OVERRIDE` | "Stop this experiment, period" | Unconditional |
| `RELEASE` | "I'm done, release if I own it" | Conditional |
| `CLEANUP` | "Just clean up local state" | None |

The key insight: **authority comes from the caller, not from inspecting state**.

| Caller | Authority | Why |
|--------|-----------|-----|
| User (via mutation) | `OVERRIDE` | User intent must be honored |
| Natural completion | `RELEASE` | We should own it; safe if we don't |
| Circuit breaker | `RELEASE` | Same as completion |
| Heartbeat | `CLEANUP` | DB already reflects reality |
| Graceful shutdown | `CLEANUP` | Intentionally preserve DB state |

This model clarifies why we can't infer DB behavior from registry state — the registry tells us what we *have locally*, not what we're *authorized to do*.

### Why Not Put DB Update in stop_experiment()?

An intuitive design would have `stop_experiment()` handle everything: in-memory cleanup AND DB update. We could branch based on registry state:

```python
# FLAWED DESIGN - DO NOT USE
def stop_experiment(self, exp_id):
    exp = self._experiments.pop(exp_id, None)
    if exp:
        exp.stop()
        # In registry → we own it → conditional update
        asyncio.create_task(self._update_db_if_owned(exp_id))
    else:
        # Not in registry → cross-replica stop → unconditional update
        asyncio.create_task(self._update_db(exp_id))
```

This seems elegant: if we have the experiment, use conditional update (safe); if we don't, use unconditional (for cross-replica).

**But this fails for a critical scenario:**

```
1. A runs experiment 123 (claimed_by='A', in A's registry)
2. B claims via orphan scan (claimed_by='B') — A doesn't know yet
3. User on A clicks Stop
4. A calls stop_experiment(123)
5. A finds exp in registry → conditional update
6. Conditional: WHERE claimed_by='A' → 0 rows (B owns it!)
7. B continues running — user's Stop request was silently ignored!
```

The problem: A has the experiment in its registry (stale state), but no longer owns it in the DB. The registry-based branching chooses conditional update, which fails.

**The core issue**: Registry state and DB ownership can be out of sync. The registry tells us what we *think* we own; the DB tells us what we *actually* own. For user-initiated stops, we need unconditional updates to handle stale registry state.

### The Correct Approach: Caller Decides DB Update

Different actors need different DB update strategies:

| Actor | DB Update Type | Why |
|-------|---------------|-----|
| **User stop** | Unconditional | Must work even with stale registry state |
| **Natural completion** | Conditional | We should own it, but safe if we don't |
| **Circuit breaker** | Conditional | Same as natural completion |
| **Heartbeat** | None | DB already updated by whoever took ownership |
| **Graceful shutdown** | None | Intentionally preserve ownership |

The mutation must do its own unconditional DB update because:
1. It must work even when registry is stale (scenario above)
2. It must work cross-replica (experiment not in local registry)

### Principle 1: Separate In-Memory Cleanup from DB Update

```python
def stop(self) -> None:
    """In-memory cleanup only. No DB update."""
    if not self._active:
        return  # Idempotent
    self._active = False
    # Cancel scopes, clear queues, close subscribers
```

Why? Because different actors need different DB behavior, and we can't infer the right behavior from local state alone.

### Principle 2: Mutation Handles Its Own DB Update

```python
# In mutation
async def stop_experiment_mutation(...):
    # Unconditional update — works regardless of which replica owns it
    await session.execute(
        update(ExperimentExecutionConfig)
        .where(experiment_id == exp_id)
        .values(claimed_by=None, claimed_at=None)
    )
    # Then do in-memory cleanup
    experiment_runner.stop_experiment(exp_id)
```

Why unconditional? Because:
- Cross-replica: B stopping experiment on A can't use conditional (B doesn't own it)
- Stale registry: A stopping its own experiment might have lost ownership without knowing

### Principle 3: Internal Completion Uses Conditional Update

```python
async def complete_experiment(self, exp_id: int, error: str | None = None):
    """Called by natural completion / circuit breaker."""
    stmt = (
        update(ExperimentExecutionConfig)
        .where(experiment_id == exp_id)
        .where(claimed_by == self._replica_id)  # Only if we still own it
        .values(claimed_at=None, ...)
    )
```

Why conditional? For natural completion, we *should* own the experiment (we just ran it). But in edge cases (another replica claimed it during a network partition), the conditional update safely does nothing rather than clobbering.

### Principle 4: Consistent Cleanup in stop()

`stop()` always does the same cleanup, regardless of caller:

```python
def stop(self) -> None:
    if not self._active:
        return
    self._active = False
    
    # Cancel in-flight jobs
    for scope in self._cancel_scopes.values():
        scope.cancel()
    
    # Clear queues (release memory, prevent processing)
    self._task_queue.clear()
    self._eval_queue.clear()
    self._retry_heap.clear()
    
    # Close subscribers (signal UI)
    for stream in self._subscribers:
        stream.close()
    self._subscribers.clear()
```

### The Resulting Design

```python
class RunningExperiment:
    def stop(self) -> None:
        """In-memory cleanup. Called by all stop paths."""
        if not self._active:
            return  # Idempotent
        self._active = False
        # Cancel scopes, clear queues, close subscribers
        for scope in self._cancel_scopes.values():
            scope.cancel()
        self._task_queue.clear()
        self._eval_queue.clear()
        self._retry_heap.clear()
        for stream in self._subscribers:
            stream.close()
        self._subscribers.clear()
        # NOTE: Does NOT call on_done - caller handles DB updates

class ExperimentRunner:
    def stop_experiment(self, exp_id: int) -> bool:
        """In-memory only. Called by mutation and heartbeat."""
        exp = self._experiments.pop(exp_id, None)
        if exp:
            exp.stop()
            return True
        return False

    def _on_experiment_done(self, exp_id: int, *, last_error: str | None = None) -> None:
        """Callback when experiment completes naturally or circuit breaker trips.
        
        Removes from registry and schedules conditional DB update.
        """
        self._experiments.pop(exp_id, None)
        asyncio.create_task(self._set_experiment_stopped(exp_id, last_error=last_error))

    async def _set_experiment_stopped(self, exp_id: int, *, last_error: str | None) -> None:
        """Update DB, but only if we still own it (conditional update)."""
        if last_error:
            logger.warning(f"Experiment {exp_id} stopping with error: {last_error}")
        stmt = (
            update(ExperimentExecutionConfig)
            .where(experiment_id == exp_id)
            .where(claimed_by == self._replica_id)  # CONDITIONAL
            .values(claimed_at=None, claimed_by=None, last_error=last_error)
        )
        await session.execute(stmt)
```

### Why This Design Works

| Scenario | What happens | Result |
|----------|--------------|--------|
| Natural completion | `_on_experiment_done()` with conditional update | Succeeds (we own it) |
| Circuit breaker | `_on_experiment_done(error)` with conditional update | Succeeds (we own it) |
| User stop (same replica, we own it) | Mutation does unconditional update | Succeeds |
| User stop (same replica, lost ownership) | Mutation does unconditional update | Succeeds (overrides stale state) |
| User stop (cross-replica) | Mutation does unconditional update | Succeeds |
| Heartbeat (lost to user stop) | `stop_experiment()` in-memory only | DB already NULL |
| Heartbeat (lost to orphan scan) | `stop_experiment()` in-memory only | DB has new owner, we don't clobber |
| Graceful shutdown | `_graceful_shutdown()` calls `stop()` | DB unchanged, resumes on restart |

---

## Multi-Replica Coordination

### How Ownership Works

The database is the source of truth for ownership:
- `claimed_by`: Which replica owns the experiment
- `claimed_at`: When it was claimed (NULL = not running)

Each replica has a unique ID. Heartbeat periodically updates `claimed_at` to prove liveness.

### Detecting Lost Ownership

Heartbeat does:
```sql
UPDATE experiment_execution_config
SET claimed_at = now()
WHERE claimed_by = 'replica-A'
  AND experiment_id IN (list of our experiments)
RETURNING experiment_id
```

If an experiment isn't returned, we lost ownership. Possible reasons:
1. User stopped it (claimed_by = NULL)
2. Another replica claimed it (claimed_by = 'replica-B')
3. Experiment was deleted

In all cases, the DB was already updated. We just need in-memory cleanup.

### Cross-Replica User Stop

```
Replica A: Running experiment 123 (claimed_by = "A")
Replica B: User clicks "Stop"

1. B's mutation: UPDATE SET claimed_at=NULL, claimed_by=NULL (unconditional)
2. B's stop_experiment(123): exp not in B's registry → in-memory no-op
3. A's heartbeat: UPDATE WHERE claimed_by="A" → 123 not returned
4. A's stop_experiment(123): removes from registry, calls exp.stop()
```

B's mutation does the DB update (unconditional). A only does in-memory cleanup.

### Same-Replica User Stop with Stale Registry

```
Replica A: Running experiment 123 (claimed_by = "A", in A's registry)
Replica B: Claims via orphan scan (claimed_by = "B") — A doesn't know
User on A: Clicks "Stop"

1. A's mutation: UPDATE SET claimed_at=NULL, claimed_by=NULL (unconditional)
   → Succeeds! B's claim is overridden.
2. A's stop_experiment(123): finds exp, calls exp.stop()
3. B's heartbeat: UPDATE WHERE claimed_by="B" → 0 rows (now NULL)
4. B's stop_experiment(123): removes from registry, calls exp.stop()
```

A's unconditional update works despite stale registry state. B detects via heartbeat.

### Stale Heartbeat (Orphan Scan)

```
Replica A: Running experiment 123 (claimed_by="A", claimed_at=T0)
Replica A: Network partition, heartbeat fails for 10+ minutes

1. Replica C's orphan scan finds stale claim (claimed_at < now - 10min)
2. C: UPDATE SET claimed_by="C", claimed_at=now
3. C: Starts running experiment 123
4. A: Network recovers, heartbeat runs
5. A's heartbeat: UPDATE WHERE claimed_by="A" → 0 rows (now owned by C)
6. A: Lost ownership, calls stop_experiment(123)
```

Brief split-brain (both ran the experiment), but:
- A's in-memory cleanup happens via heartbeat
- Duplicate work handled via upserts (idempotent DB writes)

### Why Internal Completion Uses Conditional Update

For natural completion and circuit breaker, we use conditional update:
```sql
UPDATE SET claimed_by=NULL WHERE experiment_id=123 AND claimed_by='A'
```

Why conditional (not unconditional like user stop)?

1. **We should own it**: If we just finished running the experiment, we should still own it
2. **Safe fallback**: If another replica claimed it during a network partition, the conditional update does nothing rather than clobbering their running experiment
3. **No user expectation**: Unlike user stop, there's no user waiting for confirmation — a silent no-op is acceptable

If C owns it, 0 rows updated. The experiment continues on C, which is correct.

### Why User Stop Uses Unconditional Update

For user stop, the mutation uses unconditional update:
```sql
UPDATE SET claimed_by=NULL WHERE experiment_id=123
```

Why unconditional (not conditional like internal completion)?

1. **User expectation**: User clicked Stop and expects the experiment to stop
2. **Stale registry**: The replica handling the request might have stale state
3. **Cross-replica**: The request might arrive at a replica that doesn't own the experiment

If we used conditional, the user's Stop request could silently fail. Unconditional guarantees the experiment stops.

---

## Concurrency Analysis

This section analyzes potential race conditions and edge cases from a distributed systems perspective.

### Race Conditions

#### Race 1: Mutation DB Update vs Heartbeat on Same Replica

```
1. Mutation: UPDATE SET claimed_by=NULL (succeeds)
2. Heartbeat runs before mutation calls stop_experiment()
3. Heartbeat: sees claimed_by=NULL, thinks "lost ownership"
4. Heartbeat: calls stop_experiment() — removes from registry
5. Mutation: calls stop_experiment() — not in registry, no-op
```

**Verdict**: Safe. In-memory cleanup happens via heartbeat instead of mutation. Same outcome.

#### Race 2: Two User Stops on Different Replicas

```
1. User on A clicks Stop, User on B clicks Stop (simultaneously)
2. A's mutation: UPDATE SET claimed_by=NULL — succeeds
3. B's mutation: UPDATE SET claimed_by=NULL — succeeds (idempotent)
4. Both call stop_experiment() — one finds it, one doesn't
```

**Verdict**: Safe. Both mutations succeed (idempotent), in-memory cleanup happens once.

**Note on Cooldown**: The `toggled_at` field implements a cooldown mechanism to prevent rapid state *flipping* between stop and resume. After a user-initiated state change (stop or resume), a brief cooldown period prevents the opposite operation. This protects against accidental double-clicks or UI race conditions. However, cooldown does NOT affect duplicate operations — two consecutive stops are allowed because they're the same operation, not a flip.

#### Race 3: User Stop vs Natural Completion

```
1. Experiment almost done, user clicks Stop
2. Mutation: UPDATE SET claimed_by=NULL (unconditional)
3. Completion: UPDATE SET claimed_by=NULL WHERE claimed_by='A' (conditional)
```

**Verdict**: Safe. Both updates result in claimed_by=NULL. Order doesn't matter.

#### Race 4: Heartbeat vs User Stop (Different Replicas)

```
1. User on B: UPDATE SET claimed_by=NULL
2. A's heartbeat: UPDATE SET claimed_at=now WHERE claimed_by='A'
```

If user stop wins first, heartbeat's WHERE clause fails (claimed_by is NULL, not 'A').
If heartbeat wins first, user stop overwrites with NULL.

**Verdict**: Safe. Both orderings result in experiment stopped.

#### Race 5: Orphan Scan vs User Stop

```
1. User on A clicks Stop
2. B does orphan scan, claims experiment (simultaneously)
```

**If A wins first**:
- A's mutation: `UPDATE SET claimed_by=NULL` succeeds
- B's orphan claim: `UPDATE ... WHERE claimed_at < cutoff` → 0 rows (A already cleared it)
- Result: Experiment stopped

**If B wins first**:
- B's claim: `UPDATE SET claimed_by='B', claimed_at=now` succeeds
- A's mutation: `UPDATE SET claimed_by=NULL` succeeds (unconditional)
- B's heartbeat: `WHERE claimed_by='B'` → 0 rows (now NULL)
- B detects lost ownership, calls `stop_experiment()`
- Result: Experiment stopped

**Verdict**: Safe. User stop's unconditional update ensures the experiment stops regardless of race outcome.

### Edge Cases

#### Edge Case 1: DB Update Succeeds, stop_experiment() Crashes

```
1. Mutation: UPDATE SET claimed_by=NULL (succeeds)
2. Server crashes before stop_experiment()
3. In-memory state "lost" (server crashed)
```

**Verdict**: Safe. Crash cleared in-memory state. On restart, experiment not in registry.

#### Edge Case 2: stop_experiment() Succeeds, DB Update Fails

```
1. Mutation: DB update fails (network error)
2. But stop_experiment() already ran (in-memory cleaned)
3. DB still says claimed_by='A'
4. Orphan scan eventually claims it
5. Another replica continues the work
```

**Verdict**: **Problematic**. User clicked Stop, but experiment continues elsewhere. Silent failure.

**Mitigation**: The design specifies mutation does DB update **first**, then stop_experiment(). If DB fails, return error to user without in-memory cleanup.

#### Edge Case 3: Heartbeat Latency Window

Between user stop (DB update) and heartbeat detection, the original replica continues processing. This is "wasted" work.

**Verdict**: Acceptable. Jobs take seconds anyway, heartbeat runs frequently. Wasted work is bounded and idempotent (upserts handle duplicates).

### Design Trade-offs (Considered and Rejected)

#### Fencing Tokens for Job Writes

**Scenario**: Stale replicas can write job results after losing ownership.

```
1. A claims experiment (claimed_by='A')
2. A's heartbeat fails, B claims (claimed_by='B')
3. A's network recovers, A thinks it still owns it
4. A completes a job, writes result to DB
5. Result is written even though A is stale
```

**Current implementation**: Job writes use upserts with unique constraint on `(experiment_id, dataset_example_id, repetition_number)`. Duplicate writes from stale replicas simply overwrite — no corruption, just redundant work.

**Alternative considered**: Add `claimed_by` check to job result writes (fencing):

```python
# Fencing approach (NOT implemented)
result = await session.execute(
    insert(ExperimentRun)
    .values(...)
    .on_conflict_do_update(...)
    .where(
        select(ExperimentExecutionConfig.claimed_by)
        .where(experiment_id == exp_id)
        .scalar_subquery() == self._replica_id
    )
)
if result.rowcount == 0:
    # We lost ownership, discard result
    return
```

**Why rejected**: 
1. Upserts already prevent data corruption
2. Duplicate work is bounded (heartbeat interval)
3. Fencing adds complexity with minimal benefit
4. Job writes would need additional DB round-trip or subquery

**Verdict**: Current upsert-based approach is sufficient. Trade-off accepted.

---

## Invariants and Guarantees

This section formally analyzes the safety and liveness properties of the stopping design.

### Safety Properties

Safety properties guarantee that "nothing bad happens."

#### S1: User Stop Completeness

> **If the mutation's DB update succeeds, the experiment will eventually stop on all replicas.**

**Proof**:
1. Mutation executes: `UPDATE SET claimed_by=NULL WHERE experiment_id=X`
2. This is unconditional — succeeds regardless of current owner
3. For any replica R running experiment X:
   - R's heartbeat executes: `UPDATE SET claimed_at=now WHERE claimed_by='R' AND experiment_id IN (...)`
   - Since `claimed_by=NULL` (not 'R'), experiment X is not returned
   - R detects lost ownership, calls `stop_experiment(X)`
   - R removes X from registry, calls `exp.stop()`
4. Therefore, all replicas eventually stop processing X ∎

**Dependencies**: Heartbeat runs periodically (liveness assumption)

#### S2: No Silent User Stop Failure

> **If mutation returns success to user, the experiment is stopped in DB.**

**Proof**:
1. Mutation executes DB update before returning
2. If DB update fails, mutation returns error (not success)
3. If mutation returns success, DB update succeeded
4. Therefore, `claimed_by=NULL` in DB ∎

**Corollary**: Combined with S1, user receiving success means experiment will stop.

#### S3: Internal Completion Doesn't Clobber

> **Natural completion / circuit breaker on replica A cannot stop an experiment owned by replica B.**

**Proof**:
1. Internal completion uses conditional update:
   `UPDATE SET claimed_by=NULL WHERE experiment_id=X AND claimed_by='A'`
2. If B owns X, then `claimed_by='B'` (not 'A')
3. WHERE clause fails, 0 rows updated
4. B's experiment continues unaffected ∎

**Why this matters**: During network partition, A might think it owns X while B actually does. This prevents A from clobbering B.

#### S4: Idempotent Stop Operations

> **Calling `stop()`, `stop_experiment()`, or `complete_experiment()` multiple times has the same effect as calling once.**

**Proof for `stop()`**:
1. First call: `_active` is True → set to False, cleanup runs
2. Subsequent calls: `_active` is False → early return, no-op ∎

**Proof for `stop_experiment()`**:
1. First call: `_experiments.pop(exp_id)` returns experiment → cleanup
2. Subsequent calls: `_experiments.pop(exp_id)` returns None → no-op ∎

**Proof for `complete_experiment()`**:
1. Calls `stop_experiment()` (idempotent by above)
2. DB update is idempotent (setting NULL to NULL is no-op) ∎

#### S5: Graceful Shutdown Preserves Resumability

> **After graceful shutdown, the experiment can resume on restart.**

**Proof**:
1. Graceful shutdown calls `exp.stop()` only (no DB update)
2. `claimed_by` remains set to this replica's ID
3. `claimed_at` becomes stale (no heartbeat)
4. On restart, orphan scan finds stale claim
5. Same or different replica can claim and resume ∎

**Note**: This is intentional — we want experiments to survive restarts.

**Caveat for fast restarts**: If a replica restarts within `STALE_CLAIM_TIMEOUT`, the claim isn't stale yet and orphan scan won't find it. The experiment waits until the claim becomes stale (worst case: `STALE_CLAIM_TIMEOUT` delay). This is a liveness trade-off: we prioritize safety (not reclaiming too eagerly) over immediate resume.

### Liveness Properties

Liveness properties guarantee that "something good eventually happens."

#### L1: Eventual In-Memory Cleanup

> **If `claimed_by=NULL` in DB, eventually no replica has the experiment in its registry.**

**Proof**:
1. Let t₀ be when `claimed_by` becomes NULL
2. Let T be the heartbeat interval
3. For any replica R with experiment in registry:
   - R's next heartbeat occurs at some t₁ ≤ t₀ + T
   - Heartbeat detects ownership loss (claimed_by ≠ 'R')
   - R calls `stop_experiment()`, removes from registry
4. By t₀ + T, all replicas have cleaned up ∎

**Bound**: Heartbeat interval (typically 30-60 seconds)

#### L2: Orphan Recovery

> **If a replica crashes while owning an experiment, another replica eventually claims it.**

**Proof**:
1. Let t₀ be when replica A crashes
2. A's `claimed_at` stops being updated (no heartbeat)
3. Let S be the stale threshold, O be the orphan scan interval
4. At some t₁ ≤ t₀ + S + O:
   - Orphan scan finds `claimed_at < now - S`
   - Scan claims experiment: `UPDATE SET claimed_by='B', claimed_at=now`
5. Experiment resumes on replica B ∎

**Bound**: Stale threshold + orphan scan interval (typically 10-15 minutes)

#### L3: Stop Propagation

> **User stop is reflected in all replicas within bounded time.**

**Proof**: Follows from S1 + L1.
1. By S1, DB is updated immediately
2. By L1, in-memory cleanup completes within heartbeat interval
3. Total propagation time ≤ heartbeat interval ∎

### What We Cannot Guarantee

#### No Duplicate Work During Transitions

> **During ownership transitions, two replicas may briefly process the same work.**

**Scenario**:
```
1. A owns experiment, processing job J
2. A's heartbeat fails (network partition)
3. B claims experiment via orphan scan
4. A's network recovers, A still has job J in flight
5. Both A and B may complete job J
```

**Why not preventable**: Without distributed locks or fencing tokens, we cannot prevent in-flight work from completing.

**Mitigation**: Idempotent writes (upserts) ensure duplicate completions don't corrupt data:
```sql
INSERT INTO experiment_runs (...)
ON CONFLICT (experiment_id, repetition_number, ...) 
DO UPDATE SET ...
```

#### Instantaneous Stop

> **User stop cannot instantly halt all in-flight work.**

**Reasons**:
1. Heartbeat-based detection has latency (L1 bound)
2. Shielded operations complete even after cancellation
3. Cross-replica communication is async

**Mitigation**: Acceptable for use case. Jobs are short-lived, results are idempotent.

### Formal Model Summary

| Property | Type | Guarantee | Bound |
|----------|------|-----------|-------|
| S1: User Stop Completeness | Safety | Stop reaches all replicas | - |
| S2: No Silent Failure | Safety | Success = DB updated | - |
| S3: No Clobbering | Safety | Conditional update protects | - |
| S4: Idempotent | Safety | Multiple calls = one call | - |
| S5: Resumability | Safety | Graceful shutdown preserves | - |
| L1: In-Memory Cleanup | Liveness | Eventually cleaned | Heartbeat interval |
| L2: Orphan Recovery | Liveness | Eventually claimed | Stale + scan interval |
| L3: Stop Propagation | Liveness | Eventually propagated | Heartbeat interval |

### Assumptions

The above guarantees depend on:

1. **DB Availability**: PostgreSQL is available and consistent
2. **Heartbeat Liveness**: Heartbeat task runs periodically without permanent failure
3. **Orphan Scan Liveness**: Orphan scan runs periodically
4. **Network Eventual Connectivity**: Partitions are temporary, not permanent
5. **Exception-Safe Cleanup Operations**: `CancelScope.cancel()` and `MemoryObjectSendStream.close()` do not throw exceptions. These are anyio primitives designed to be safe; if they were to throw, `stop()` cleanup would be partial.

If any assumption is violated, liveness properties may not hold (but safety properties still do).

---

### Robustness Assessment

| Concern | Status | Notes |
|---------|--------|-------|
| Basic race conditions | **Handled** | All identified races are safe |
| Crash recovery | **Handled** | Heartbeat/orphan scan provide eventual consistency |
| User stop silent failure | **Mitigated** | DB update before in-memory cleanup |
| Stale replica writes | **Handled** | Upserts prevent corruption; duplicate work bounded |
| Abstraction enforcement | **Weak** | Conceptual, not type-enforced |

**Overall**: The design is sound for the use case. Edge cases either have safe failure modes or are mitigated by existing mechanisms (heartbeat, orphan scan, idempotent writes).

---

## Known Limitations and Edge Cases

This section documents subtle issues that are either unmitigated by design or require explicit handling in implementation.

### Limitation 1: Circuit Breaker State Lost on Ownership Transfer

When a replica loses ownership (e.g., network partition → orphan scan), the new replica starts with a fresh circuit breaker counter:

```
1. A runs experiment, accumulates 3 failures (threshold is 5)
2. A's heartbeat fails, B claims via orphan scan
3. B starts fresh with 0 failures
4. Systemic issue persists → B takes another 5 failures to trigger circuit breaker
```

**Impact**: For systemic issues (bad API key, rate limit), this effectively doubles the wasted work before the circuit breaker activates.

**Why not mitigated**:
- Persisting failure count in DB adds complexity and round-trips
- The scenario requires both a systemic failure AND an ownership transfer
- The extra wasted work is bounded (at most 2x the threshold)

**Potential future mitigation**: Store recent failure timestamps in `experiment_execution_config`. New owner can check if recent runs failed and start with an elevated counter.

**Verdict**: Acceptable trade-off. Systemic failures are relatively rare, and the bounded extra work is preferable to the complexity of distributed circuit breaker state.

### Limitation 2: Error Recording Lost on Conditional Update Failure

When `complete_experiment()` is called with an error, but the conditional update fails (ownership was lost), the error message is discarded:

```python
async def complete_experiment(self, exp_id: int, error: str | None = None):
    self.stop_experiment(exp_id)
    await self._update_db_if_owned(exp_id, error)  # May affect 0 rows — error lost
```

**Scenario**:
```
1. A's circuit breaker fires with error "Rate limit exceeded"
2. B has already claimed the experiment (A doesn't know yet)
3. A's conditional update: WHERE claimed_by='A' → 0 rows
4. Error "Rate limit exceeded" is never recorded
5. B continues, eventually hits the same issue
```

**Impact**: Debugging may be harder — the first instance of a systemic error isn't recorded.

**Why not mitigated**:
- The alternative (unconditional error recording) could clobber B's running experiment
- B will eventually hit the same error and record it
- Logging locally provides an audit trail for operators

**Implementation note**: Implementations SHOULD log errors locally before attempting the conditional update:

```python
async def complete_experiment(self, exp_id: int, error: str | None = None):
    if error:
        logger.warning(f"Experiment {exp_id} stopping with error: {error}")
    self.stop_experiment(exp_id)
    await self._update_db_if_owned(exp_id, error)
```

**Verdict**: Acceptable. Error information is available in logs; the conditional update correctly prioritizes not clobbering active experiments.

### Limitation 3: Initialization Race Window

The design assumes experiments are in steady state when stopped. A race exists during initialization:

```
1. User starts experiment 123
2. Initialization begins (loading dataset, setting up queues)
3. User immediately clicks Stop
4. stop() is called mid-initialization
```

**Recommended implementation invariant**: Initialization code SHOULD check `_active` at key points:

```python
async def initialize(self):
    self._active = True  # Set early
    
    # Load dataset
    dataset = await self._load_dataset()
    if not self._active:
        return  # User stopped during load
    
    # Set up queues
    await self._setup_queues(dataset)
    if not self._active:
        return  # User stopped during setup
    
    # Begin processing
    await self._start_workers()
```

**Current implementation status**: NOT IMPLEMENTED. The current implementation does not check `_active` during initialization. This means:
- Users cannot effectively stop experiments during initialization
- The stop will only take effect after initialization completes
- This is acceptable because initialization is typically fast

**Verdict**: Low-priority improvement. The `_active` flag provides the mechanism; adding checks during initialization would improve responsiveness but is not critical.

### Summary of Limitations

| Limitation | Severity | Status |
|------------|----------|--------|
| Circuit breaker state lost | Medium | Accept bounded extra work; log for debugging |
| Error recording lost | Low | Log locally before conditional update |
| Initialization race window | Low | Not implemented; stop takes effect after init |
| Initialization race | Low | Check `_active` at initialization checkpoints |

These limitations are acceptable trade-offs given the complexity of distributed coordination. The design prioritizes correctness (no data corruption, no clobbering) over perfect error visibility.

---

## Summary

### The Core Insight

Stopping has two orthogonal dimensions:
1. **In-memory cleanup** — Do we have local state to clean up?
2. **DB update** — What authority does the caller have?

The key realization: **authority comes from the caller, not from inspecting state**.

| Authority | Caller | DB Update |
|-----------|--------|-----------|
| `OVERRIDE` | User stop | Unconditional |
| `RELEASE` | Natural completion, circuit breaker | Conditional |
| `CLEANUP` | Heartbeat, graceful shutdown | None |

Registry state tells us whether we have local cleanup to do. It does NOT tell us what DB operation to perform — that's determined by caller intent.

### Method Responsibilities

| Method | What it does | Who calls it |
|--------|--------------|--------------|
| `stop()` | In-memory cleanup | Everyone |
| `stop_experiment()` | Registry removal + `stop()` | Mutation, heartbeat |
| `_on_experiment_done()` | Registry removal + conditional DB | Natural completion, circuit breaker |
| `_set_experiment_stopped()` | Conditional DB update | `_on_experiment_done()` (internal) |
| `_graceful_shutdown()` | `stop()` on all experiments | Server shutdown |
| Mutation | Unconditional DB + `stop_experiment()` | User stop |

### Actor Summary

| Actor | In-memory | DB Update | Why |
|-------|-----------|-----------|-----|
| Natural completion | `_on_experiment_done()` | Conditional | We should own it; safe if we don't |
| Circuit breaker | `_on_experiment_done(error)` | Conditional | Same as above |
| User stop | Mutation + `stop_experiment()` | Unconditional | Must work with stale registry |
| Lost ownership | `stop_experiment()` | None | DB already updated by whoever |
| Graceful shutdown | `stop()` | None | Want to resume on restart |

### Key Properties

1. **Idempotent**: All methods safe to call multiple times
2. **Stale-safe**: User stop works even when registry is out of sync with DB
3. **Race-safe**: Internal completion won't clobber another replica's claim
4. **Consistent cleanup**: `stop()` always does same in-memory cleanup
5. **Clear responsibility**: Mutation owns user-stop DB semantics; runner owns internal completion

### Why Not Unify DB Updates in stop_experiment()?

We considered having `stop_experiment()` handle all DB updates with branching logic:
- In registry → conditional update
- Not in registry → unconditional update

This fails when user clicks Stop on a replica with stale registry (experiment in registry, but ownership lost). The conditional update silently fails, and the experiment continues on another replica.

The solution: mutation does its own unconditional update, then calls `stop_experiment()` for in-memory cleanup. This guarantees user stop always works.

---

## Implementation Verification Checklist

Use this section to verify that an implementation correctly follows this design. Each item should be checked against the actual code.

### Core Method Structure

- [x] **`RunningExperiment.stop()` exists** and performs in-memory cleanup only (no DB update)
- [x] **`stop()` has idempotency guard**: Early return if `_active` is already False
- [x] **`stop()` sets `_active = False`** before any cleanup
- [x] **`stop()` cancels all in-flight jobs** via cancel scopes
- [x] **`stop()` clears all queues**: task queue, eval queue, retry heap
- [x] **`stop()` closes all subscriber streams** so UI clients receive EndOfStream
- [x] **`stop()` does NOT call `on_done()`** or any completion callback

- [x] **`ExperimentRunner.stop_experiment(exp_id)` exists** and does registry removal + `stop()`
- [x] **`stop_experiment()` uses `pop()`** to atomically remove from registry (not `get()` then `del`)
- [x] **`stop_experiment()` does NOT update DB** — it's in-memory only

- [x] **`ExperimentRunner._on_experiment_done(exp_id, last_error)` exists** for internal completion
- [x] **`_on_experiment_done()` removes from registry** via `pop()`
- [x] **`_on_experiment_done()` schedules `_set_experiment_stopped()`** for async conditional DB update
- [x] **`_set_experiment_stopped()` uses CONDITIONAL DB update**: `WHERE claimed_by = self._replica_id`

### Mutation (User Stop)

- [x] **Stop mutation does UNCONDITIONAL DB update**: `UPDATE SET claimed_by=NULL WHERE experiment_id=X AND claimed_at IS NOT NULL` (no `claimed_by` condition)
- [x] **DB update happens BEFORE `stop_experiment()`**: If DB fails, return error without in-memory cleanup
- [x] **Mutation calls `stop_experiment()`** after DB update succeeds (for local in-memory cleanup)

### Heartbeat

- [x] **Heartbeat detects lost ownership** when experiment not returned from UPDATE RETURNING
- [x] **Heartbeat calls `exp.stop()` inline** (uses `pop()` + `stop()` directly, not `stop_experiment()`)
- [x] **Heartbeat does NOT update DB** for lost experiments — just in-memory cleanup

### Graceful Shutdown

- [x] **`_graceful_shutdown()` calls `stop()`** on all experiments
- [x] **Graceful shutdown does NOT update DB** — ownership preserved for resume
- [x] **Graceful shutdown waits for shielded operations** with timeout before force-cancelling

### In-Flight Job Handling

- [x] **DB writes use `shield=True`** (via `anyio.fail_after(timeout, shield=True)`)
- [x] **Job completion checks `_active`** before processing results
- [x] **Jobs discard results if `_active` is False** (experiment was stopped)

### Idempotency

- [x] **`stop()` is idempotent**: Multiple calls have same effect as one (via `_active` guard)
- [x] **`stop_experiment()` is idempotent**: `pop()` returns None on subsequent calls
- [x] **`_set_experiment_stopped()` is idempotent**: Conditional update is safe to repeat

### Error Handling

- [x] **Circuit breaker calls `on_done(last_error=...)`** with error message
- [x] **Error is logged locally** before conditional DB update (in case update fails)

### Multi-Replica Safety

- [x] **Conditional updates use `claimed_by = self._replica_id`** (not hardcoded)
- [x] **Unconditional updates (user stop) work cross-replica** — no `claimed_by` condition
- [x] **Job writes use upserts** to handle duplicate work from stale replicas

### Subscriber Cleanup

- [x] **`stop()` closes subscriber streams** (not just clears the list)
- [x] **Streams are closed with `.close()`** method (MemoryObjectSendStream)
- [x] **Subscriber list is cleared after closing** to allow garbage collection

### Initialization Safety

- [x] **`_active` is set to True** in `__init__`
- [ ] **Initialization checks `_active`** at key points (after async operations) — *not implemented*
- [ ] **Initialization exits early** if `_active` becomes False mid-initialization — *not implemented*

Note: Initialization safety checks are not currently implemented. This means users cannot stop experiments during initialization. This is a known limitation documented below.

### Logging

- [x] **`stop()` logs when called** (helps debug mysterious stops)
- [x] **Stop reason is traceable** (stack trace logged)
- [x] **Dropped work is logged**: pending tasks, evals, retries, in-flight count

---

### Verification Commands

To verify the implementation, an AI assistant should:

1. **Read the stop-related methods**:
   ```
   - RunningExperiment.stop()
   - ExperimentRunner.stop_experiment()
   - ExperimentRunner._on_experiment_done()
   - ExperimentRunner._set_experiment_stopped()
   - ExperimentRunner._graceful_shutdown()
   - The stop mutation in experiment_mutations.py
   - Heartbeat's lost-ownership handling (_heartbeat_loop)
   ```

2. **Search for potential violations**:
   ```
   - Any DB update in stop() or stop_experiment()? (Should be none)
   - Any unconditional DB update in _set_experiment_stopped()? (Should be conditional)
   - Any conditional DB update in stop mutation? (Should be unconditional w.r.t. claimed_by)
   - Any on_done() call in stop()? (Should be none)
   ```

3. **Trace each actor's path**:
   - Natural completion → `_on_experiment_done()` → `_set_experiment_stopped()` → conditional DB
   - Circuit breaker → `_on_experiment_done(error)` → `_set_experiment_stopped()` → conditional DB
   - User stop → mutation (unconditional DB) → `stop_experiment()`
   - Lost ownership → heartbeat detects → `pop()` + `stop()` → no DB
   - Graceful shutdown → `_graceful_shutdown()` → `stop()` on all → no DB

4. **Verify invariants hold**:
   - S1: User stop DB update is unconditional (w.r.t. claimed_by)
   - S3: Internal completion DB update is conditional (`WHERE claimed_by = self._replica_id`)
   - S4: All stop methods have idempotency (guards or atomic operations)
   - S5: Graceful shutdown preserves DB state
