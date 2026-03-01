# Appendix: Rate Limiting, Architecture, and Edge Cases

> This appendix documents the architectural exploration and first-principles analysis that led to the experiment runner design. It covers rate limiting strategies, the Command Pattern for self-executing jobs, and comprehensive edge case handling.

---

## Table of Contents

1. [Mental Model: Food Delivery Service](#mental-model-food-delivery-service)
2. [First Principles](#first-principles)
3. [The Minimal Architecture](#the-minimal-architecture)
4. [The Command Pattern: Self-Executing Jobs](#the-command-pattern-self-executing-jobs)
5. [Two Approaches: Gatekeeper vs Advisor](#two-approaches-gatekeeper-vs-advisor)
6. [Why Advisor Wins](#why-advisor-wins)
7. [Abstraction Boundaries](#abstraction-boundaries)
8. [Circuit Breaker: Network Failure Handling](#circuit-breaker-network-failure-handling)
9. [Edge Cases](#edge-cases)
10. [Implementation Notes](#implementation-notes)

---

## Mental Model: Food Delivery Service

The clearest way to understand rate limiting approaches is through analogy:

```
Restaurants      = Experiments (sources of work)
Delivery Drivers = Concurrency slots (execution capacity)
Prep Time        = Rate limit (kitchen can only make N orders/hour)
Dispatch App     = Daemon (scheduler)
Order Slip       = Job (self-contained work unit)
```

**Gatekeeper approach**: Send driver to restaurant. If food not ready, driver waits.

```
Driver arrives at Restaurant A
→ "Food not ready" (429)
→ Driver waits 1 min, asks again
→ Still not ready, waits 2 min
→ Driver blocked for entire backoff

Meanwhile: Restaurant B has ready orders, but drivers are waiting at A.
```

**Advisor approach**: Only send driver when food is ready.

```
Driver asks dispatch for work
→ Dispatch checks: "Restaurant A ready?" No.
→ Dispatch checks: "Restaurant B ready?" Yes.
→ Driver sent to B, picks up immediately

Restaurant A's order queued for later when kitchen catches up.
```

**The key insight**: In the Advisor approach, the order slip (Job) contains everything needed—the driver just picks it up and delivers. The restaurant (Experiment) decides when an order is ready to go out.

| | Gatekeeper | Advisor |
|--|------------|---------|
| Driver during wait | Blocked at restaurant | Serving other restaurants |
| Retry state held by | Driver (waiting) | Restaurant (queued) |
| Restaurant B throughput | Reduced (fewer drivers) | Full (all drivers available) |

---

## First Principles

These foundational insights guide the entire design.

### 1. The End-to-End Principle

*From networking: "Put intelligence at the endpoints, keep the middle dumb."*

```
Endpoints (smart):     Experiment ←───────────────────→ LLM API
Middle (dumb):                    ←── Job ── Daemon ──→
```

| Component | Should be | Why |
|-----------|-----------|-----|
| **Experiment** | Smart | Knows tasks, retries, rate limits, callbacks |
| **Job** | Self-contained | Carries everything, reports itself |
| **Daemon** | Dumb | Just dispatches, enforces concurrency |

The "middle" (Daemon, Job execution) should be as dumb as possible. Intelligence lives at the edges.

### 2. Separation of Constraints

There are **three independent constraints**:

| Constraint | Source | Controlled by | Unit |
|------------|--------|---------------|------|
| **Rate limit** | External (provider) | Token bucket | Requests/second |
| **Concurrency** | Internal (resources) | Semaphore | Simultaneous requests |
| **Fairness** | Internal (UX) | Round-robin | Which experiment next |

These are **orthogonal**. Mixing them creates confusion. Each should be handled by a separate mechanism.

### 3. State Locality

*State should live where it's needed, nowhere else.*

| State | Lives in | Why there |
|-------|----------|-----------|
| Rate limit model | Token bucket (per provider) | Shared across experiments |
| Task queue | Experiment | Experiment owns its tasks |
| Retry queue | Experiment | Experiment decides retry policy |
| In-flight tracking | Experiment | Experiment needs to know |
| Concurrency count | Semaphore (global) | Shared resource |

**Key insight**: No state should live in the Job beyond execution lifetime. Jobs are transient.

### 4. Work Conservation

*The system should always be doing useful work if useful work exists.*

```
BAD:  Slots idle while work is ready (Gatekeeper blocking)
GOOD: If any experiment has ready work, something is executing it
```

This is why Advisor beats Gatekeeper—no slots blocked when other work is ready.

### 5. Minimal Coordination

*Coordinate only when necessary. Independent things should be independent.*

| Do these need to coordinate? | Answer |
|------------------------------|--------|
| Two experiments, different providers | **No** (no shared constraint) |
| Two experiments, same provider | **Yes** (shared rate limit) |
| Concurrency and rate limiting | **No** (orthogonal constraints) |

Experiments on different providers should be completely independent. The only coordination is through shared rate limits.

### 6. Information Hiding

| Component | Needs to know | Doesn't need to know |
|-----------|---------------|----------------------|
| **Experiment** | Its tasks, its provider, token bucket | Other experiments, concurrency limit |
| **Daemon** | Which experiments exist, concurrency limit | Task details, provider specifics |
| **Job** | How to execute, how to report | Other jobs, daemon, concurrency |
| **Token bucket** | Request rate | What requests are for |

The less each component knows, the cleaner the architecture.

### 7. What We're Actually Scheduling

Not tasks. Not workers. We're scheduling **execution permits**.

```
Execution permit = Rate capacity ∧ Concurrency capacity
```

A Job can execute when both gates are open:
1. **Rate**: Token bucket has capacity
2. **Concurrency**: Semaphore has permit

---

## The Minimal Architecture

Strip everything to essentials. Three concepts, no more.

### The Three Concepts

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   EXPERIMENT                                                    │
│   ══════════                                                    │
│                                                                 │
│   • Owns tasks (pending queue, retry queue, eval queue)         │
│   • Owns retry policy (max retries, backoff)                    │
│   • References shared token bucket (per provider)               │
│   • Creates self-executing Jobs                                 │
│   • Receives callbacks from Jobs                                │
│   • Handles short-circuiting (cached, invalid, etc.)            │
│                                                                 │
│   Interface:                                                    │
│     try_get_ready_job() → Job | None                            │
│     is_complete() → bool                                        │
│     cancel() → void                                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   DAEMON                                                        │
│   ══════════                                                    │
│                                                                 │
│   • Knows which experiments are running                         │
│   • Owns concurrency semaphore                                  │
│   • Enforces fairness (round-robin across experiments)          │
│   • Dispatches Jobs into execution                              │
│   • Handles graceful shutdown                                   │
│                                                                 │
│   Interface:                                                    │
│     run() → awaitable (main loop)                               │
│     shutdown() → void                                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   JOB                                                           │
│   ══════════                                                    │
│                                                                 │
│   • Self-contained (data + behavior + callbacks)                │
│   • Executes itself (Command Pattern)                           │
│   • Reports via callbacks (no return value)                     │
│   • Transient (no state survives execution)                     │
│                                                                 │
│   Interface:                                                    │
│     execute() → awaitable                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### What is a Job, Concretely?

A **Job** is the smallest unit of work that makes one LLM API call.

| Job Type | Definition | Identity |
|----------|------------|----------|
| **Task Job** | One dataset row × One repetition | `(experiment_id, row_id, repetition)` |
| **Eval Job** | One task result × One evaluator | `(experiment_id, row_id, repetition, evaluator_id)` |

**Example:**
```
Experiment:
  - Dataset: 100 rows
  - Repetitions: 3
  - Evaluators: 2 (correctness, relevance)

Task Jobs: 100 rows × 3 reps = 300 Jobs
Eval Jobs: 300 results × 2 evaluators = 600 Jobs (if all tasks succeed)
Total: up to 900 Jobs
```

**In the queues:**
```python
# Task queue: (row, repetition) pairs
_task_queue = [
    (row_1, rep_1), (row_1, rep_2), (row_1, rep_3),
    (row_2, rep_1), (row_2, rep_2), (row_2, rep_3),
    ...
]

# Eval queue: populated as tasks complete
_eval_queue = [
    (row_1_rep_1_result, correctness_evaluator),
    (row_1_rep_1_result, relevance_evaluator),
    ...
]
```

---

## The Command Pattern: Self-Executing Jobs

The Job is a **Command** (Gang of Four pattern)—an object that encapsulates everything needed to perform an action.

### TaskJob vs EvalJob

Task Jobs and Eval Jobs have different behaviors:

| Aspect | TaskJob | EvalJob |
|--------|---------|---------|
| **Input** | Dataset row + repetition | Task result + evaluator config |
| **Streaming** | Yes (chunks to UI) | No |
| **Output table** | `experiment_runs` | `experiment_run_annotations` |
| **Priority** | Lower | Higher (evals before new tasks) |

We use explicit types for clarity and type safety:

```python
@dataclass
class TaskJob:
    """
    Execute a task: one dataset row × one repetition.
    Streams chunks to UI during execution.
    """
    
    # Identity
    experiment_id: str
    row_id: str
    repetition: int
    
    # Input
    messages: list[Message]
    invocation_parameters: dict
    
    # Execution context
    client_factory: Callable[[], AsyncContextManager[Client]]
    is_rate_limit_error: Callable[[Exception], bool]
    timeout: float
    
    # Callbacks (closures over Experiment)
    on_chunk: Callable[[Chunk], Awaitable[None]]  # Required - tasks stream
    on_success: Callable[[Result], Awaitable[None]]
    on_rate_limit: Callable[[], Awaitable[None]]
    on_network_error: Callable[[Exception], Awaitable[None]]
    on_failure: Callable[[Exception], Awaitable[None]]
    on_timeout: Callable[[], Awaitable[None]]
    
    async def execute(self) -> None:
        """Execute task with streaming."""
        try:
            async with asyncio.timeout(self.timeout):
                async with self.client_factory() as client:
                    chunks = []
                    async for chunk in client.chat_stream(self.messages, **self.invocation_parameters):
                        chunks.append(chunk)
                        await self.on_chunk(chunk)  # Stream to UI
                    result = combine_chunks(chunks)
            await self.on_success(result)
        except asyncio.TimeoutError:
            await self.on_timeout()
        except Exception as e:
            if self.is_rate_limit_error(e):
                await self.on_rate_limit()
            elif self._is_network_error(e):
                await self.on_network_error(e)
            else:
                await self.on_failure(e)


@dataclass
class EvalJob:
    """
    Execute an evaluator on a task result.
    No streaming - evaluators run silently.
    """
    
    # Identity
    experiment_id: str
    row_id: str
    repetition: int
    evaluator_id: str
    
    # Input
    task_result: str  # Output from the task
    evaluator_template: str
    
    # Execution context
    client_factory: Callable[[], AsyncContextManager[Client]]
    is_rate_limit_error: Callable[[Exception], bool]
    timeout: float
    
    # Callbacks (no on_chunk - evals don't stream)
    on_success: Callable[[EvalResult], Awaitable[None]]
    on_rate_limit: Callable[[], Awaitable[None]]
    on_network_error: Callable[[Exception], Awaitable[None]]
    on_failure: Callable[[Exception], Awaitable[None]]
    on_timeout: Callable[[], Awaitable[None]]
    
    async def execute(self) -> None:
        """Execute evaluator without streaming."""
        try:
            async with asyncio.timeout(self.timeout):
                async with self.client_factory() as client:
                    result = await client.chat(self._build_eval_messages())
                    parsed = self._parse_eval_result(result)
            await self.on_success(parsed)
        except asyncio.TimeoutError:
            await self.on_timeout()
        except Exception as e:
            if self.is_rate_limit_error(e):
                await self.on_rate_limit()
            elif self._is_network_error(e):
                await self.on_network_error(e)
            else:
                await self.on_failure(e)


# Type alias for dispatch - Daemon doesn't care which type
Job = TaskJob | EvalJob
```

### Why This Is Powerful

| Benefit | Explanation |
|---------|-------------|
| **Self-contained** | Job has everything it needs. No external dependencies at execution time. |
| **Decoupled** | Experiment and Daemon never see each other. They only see Jobs. |
| **Testable** | Mock the callbacks, test Job in isolation. |
| **Provider-agnostic** | Daemon doesn't know about OpenAI vs Anthropic. Job handles it. |
| **Retriable** | On failure, Experiment creates a new Job. Old Job is garbage. |

### The Closure Pattern

Callbacks are closures that capture the Experiment's methods:

```python
class Experiment:
    def _create_task_job(self, row_id: str, repetition: int) -> TaskJob:
        return TaskJob(
            experiment_id=self.id,
            row_id=row_id,
            repetition=repetition,
            messages=self._build_messages(row_id),
            invocation_parameters=self._invocation_parameters,
            client_factory=self._client._client_factory,
            is_rate_limit_error=self._is_rate_limit_error,
            timeout=self._timeout,
            # Callbacks close over self and task identity
            on_chunk=lambda chunk: self._handle_chunk(row_id, repetition, chunk),
            on_success=lambda result: self._handle_task_success(row_id, repetition, result),
            on_rate_limit=lambda: self._handle_rate_limit(row_id, repetition),
            on_network_error=lambda e: self._handle_network_error(row_id, repetition, e),
            on_failure=lambda e: self._handle_task_failure(row_id, repetition, e),
            on_timeout=lambda: self._handle_timeout(row_id, repetition),
        )
    
    def _create_eval_job(self, row_id: str, repetition: int, evaluator: Evaluator, task_result: str) -> EvalJob:
        return EvalJob(
            experiment_id=self.id,
            row_id=row_id,
            repetition=repetition,
            evaluator_id=evaluator.id,
            task_result=task_result,
            evaluator_template=evaluator.template,
            client_factory=self._get_eval_client_factory(evaluator),  # May be different provider
            is_rate_limit_error=self._get_eval_rate_limit_error(evaluator),
            timeout=self._eval_timeout,
            # No on_chunk - evals don't stream
            on_success=lambda result: self._handle_eval_success(row_id, repetition, evaluator.id, result),
            on_rate_limit=lambda: self._handle_eval_rate_limit(row_id, repetition, evaluator.id),
            on_network_error=lambda e: self._handle_eval_network_error(row_id, repetition, evaluator.id, e),
            on_failure=lambda e: self._handle_eval_failure(row_id, repetition, evaluator.id, e),
            on_timeout=lambda: self._handle_eval_timeout(row_id, repetition, evaluator.id),
        )
```

The Job is a "self-addressed stamped envelope"—it knows where to deliver itself when done.

---

## Two Approaches: Gatekeeper vs Advisor

Both approaches use the **same token bucket algorithm**. They differ only in **when** the token check happens.

### Gatekeeper (Current PlaygroundRateLimiter)

Token check happens **at API call time**, inside a wrapper:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   DAEMON                              EXPERIMENT                │
│   ══════════                          ══════════                │
│                                                                 │
│   "any work?"  ────────────────────▶  "yes, here's a task"      │
│                                       (no rate check)           │
│                                                                 │
│   EXECUTION SLOT                                                │
│   ══════════════                                                │
│                                                                 │
│   Execute task                                                  │
│     │                                                           │
│     ▼                                                           │
│   ┌───────────────┐                                             │
│   │ Check token   │◀──── Rate check HERE (at call time)         │
│   │ bucket        │                                             │
│   └───────────────┘                                             │
│     │                                                           │
│     │ if no token: BLOCK & WAIT                                 │
│     │              (slot is idle)                               │
│     ▼                                                           │
│   LLM API                                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Problems:**
- Slot blocks waiting for tokens
- Blocked slot can't serve other experiments
- Retry loop is inside the slot (hidden, blocking)

### Advisor (Our Design)

Token check happens **at dispatch time**, in the Experiment:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   DAEMON                              EXPERIMENT                │
│   ══════════                          ══════════                │
│                                                                 │
│   "any work?"  ────────────────────▶  Check token bucket        │
│                                       │                         │
│                                       ▼                         │
│                                       Has capacity?             │
│                                       │                         │
│                                       ├── No  → return None     │
│                                       │                         │
│   ◀─────────────────────────────────  └── Yes → return Job      │
│                                                                 │
│   EXECUTION SLOT                                                │
│   ══════════════                                                │
│                                                                 │
│   job.execute()  ───────────────────▶  LLM API (no blocking)    │
│                                                                 │
│   if 429: job.on_rate_limit() ──────▶  Experiment requeues      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Slot never blocks on tokens
- If Experiment A is throttled, slots serve Experiment B
- Retry state is visible (in Experiment's queue)

### The Key Difference

| | Gatekeeper | Advisor |
|--|------------|---------|
| **Who queries token bucket** | Execution slot (at call time) | Experiment (at dispatch time) |
| **Slot behavior** | May block waiting for tokens | Never blocks |
| **Experiment interface** | "Has work?" | "Has **dispatchable** work?" |
| **Retry lives in** | Execution slot (hidden) | Experiment (visible queue) |

---

## Why Advisor Wins

### Problem 1: Cross-Provider Throughput Loss

```
Scenario:
  Exp A: OpenAI (throttled to 1 req/s)
  Exp B: Anthropic (100 req/s available)
  10 concurrent slots

Gatekeeper:
  5 slots get A tasks → block waiting for OpenAI tokens
  5 slots get B tasks → proceed
  B throughput: 50% (only 5 slots)

Advisor:
  Daemon asks A → no token → skip
  All 10 slots serve B
  B throughput: 100%
```

### Problem 2: Retry Blocking

```
Scenario:
  Slot hits 429, internal retry with backoff: 1s, 2s, 4s, 8s

Gatekeeper:
  Slot blocks for entire retry sequence (15+ seconds)
  Slot does NOTHING during backoff waits

Advisor:
  Slot reports 429 → job.on_rate_limit() → freed immediately
  Experiment requeues task for later
  Slot serves other tasks during backoff
```

### Problem 3: Cross-Experiment Interference

```
Scenario:
  Exp A: 1000 tasks, just hit 429, cooling down
  Exp B: 100 tasks, ready to go
  Same provider, shared slots

Gatekeeper:
  Slots on A tasks block during cooldown
  B slowed by A's throttling

Advisor:
  A says "no work ready" (no token)
  Slots serve B instead
```

### When Gatekeeper Is Fine

| Scenario | Gatekeeper problem? |
|----------|---------------------|
| Single experiment, single provider | Minimal (just retry blocking) |
| Dedicated slots per experiment (not shared) | No (blocking is isolated) |
| All experiments throttled equally | Minimal (no "other work" to do) |
| Unlimited concurrent slots | No (blocking doesn't reduce capacity) |

**Our context**: We have shared slots across multiple experiments with different providers. Advisor is the clear winner.

---

## Abstraction Boundaries

### The Four Abstractions

| Abstraction | Implementation | Responsibility |
|-------------|----------------|----------------|
| **Producer** | Experiment | Generate work, track state, manage retries |
| **Scheduler** | Daemon | Allocate slots, enforce fairness |
| **Executor** | Job | Execute work, report via callbacks |
| **External** | LLM API | Impose rate limits |

### Where the Token Bucket Fits

The token bucket is a **model of the external constraint**. It's not a decision-maker—it's an oracle that answers: "Is there capacity?"

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   DAEMON                         EXPERIMENT                     │
│   ══════════                     ══════════                     │
│                                                                 │
│   "any work?"                                                   │
│       │                                                         │
│       └─────────────────────────▶  try_get_ready_job()          │
│                                         │                       │
│                                         ▼                       │
│                                  ┌──────────────┐               │
│                                  │ Short-circuit│               │
│                                  │ checks       │               │
│                                  └──────┬───────┘               │
│                                         │                       │
│                                         ▼                       │
│                                  ┌──────────────┐   ┌─────────┐ │
│                                  │ Token bucket │◀──│ SHARED  │ │
│                                  │ has capacity?│   │ (per    │ │
│                                  └──────┬───────┘   │ provider│ │
│                                         │           └─────────┘ │
│                                         ▼                       │
│       ◀──────────────────────────  Job | None                   │
│                                                                 │
│                                         ▲                       │
│   JOB EXECUTION                         │ feedback              │
│   ═════════════                         │ (success/429/error)   │
│                                         │                       │
│   job.execute() ──────▶ LLM API ────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Experiment's Composite Interface

The Experiment encapsulates a composite question: "Do you have work that can be dispatched now?"

```python
class Experiment:
    def try_get_ready_job(self) -> Job | None:
        """Return a ready-to-execute Job, or None."""
        
        while self._has_pending_work():
            item = self._peek_next_item()
            
            # SHORT-CIRCUITS (no LLM call needed, no token consumed)
            if item.has_cached_result():
                self._dequeue_and_record_cached(item)
                continue
            
            if not item.is_valid():
                self._dequeue_and_record_invalid(item)
                continue
            
            # RATE LIMIT CHECK (needs LLM call)
            if not self._token_bucket.has_capacity():
                return None  # Has work, but can't proceed
            
            # DISPATCH
            self._token_bucket.consume()
            return self._create_job(self._dequeue(item))
        
        return None
```

This makes the Daemon simple—it just asks Experiments in round-robin order and dispatches whatever Jobs it gets.

---

## Circuit Breaker: Network Failure Handling

Network failures are different from rate limits:

| | Rate Limit (429) | Network Failure |
|--|------------------|-----------------|
| Provider status | Reachable, but busy | Unreachable |
| Error type | HTTP 429 | Connection error, timeout, DNS |
| Token bucket helps? | Yes (adapts rate) | No (not a rate issue) |
| Scope | Per-provider | Per-provider |
| Recovery | Automatic (tokens regenerate) | Requires network recovery |

### The Problem with Naive Retry

```
Network goes down
→ Job 1 fails (connection error) → retry
→ Job 2 fails (connection error) → retry
→ Job 3 fails (connection error) → retry
... 100 jobs all retrying into a dead network
→ Network recovers
→ 100 retries hit simultaneously (thundering herd)
```

### Solution: Circuit Breaker Pattern

Track consecutive failures per provider. After N failures, "open" the circuit:

```python
class ProviderHealthMonitor:
    """Circuit breaker for network failures. Per-provider."""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        cooldown_seconds: float = 30,
    ):
        self._consecutive_failures = 0
        self._circuit_open = False
        self._cooldown_until: float | None = None
        self._failure_threshold = failure_threshold
        self._cooldown_seconds = cooldown_seconds
    
    def is_healthy(self) -> bool:
        """Check if provider is healthy (circuit closed or half-open)."""
        if not self._circuit_open:
            return True
        
        # Half-open: allow one attempt after cooldown
        if time.time() >= self._cooldown_until:
            return True
        
        return False
    
    def record_success(self) -> None:
        """Provider responded. Close circuit."""
        self._consecutive_failures = 0
        self._circuit_open = False
    
    def record_network_error(self) -> None:
        """Network failure. Maybe open circuit."""
        self._consecutive_failures += 1
        if self._consecutive_failures >= self._failure_threshold:
            self._circuit_open = True
            self._cooldown_until = time.time() + self._cooldown_seconds
```

### Unified Rate Limiter

Combine rate limiting and circuit breaking in one component:

```python
class AdaptiveRateLimiter:
    """Handles both rate limits (429) and network failures."""
    
    def __init__(self, ...):
        # Rate limiting (token bucket)
        self._token_bucket = AdaptiveTokenBucket(...)
        
        # Circuit breaker (network health)
        self._health_monitor = ProviderHealthMonitor(...)
    
    def has_capacity(self) -> bool:
        """Check both rate capacity and network health."""
        # Circuit open? (network failure)
        if not self._health_monitor.is_healthy():
            return False
        
        # Rate limited? (429)
        return self._token_bucket.available_requests() > 1
    
    def consume(self) -> None:
        """Consume a token. Call after has_capacity() returns True."""
        self._token_bucket.tokens -= 1
    
    def on_success(self) -> None:
        """Request succeeded."""
        self._health_monitor.record_success()
    
    def on_rate_limit(self) -> None:
        """Got 429."""
        self._token_bucket.on_rate_limit_error(time.time())
    
    def on_network_error(self) -> None:
        """Network failure."""
        self._health_monitor.record_network_error()
```

### Flow with Circuit Breaker

```
Normal operation:
  Job succeeds → rate_limiter.on_success() → circuit stays closed

Network failure:
  Job 1 fails → rate_limiter.on_network_error() → failures=1
  Job 2 fails → rate_limiter.on_network_error() → failures=2
  ...
  Job 5 fails → rate_limiter.on_network_error() → failures=5 → CIRCUIT OPENS
  
  All experiments for this provider:
  try_get_ready_job() → rate_limiter.has_capacity() → False (circuit open)
  → No jobs dispatched, no wasted retries

After cooldown (30s):
  try_get_ready_job() → rate_limiter.has_capacity() → True (half-open)
  → One job dispatched (probe)
  
  If succeeds:
    rate_limiter.on_success() → circuit closes → normal operation
  
  If fails:
    rate_limiter.on_network_error() → circuit stays open → another cooldown
```

---

## Edge Cases

Comprehensive analysis of edge cases and how the design handles them.

### Lifecycle Edge Cases

#### 1. Graceful Shutdown

**Scenario**: Daemon receives SIGTERM. What happens to in-flight Jobs?

**Solution**: Wait for in-flight Jobs with timeout, then let crash recovery handle stragglers.

```python
async def run(self):
    try:
        while not self._shutdown_requested:
            await self._dispatch_loop_iteration()
    finally:
        # Wait for in-flight jobs (with timeout)
        try:
            await asyncio.wait_for(
                self._wait_for_in_flight_jobs(),
                timeout=30
            )
        except asyncio.TimeoutError:
            # Timed out. Let crash recovery handle remaining.
            pass
```

**Design survives**: ✅ Jobs either complete or crash recovery handles them.

#### 2. Cancellation

**Scenario**: User cancels experiment. What happens to in-flight Jobs?

**Solution**: Two-phase cancellation—flag + discard results.

```python
class Experiment:
    def cancel(self) -> None:
        self._cancelled = True
        # In-flight Jobs will complete, but results ignored

class Job:
    async def _handle_success(self, task_id, result):
        if self._experiment._cancelled:
            return  # Discard result
        await self._record_success(task_id, result)
```

**Design survives**: ✅ In-flight Jobs complete harmlessly.

#### 3. Crash Recovery

**Scenario**: Process crashes with Jobs in-flight.

**Solution**: DB-level tracking with `claimed_by` and `claimed_at`. On startup, detect stale claims.

```python
# On startup
stale_threshold = timedelta(minutes=10)
stale_experiments = await db.execute("""
    UPDATE experiment_execution_configs
    SET claimed_by = %(my_id)s, claimed_at = NOW()
    WHERE claimed_at < NOW() - %(threshold)s
    RETURNING id
""", {"my_id": replica_id, "threshold": stale_threshold})
```

**Design survives**: ✅ Jobs are transient; task state lives in DB.

### Resource Edge Cases

#### 4. Memory Pressure (Large Dataset)

**Scenario**: Experiment has 1M tasks. Loading all into memory is bad.

**Solution**: Pagination in Experiment.

```python
class Experiment:
    def __init__(self, batch_size=1000):
        self._task_buffer = deque()  # In-memory buffer
        self._db_offset = 0
        self._batch_size = batch_size
    
    def _ensure_buffer(self) -> None:
        if not self._task_buffer and self._has_more_in_db():
            tasks = self._load_batch(self._db_offset, self._batch_size)
            self._task_buffer.extend(tasks)
            self._db_offset += len(tasks)
```

**Design survives**: ✅ Implementation detail in Experiment.

#### 5. High Throughput (Fast Tasks)

**Scenario**: 1000 tasks complete per second. DB writes overwhelmed.

**Solution**: Batch writes in Experiment.

```python
class Experiment:
    def __init__(self):
        self._result_buffer = []
        self._flush_task: asyncio.Task | None = None
    
    async def _handle_success(self, task_id, result):
        self._result_buffer.append((task_id, result))
        if len(self._result_buffer) >= 100:
            await self._flush_results()
    
    async def _flush_results(self):
        if self._result_buffer:
            await self._db.bulk_insert(self._result_buffer)
            self._result_buffer.clear()
```

**Design survives**: ✅ Experiment controls batching strategy.

#### 6. DB Write Failure

**Scenario**: Job completes, but DB is down.

**Solution**: Fail the task. Crash recovery will re-run it. Idempotent writes handle duplicates.

```python
async def _handle_success(self, task_id, result):
    try:
        await self._write_to_db(task_id, result)
    except DBError as e:
        # Treat as failure. Task will be recovered and re-run.
        # Idempotent writes ensure no duplicates.
        logger.error(f"DB write failed for {task_id}: {e}")
        self._requeue(task_id)
```

**Design survives**: ✅ Crash recovery is the universal backstop.

### Error Edge Cases

#### 7. Poison Pill (Always-Failing Task)

**Scenario**: One task triggers a provider bug, fails every time.

**Solution**: Max retry limit per task.

```python
class Experiment:
    MAX_RETRIES = 3
    
    def _handle_failure(self, task_id, error):
        task = self._get_task(task_id)
        task.retry_count += 1
        
        if task.retry_count >= self.MAX_RETRIES:
            self._record_permanent_failure(task_id, error)
        else:
            self._requeue_with_backoff(task)
```

**Design survives**: ✅ Experiment controls retry policy.

#### 8. Partial Stream Failure

**Scenario**: Stream starts, some chunks sent to UI, then connection fails.

**Analysis**:
- UI sees: chunk1 → chunk2 → chunk3 → [error]
- Task retries: chunk1 → chunk2 → chunk3 → chunk4 → [success]
- UI might see partial, then full stream on retry

**Solution**: UI tracks task status, shows "retrying" state, handles duplicate streams.

**Design survives**: ✅ But UI needs to handle retry semantics.

#### 9. Provider Returns Invalid Response

**Scenario**: Provider returns garbage (invalid JSON, unexpected format).

**Solution**: Job validates response, reports as failure.

```python
class Job:
    async def execute(self):
        try:
            raw_result = await self._call_llm()
            validated = self._validate_response(raw_result)
            await self.on_success(validated)
        except ValidationError as e:
            await self.on_failure(e)
```

**Design survives**: ✅ Validation in Job.

### Short-Circuit Edge Cases

#### 10. Cached Result

**Scenario**: Task result is already cached (e.g., from previous run).

**Solution**: Short-circuit before rate limit check.

```python
def try_get_ready_job(self) -> Job | None:
    while self._task_queue:
        task = self._peek()
        
        if task.has_cached_result():
            self._dequeue()
            self._record_success(task.id, task.cached_result)
            continue  # No Job created, no token consumed
        
        # ... rest of logic
```

**Design survives**: ✅ No token consumed for cached results.

#### 11. Invalid Input

**Scenario**: Task input is malformed.

**Solution**: Short-circuit before rate limit check.

```python
if not task.is_valid():
    self._dequeue()
    self._record_failure(task.id, "Invalid input")
    continue  # No Job created, no token consumed
```

**Design survives**: ✅ Validation before rate limit check.

#### 12. Empty Dataset

**Scenario**: Experiment started with 0 tasks.

**Solution**: Immediately complete.

```python
def is_complete(self) -> bool:
    return (
        not self._task_queue and
        not self._eval_queue and
        not self._in_flight and
        not self._has_more_in_db()
    )
```

**Design survives**: ✅ Empty experiment completes immediately.

### Eval Edge Cases

#### 13. Eval After Task Failure

**Scenario**: Task failed. Should we run evals?

**Solution**: Usually no. Experiment decides.

```python
def _handle_task_success(self, task_id, result):
    self._record_result(task_id, result)
    # Queue evals
    for evaluator in self._evaluators:
        self._eval_queue.append((task_id, evaluator, result))

def _handle_task_failure(self, task_id, error):
    self._record_failure(task_id, error)
    # NO evals queued
```

**Design survives**: ✅ Experiment controls eval policy.

#### 14. Eval Uses Different Provider

**Scenario**: Task uses OpenAI, eval uses Anthropic.

**Solution**: Experiment checks the correct token bucket per provider.

```python
def try_get_ready_job(self) -> Job | None:
    # Evals - check EVAL's provider bucket
    if self._eval_queue:
        eval_item = self._eval_queue[0]
        bucket = self._get_bucket(eval_item.evaluator.provider)
        if bucket.has_capacity():
            bucket.consume()
            return self._create_eval_job(self._eval_queue.popleft())
    
    # Tasks - check TASK's provider bucket
    if self._task_queue:
        task = self._task_queue[0]
        bucket = self._get_bucket(self._task_provider)
        if bucket.has_capacity():
            bucket.consume()
            return self._create_task_job(self._task_queue.popleft())
    
    return None
```

**Design survives**: ✅ Experiment manages multiple token buckets.

### Timing Edge Cases

#### 15. Clock Skew (Multi-Replica)

**Scenario**: Different replicas have different clocks.

**Solution**: Use DB server timestamp, not local clock.

```python
# Instead of
UPDATE ... SET claimed_at = %(local_time)s

# Use
UPDATE ... SET claimed_at = NOW()  -- DB timestamp
```

**Design survives**: ✅ Implementation detail.

#### 16. Very Slow Tasks

**Scenario**: Tasks take 5+ minutes (complex reasoning).

**Solution**: Configurable timeout per Job.

```python
job = Job(
    ...,
    timeout=300,  # 5 minutes for complex tasks
    ...
)
```

**Design survives**: ✅ Timeout is configurable.

### Concurrency Edge Cases

#### 17. Lost Callback (Bug)

**Scenario**: Job completes, but callback raises exception.

**Solution**: Callback failures are bugs. Let them crash loud. Crash recovery handles the aftermath.

```python
async def execute(self):
    try:
        result = await self._call_llm()
    except ...:
        # Error handling
    
    # Callbacks - bugs should crash loud
    await self.on_success(result)  # If this fails, propagate
```

**Design survives**: ✅ Crash recovery is the universal backstop.

### Summary Table

| Edge Case | Category | Solution | Design Survives |
|-----------|----------|----------|-----------------|
| Graceful shutdown | Lifecycle | Wait + crash recovery | ✅ |
| Cancellation | Lifecycle | Flag + discard results | ✅ |
| Crash recovery | Lifecycle | DB `claimed_by`/`claimed_at` | ✅ |
| Memory pressure | Resource | Pagination | ✅ |
| High throughput | Resource | Batch writes | ✅ |
| DB write failure | Resource | Fail + re-execute | ✅ |
| Poison pill | Error | Max retry limit | ✅ |
| Partial stream | Error | UI handles retry state | ✅ |
| Invalid response | Error | Validation in Job | ✅ |
| Cached result | Short-circuit | Before rate limit check | ✅ |
| Invalid input | Short-circuit | Before rate limit check | ✅ |
| Empty dataset | Short-circuit | Immediate completion | ✅ |
| Eval after failure | Eval | Experiment decides | ✅ |
| Eval different provider | Eval | Multiple token buckets | ✅ |
| Clock skew | Timing | DB timestamp | ✅ |
| Slow tasks | Timing | Configurable timeout | ✅ |
| Lost callback | Concurrency | Crash loud + recovery | ✅ |

**All edge cases are handled by the design.**

---

## Implementation Notes

### Connecting to Current Codebase

The current `PlaygroundRateLimiter` and `PlaygroundStreamingClient` can be adapted:

#### Token Bucket Access

The token bucket already exists inside `PlaygroundRateLimiter`:

```python
# Current structure
class PlaygroundRateLimiter(RateLimiter, KeyedSingleton):
    def __init__(self, singleton_key, rate_limit_error):
        super().__init__(...)
        # Token bucket is in self._throttler

# Access for Experiment
class Experiment:
    def __init__(self, client: PlaygroundStreamingClient):
        self._token_bucket = client.rate_limiter._throttler
```

#### Unwrapping the Client

Current code wraps API calls with `_alimit`. For Advisor pattern, use raw client:

```python
# Current (Gatekeeper): Wrapped
async with self._client_factory() as client:
    throttled_create = self.rate_limiter._alimit(client.chat.completions.create)
    await throttled_create(...)

# New (Advisor): Raw
async with self._client_factory() as client:
    await client.chat.completions.create(...)  # No wrapper
```

#### Provider-Specific Error Handling

Job needs to classify errors. The client knows the provider-specific error type:

```python
class Job:
    def __init__(
        self,
        ...,
        rate_limit_error: type[Exception],  # e.g., openai.RateLimitError
    ):
        self._rate_limit_error = rate_limit_error
    
    def is_rate_limit_error(self, e: Exception) -> bool:
        return isinstance(e, self._rate_limit_error)
```

Or normalize errors in the client:

```python
class ProviderRateLimitError(Exception):
    """Unified rate limit error."""
    pass

class PlaygroundStreamingClient:
    async def chat_stream(self, ...):
        try:
            async for chunk in self._provider_client.stream(...):
                yield chunk
        except self._provider_rate_limit_error:
            raise ProviderRateLimitError()
```

### Instantiation Hierarchy

Understanding what is created when, and what is shared:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   SINGLETON (per rate-limit-key, shared across all experiments)             │
│   ═══════════════════════════════════════════════════════════               │
│                                                                             │
│   PlaygroundRateLimiter(key)  ◄─── Created once per key, lives forever      │
│       └── _throttler: AdaptiveTokenBucket                                   │
│                                                                             │
│   Keys:                                                                     │
│     "openai"                      ◄── All OpenAI models share               │
│     "anthropic"                   ◄── All Anthropic models share            │
│     "azure_openai:gpt-4-deploy"   ◄── Per deployment (see below)            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PER EXPERIMENT (created when experiment starts)                           │
│   ═══════════════════════════════════════════════                           │
│                                                                             │
│   PlaygroundStreamingClient  ◄─── Created via get_playground_client()       │
│       ├── _client_factory: Closure (captures credentials)                   │
│       ├── model_name, provider                                              │
│       └── rate_limiter: Reference to SINGLETON                              │
│                                                                             │
│   Experiment                                                                │
│       ├── _client: PlaygroundStreamingClient                                │
│       ├── _token_bucket: Reference to singleton's _throttler                │
│       ├── _task_queue, _eval_queue, _retry_queue                            │
│       └── create_job() method                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PER JOB (created on demand, transient)                                    │
│   ══════════════════════════════════════                                    │
│                                                                             │
│   Job  ◄─── Created by Experiment.try_get_ready_job()                       │
│       ├── task_id, input_data                                               │
│       ├── client_factory: Reference to client's factory                     │
│       ├── is_rate_limit_error: Callable                                     │
│       ├── callbacks: Closures over Experiment                               │
│       └── execute(): Creates raw client via factory                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PER EXECUTION (created and destroyed within Job.execute())                │
│   ════════════════════════════════════════════════════════════              │
│                                                                             │
│   Raw Provider Client (e.g., AsyncOpenAI)                                   │
│       └── Created fresh: async with client_factory() as client              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key points:**
- **Credentials** are captured once in the `client_factory` closure at experiment start
- **Token bucket** is shared across experiments using the same rate-limit key
- **Raw clients** are created fresh per Job execution (no stale connections)
- **Jobs** are cheap (just references to shared resources, no heavy initialization)

### Flexible Rate Limiter Keying

Current keying by provider is too coarse for some use cases:

| Provider | Rate Limit Scope | Current Key | Better Key |
|----------|------------------|-------------|------------|
| OpenAI | Per-organization | `"openai"` | `"openai"` ✅ |
| Anthropic | Per-organization | `"anthropic"` | `"anthropic"` ✅ |
| Azure OpenAI | **Per-deployment** | `"azure_openai"` ❌ | `("azure_openai", deployment)` |
| Some APIs | Per-API-key | `provider` | `(provider, api_key_hash)` |

**Solution:** Determine key at client creation time:

```python
def get_rate_limiter_key(provider: str, model_name: str) -> str:
    """Determine rate limiter key based on provider's rate limit scope."""
    if provider == "azure_openai":
        # Azure rate limits are per-deployment
        return f"azure_openai:{model_name}"
    # Most providers are per-organization
    return provider

# In PlaygroundStreamingClient.__init__
self.rate_limiter = PlaygroundRateLimiter(
    get_rate_limiter_key(provider, model_name),
    rate_limit_error,
)
```

**Because Experiment creates Jobs and holds the client, the correct token bucket is automatically used.** No changes needed to Job or Daemon.

### No Polymorphic Workers

A key benefit of the Command Pattern: **dispatch becomes trivially simple**.

**Before (polymorphism in the dispatcher):**
```python
class Dispatcher:
    def dispatch(self, work: Work) -> None:
        if work.type == "openai_task":
            client = self._openai_client
            result = await client.chat(work.messages)
            await self._db.write_task_result(work.id, result)
        elif work.type == "anthropic_task":
            client = self._anthropic_client
            result = await client.messages(work.messages)
            await self._db.write_task_result(work.id, result)
        elif work.type == "eval":
            # Different logic...
```

**After (polymorphism in the command):**
```python
# Dispatcher knows NOTHING
async def dispatch(job: Job) -> None:
    await job.execute()

# All the "knowing" is in the Job, set at creation time
job = Job(
    client_factory=openai_factory,      # Knows how to get client
    messages=messages,                   # Knows what to send
    on_success=write_to_db,             # Knows what to do with result
    is_rate_limit_error=is_openai_429,  # Knows how to classify errors
)
```

**The inversion:**

```
BEFORE:                                 AFTER:
┌─────────────────────┐                 ┌─────────────────────┐
│   SMART DISPATCHER  │                 │   DUMB DISPATCHER   │
│                     │                 │                     │
│   if openai: ...    │                 │   job.execute()     │
│   if anthropic: ... │                 │                     │
│   if eval: ...      │                 │                     │
└─────────────────────┘                 └─────────────────────┘
          │                                       │
          ▼                                       ▼
┌─────────────────────┐                 ┌─────────────────────┐
│     DUMB WORK       │                 │     SMART JOB       │
│     (just data)     │                 │  (data + behavior   │
│                     │                 │   + callbacks)      │
└─────────────────────┘                 └─────────────────────┘
```

### The Essence of Command Pattern

The Command Pattern's fundamental insight:

> **Turn a method call into an object.**

When you do this:

| Without Command | With Command |
|-----------------|--------------|
| Caller knows what to call | Caller just calls `execute()` |
| Caller knows the arguments | Arguments are inside the object |
| Caller knows error handling | Error handling is inside the object |
| Polymorphism in the caller | Polymorphism in the command |
| Tight coupling | Complete decoupling |

**The deepest benefit:**

> **Make the thing being done smart, so the thing doing it can be dumb.**

This is exactly what Jobs achieve:
- **Job knows everything**: client factory, error types, callbacks, timeout
- **Dispatcher knows nothing**: just calls `execute()`
- **No switch statements** on provider type
- **No polymorphic dispatch** logic
- **Uniform interface** for all work types (task, eval, retry)

The Gang of Four lists these benefits:
- Parameterize objects with operations ✅ (each Job carries its operation)
- Queue or log requests ✅ (Jobs sit in queue, can be logged)
- Decouple invoker from receiver ✅ (Daemon doesn't know Experiment)

### Naming Conventions

For the self-executing work unit, we considered several names:

| Name | Pros | Cons |
|------|------|------|
| **Job** | Simple, universal (Celery, Sidekiq) | Generic |
| **Task** | Intuitive | Conflicts with `asyncio.Task` |
| **Command** | Pattern name, accurate | Abstract |
| **Errand** | Intuitive ("worker runs errands") | Informal |

**Recommendation**: Use **Job** for simplicity and familiarity.

---

## Summary

### Design Principles Validated

| Principle | Status |
|-----------|--------|
| End-to-End: Intelligence at edges | ✅ Experiment is smart, Daemon is dumb |
| Separation of Constraints | ✅ Rate, concurrency, fairness are orthogonal |
| State Locality | ✅ State lives in Experiment/DB, not Job |
| Work Conservation | ✅ Advisor never blocks slots |
| Minimal Coordination | ✅ Only coordinate through shared rate limits |
| Information Hiding | ✅ Components know only what they need |

### Edge Cases Handled

All 17 identified edge cases are handled by the design:
- Lifecycle (shutdown, cancellation, crash recovery)
- Resource (memory, throughput, DB failure)
- Error (poison pill, partial stream, invalid response)
- Short-circuit (cached, invalid, empty)
- Eval (failure, different provider)
- Timing (clock skew, slow tasks)
- Concurrency (lost callback)

**The design is robust and ready for implementation.**

---

## Provider Rate Limit Reference

This section documents how different LLM providers structure their rate limits, which informs rate limit bucket key construction.

### Summary Table

| Provider | Rate Limit Scope | Model-Specific? | Recommended Bucket Key |
|----------|-----------------|-----------------|------------------------|
| **OpenAI** | Per model, per organization | **Yes** | `(api_key, base_url, model_name)` |
| **Azure OpenAI** | Per deployment | **Yes** | `(endpoint, model_name)` |
| **AWS Bedrock** | Per model, per region | **Yes** | `(region, model_name, credential)` |
| **Google Gemini** | Per model, per project | **Yes** | `(api_key, model_name)` |
| **Anthropic** | Per organization | No (shared pool) | `(api_key)` |
| **xAI (Grok)** | Per model | **Yes** | `(api_key, model_name)` |
| **Groq** | Per model, per organization | **Yes** | `(api_key, model_name)` |
| **DeepSeek** | Per account (queue-based) | No | `(api_key)` |
| **Qwen (Alibaba)** | Per account | Likely | `(api_key)` |
| **Ollama** | Local (no limits) | N/A | `(base_url)` |
| **Fireworks** | Per account (RPM) | No | `(api_key)` |
| **Mistral** | Per organization | No | `(api_key)` |
| **Together AI** | Per account | No | `(api_key)` |
| **Lepton** | Per account (RPM) | No | `(api_key)` |
| **Cerebras** | Per model | **Yes** | `(api_key, model_name)` |
| **Replicate** | Per account | No | `(api_key)` |
| **Baseten** | Per account | No | `(api_key)` |

### Key Takeaways

1. **Model-specific bucketing needed for:** OpenAI, Azure, Bedrock, Google, xAI, Groq, Cerebras
2. **Organization-wide bucketing sufficient for:** Anthropic, DeepSeek, Qwen, Fireworks, Mistral, Together, Lepton, Replicate, Baseten
3. **No rate limiting needed for:** Ollama (local)

The primary distinction is whether different models within the same account/credential have **separate quotas** (requiring model in key) or **share a common pool** (API key sufficient).

### Provider Details

For detailed information on each provider's rate limit structure, tier levels, and sources, see the backup file at `backup/appendix-provider-rate-limits.md`.
