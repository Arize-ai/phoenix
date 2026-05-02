# Appendix: Experiment Lifecycle

> This document provides an overview of experiment lifecycle management. For formal analysis with proofs and edge cases, see the deep dives linked below.

---

## Overview

An experiment has three lifecycle phases:

| Phase | Trigger | Result |
|-------|---------|--------|
| **Start** | User clicks Run, or orphan scan recovers | Experiment claims ownership, begins processing |
| **Stop** | User clicks Stop, completion, circuit breaker, crash | Experiment releases ownership, stops processing |
| **Resume** | User clicks Resume, or orphan scan recovers | Same as Start (no queue state restored) |

---

## State Machine

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

**Key insight**: Running state is derived from `claimed_at`:
- `claimed_at = NULL` → Not running
- `claimed_at = recent` → Running (heartbeat refreshes this)
- `claimed_at = stale` → Orphaned (crashed replica)

---

## Stopping: The Five Actors

Five different actors can stop an experiment, each with different intentions:

| Actor | Intention | Updates DB? |
|-------|-----------|-------------|
| **Natural completion** | All work done, release ownership | Yes (conditional) |
| **Circuit breaker** | Too many failures, stop and record error | Yes (conditional) |
| **User stop** | User wants to pause | No (mutation did it) |
| **Lost ownership** | Another replica or user took over | No (already updated) |
| **Graceful shutdown** | Server shutting down, want to resume on restart | No (preserve ownership) |

**The key insight**: Authority comes from the caller, not from inspecting state.

For detailed analysis including race conditions, proofs, and implementation checklist, see:
- **[Stopping Deep Dive](./appendix-stopping-deep-dive.md)** (~1175 lines)

---

## Resuming: Atomic Claims

Resume is an atomic ownership transfer using `UPDATE...WHERE...RETURNING`:

```sql
-- Only succeeds if not currently running
UPDATE experiment_execution_configs
SET claimed_at = now(), claimed_by = replica_id
WHERE id = X AND claimed_at IS NULL
RETURNING *
```

If two replicas race to resume, database serialization ensures only one wins.

**Key insight**: Resume does NOT restore queue state. It queries incomplete runs fresh from the database.

For detailed analysis including multi-replica races, cooldown mechanism, and work reconstruction, see:
- **[Resume Deep Dive](./appendix-resume-deep-dive.md)** (~705 lines)

---

## Quick Reference: Code Patterns

### Stop Pattern

```python
def stop(self) -> None:
    """In-memory cleanup only. No DB update."""
    if not self._active:
        return  # Idempotent
    self._active = False
    
    # Cancel in-flight jobs
    for scope in self._cancel_scopes.values():
        scope.cancel()
    
    # Clear queues
    self._task_queue.clear()
    self._eval_queue.clear()
    self._retry_heap.clear()
    
    # Close subscriber streams
    for stream in self._subscribers:
        stream.close()
    self._subscribers.clear()
```

### Resume Pattern (Atomic Claim)

```python
# Atomic claim - only succeeds if not running
stmt = (
    update(ExperimentExecutionConfig)
    .where(experiment_id == exp_id)
    .where(claimed_at.is_(None))  # Only if stopped
    .values(claimed_at=now, claimed_by=replica_id)
    .returning(ExperimentExecutionConfig)
)
result = await session.execute(stmt)
if result.scalar_one_or_none() is None:
    # Already running (race condition handled)
    return
```

### Completion Detection

```python
def is_done(self) -> bool:
    if not self._active:
        return len(self._in_flight) == 0  # Just drain
    
    return (
        len(self._task_queue) == 0 and
        len(self._eval_queue) == 0 and
        len(self._retry_heap) == 0 and
        len(self._in_flight) == 0 and
        self._task_db_exhausted
    )
```

---

## Timelines

### Stop Timeline

```
t=0: User clicks Stop
     └─ Mutation: UPDATE SET claimed_at=NULL (unconditional)
     └─ daemon.stop_experiment(id)
     └─ experiment._active = False
     └─ Queues cleared, 3 jobs still in-flight

t=1: Job1 completes → on_success() → _active=False → discard result
t=2: Job2 completes → on_success() → _active=False → discard result
t=3: Job3 completes → on_success() → _active=False → discard result
     └─ _in_flight now empty
     └─ Experiment object GC'd
```

### Resume Timeline

```
t=0: User clicks Resume
     └─ Mutation: atomic claim (UPDATE WHERE claimed_at IS NULL)
     └─ Claim succeeds
     └─ start_experiment() creates RunningExperiment

t=1: Query incomplete runs from DB
     └─ Find tasks where successful_count < repetitions
     └─ Populate task queue

t=2: Dispatch loop resumes
     └─ Jobs dispatched in priority order
```

### Completion Timeline

```
t=0: Last TaskJob completes
     └─ on_success() writes result
     └─ Queues EvalJobs for this task
     └─ _check_completion() → not done (evals pending)

t=1: Last EvalJob completes
     └─ on_success() writes annotation
     └─ _check_completion() → done!
         └─ All queues empty ✓
         └─ No more in DB ✓

t=2: Finalization
     └─ on_done() callback
     └─ DB: claimed_at = NULL (conditional update)
     └─ Registry: experiment removed
     └─ Memory: Experiment object GC'd
```

---

## Invariants

| Invariant | Enforcement |
|-----------|-------------|
| Only one replica owns an experiment | Atomic `UPDATE...WHERE...RETURNING` |
| Status change → remove from registry | All stop paths use `pop()` |
| Stopped experiments don't queue work | Check `_active` in all callbacks |
| Resume is idempotent | Return success if already running |
| Work is never lost | Resume queries DB, not cached state |

---

## Related Deep Dives

| Document | Lines | Content |
|----------|-------|---------|
| [Stopping Deep Dive](./appendix-stopping-deep-dive.md) | ~1175 | Formal analysis of all 5 actors, race conditions, proofs, implementation checklist |
| [Resume Deep Dive](./appendix-resume-deep-dive.md) | ~705 | Atomic claims, cooldown mechanism, work reconstruction, multi-replica safety |
