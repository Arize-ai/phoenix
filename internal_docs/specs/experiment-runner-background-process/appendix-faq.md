# Appendix: Design FAQ

Frequently asked "why" questions about the experiment runner design, with answers.

---

## Table of Contents

1. [Constants](#constants)
   - [Why 5 consecutive failures for circuit breaker?](#why-5-consecutive-failures-for-circuit-breaker-trip)
   - [Why 10-minute stale claim timeout?](#why-10-minute-stale-claim-timeout)
   - [Why 30-second shield timeout?](#why-30-second-shield-timeout-for-db-writes)
   - [Why 20 max concurrent slots?](#why-20-max-concurrent-slots)
   - [Why 5-second cooldown?](#why-5-second-cooldown-on-stopresume-toggles)
2. [Architecture](#architecture)
   - [Why no LISTEN/NOTIFY?](#why-no-listennotify-for-cross-replica-coordination)
   - [Why let in-flight jobs complete?](#why-let-in-flight-jobs-complete-on-stop-instead-of-cancelling-them)
   - [Why separate circuit breakers?](#why-separate-circuit-breakers-for-tasks-and-evals)
   - [Why Advisor over Gatekeeper?](#why-advisor-pattern-over-gatekeeper)
3. [Gaps and Trade-offs](#gaps-and-trade-offs)
   - [What if initial token bucket rate is wrong?](#what-if-the-token-buckets-initial-rate-5-reqs-is-way-wrong)
   - [Why is retry backoff lost on resume?](#why-is-retry-backoff-state-lost-on-resume-acceptable)
   - [Why no queue state persistence?](#why-no-queue-state-persistence)
4. [Recommendations](#recommendations)
5. [Open Questions](#open-questions)

---

## Constants

### Why 5 consecutive failures for circuit breaker trip?

**Answer**: Balance between fast failure detection and tolerance for transient issues.

| Threshold | Behavior |
|-----------|----------|
| 1-2 | Too aggressive — one flaky request kills the experiment |
| 3-5 | Sweet spot — catches sustained failures, tolerates blips |
| 10+ | Too slow — wastes many requests before detecting outage |

5 failures at ~2 seconds each = ~10 seconds to detect an outage. Acceptable for background processing.

**Open question**: Should this be configurable per-provider? Some providers are flakier than others.

---

### Why 10-minute stale claim timeout?

**Answer**: Must be longer than any reasonable LLM request + retry sequence.

| Timeout | Risk |
|---------|------|
| 2 min | False positive — slow LLM requests (o1 thinking, complex prompts) may exceed this |
| 5 min | Still risky — a job with 3 retries at exponential backoff could hit this |
| 10 min | Safe — even worst-case retry sequences (1+2+4+8+16+32=63s) plus slow requests fit |
| 30 min | Too slow — crashed experiments take too long to resume |

The cost of a false positive (claiming an experiment that's actually running) is duplicate execution. The current implementation handles this via idempotent writes, but it wastes resources.

**Trade-off**: Users wait 10+ minutes for crashed experiments to resume. Acceptable for background processing.

---

### Why 30-second shield timeout for DB writes?

**Answer**: Defensive programming with a generous upper bound.

Normal DB writes take <100ms. The 30-second timeout is a safeguard against:
- Connection pool exhaustion causing queued writes
- Network partitions to database
- Database under extreme load

**Why not 5 seconds?** If writes regularly take >5s, something is wrong, but we'd rather complete the write than corrupt the connection pool. 30s gives maximum chance of success.

**⚠️ Yellow flag**: The original motivation was observed connection pool issues during cancellation. Modern async drivers (asyncpg, psycopg) should handle this correctly. We haven't root-caused the issue — this is a band-aid over an unknown problem.

**Recommendation**: Either reproduce the issue and prove the shield is necessary, or remove it. "Defensive programming" without understanding the threat is cargo cult.

---

### Why 20 max concurrent slots?

**Answer**: Empirically chosen based on typical deployment constraints.

| Factor | Consideration |
|--------|---------------|
| Memory | Each slot holds in-flight job state, chunks, etc. |
| DB connections | Each slot may need a connection for writes |
| Provider limits | Most providers allow 50-100+ RPM, so 20 slots won't bottleneck |
| Fairness | With round-robin, 20 slots across 5 experiments = 4 slots/experiment average |

**⚠️ Not based on formal benchmarking.** This is a guess that works for typical deployments.

**Recommendation**: Make this configurable. Hardcoded constants become technical debt when deployment requirements vary.

---

### Why 5-second cooldown on stop/resume toggles?

**Answer**: Prevents accidental double-clicks and UI race conditions.

| Cooldown | Effect |
|----------|--------|
| 0s | No protection — rapid clicking causes state thrashing |
| 1s | Still allows fast double-click |
| 5s | Enough to drain most in-flight jobs (LLM calls ~1-3s) |
| 30s | Annoying for legitimate use cases |

5 seconds is long enough to prevent accidents, short enough to not frustrate intentional toggles.

**Note**: Cooldown only applies to user-initiated toggles (stop mutation, resume mutation), not to initial start or internal completion.

---

## Architecture

### Why no LISTEN/NOTIFY for cross-replica coordination?

**Answer**: Heartbeat-based coordination is simpler and works with all databases.

| Approach | Pros | Cons |
|----------|------|------|
| LISTEN/NOTIFY | Instant notification | PostgreSQL-only, requires connection management |
| Heartbeat polling | Works everywhere, simple | 10-minute delay for crash recovery |

**Key insight**: Cross-replica stop doesn't need instant notification. The mutation updates `claimed_at=NULL` in the database, and the owning replica's heartbeat detects this within 5 minutes. For background processing, this delay is acceptable.

**LISTEN/NOTIFY was not implemented** — the spec mentioned it during design exploration, but the simpler heartbeat approach was chosen.

---

### Why let in-flight jobs complete on stop instead of cancelling them?

**Answer**: Clean completion is simpler than handling partial state.

| Approach | Pros | Cons |
|----------|------|------|
| Cancel immediately | Faster stop | Partial responses, complex cleanup, potential DB corruption |
| Let complete | Clean, predictable | 1-5 second delay |

LLM calls are typically 1-5 seconds. Waiting for them to complete is faster than implementing robust cancellation logic.

**What about 5-minute jobs?** Jobs have a 2-minute timeout. If a job exceeds this, it's cancelled via the timeout mechanism, not the stop mechanism.

---

### Why separate circuit breakers for tasks and evals?

**Answer**: Tasks and evals may use different providers.

| Scenario | Behavior with shared breaker | Behavior with separate breakers |
|----------|------------------------------|--------------------------------|
| Task uses OpenAI, eval uses Anthropic | OpenAI failure kills Anthropic evals | Only OpenAI tasks stop |
| Both use OpenAI | Same | Same |

**⚠️ Imprecise**: If both task and eval use OpenAI, they should share a circuit breaker. Currently they don't — you could have 5 task failures trip the task breaker while eval keeps hitting the same broken provider.

**Better design**: Per-provider circuit breakers shared across all experiments. Each provider has one breaker; any job using that provider checks and updates it.

**Current behavior**: Each experiment has two breakers. If task breaker trips, evals continue (even if they use the same provider). This is a known limitation.

---

### Why Advisor pattern over Gatekeeper?

**Answer**: Gatekeeper retries block execution slots.

See [appendix-rate-limiting.md](./appendix-rate-limiting.md#why-advisor-wins) for detailed analysis.

**The core problem**: In Gatekeeper, when a job hits 429, it retries internally with backoff (1s, 2s, 4s, 8s...). During this entire sequence, the execution slot is blocked doing nothing. Other experiments that could make progress are starved.

**Advisor solution**: Rate limit check happens at dispatch time. If no capacity, return `None` immediately. Slot stays free to serve other experiments.

**Was Gatekeeper benchmarked?** No formal benchmark. The theoretical analysis was sufficient — blocking slots during backoff is clearly wasteful when other work is available.

---

## Gaps and Trade-offs

### What if the token bucket's initial rate (5 req/s) is way wrong?

**Answer**: The adaptive algorithm adjusts, but initial requests may suffer.

**How it works**:
- Initial rate: 5 requests/second (conservative)
- On 429: Reduce rate by 50%
- On success: Gradually increase rate

**Worst case**: Provider allows 100 req/s, we start at 5. First few seconds are slow, but adaptation is fast.

**⚠️ Opposite worst case**: Provider allows 1 req/s (Gemini free tier is 2-5 RPM), we start at 5 req/s. First several requests will 429 before adaptation kicks in.

**Recommendation**: Initial rate should be per-provider. We have provider rate limit research (see rate-limiting appendix) — use it to set sensible defaults instead of one-size-fits-all 5 req/s.

---

### Why is retry backoff state lost on resume acceptable?

**Answer**: Token bucket state is preserved, which is what matters.

| State | Persisted? | Why |
|-------|------------|-----|
| Task queue position | No (re-queried from DB) | DB is source of truth |
| Retry count per job | No | Jobs are recreated on resume |
| Token bucket rate | Yes (in-memory, shared) | Adaptive rate survives across experiments |

**The scenario**: Experiment was backing off at 64 seconds, crashes, resumes at 1 second.

**Why it's okay**: The token bucket that caused the backoff is still rate-limited. Even if the job restarts at backoff=1s, the token bucket will reject it until capacity is available. No thundering herd.

**Trade-off**: Jobs may hit 429 immediately on resume and start backoff from scratch. This wastes a few requests but doesn't cause systemic issues.

---

### Why no queue state persistence?

**Answer**: Dramatically simpler, and the database is the source of truth anyway.

| Approach | Complexity | Failure modes |
|----------|------------|---------------|
| Persist queue state | High — serialize queues, retry heap, backoff timers | Stale state, desync with DB |
| Query from DB | Low — just query incomplete runs | None (DB is truth) |

**What's lost on crash**:
- Retry backoff position (acceptable — see above)
- Eval queue (acceptable — re-derived from completed tasks)
- In-flight jobs (acceptable — will be re-executed, idempotent writes)

**What's NOT lost**:
- Completed runs (in DB)
- Which tasks need execution (query incomplete runs)

The "query from DB" approach makes resume idempotent — you can resume the same experiment 10 times and get the same result.

---

## Recommendations

Based on this analysis:

1. **Root-cause the shield timeout** — Prove it's needed with a reproducible test, or remove it.

2. **Make constants configurable** — MAX_CONCURRENT, CIRCUIT_BREAKER_THRESHOLD, STALE_CLAIM_TIMEOUT should be environment variables or config.

3. **Per-provider circuit breakers** — Current task/eval split is imprecise. Future iteration should use per-provider breakers.

4. **Per-provider initial rates** — Use the provider research to set sensible defaults instead of 5 req/s for everyone.

5. **Add observability** — You need metrics to validate these numbers in production:
   - Circuit breaker trip rate
   - 429 rate per provider
   - Job latency p50/p95/p99
   - Slot utilization

## Open Questions

These are genuinely open, not just "should we fix this":

1. **Should we add LISTEN/NOTIFY?** Current 10-minute delay is probably fine for background processing, but some use cases may need faster coordination.

2. **Should we persist token bucket state to database?** Would allow rate adaptation to survive server restarts. Trade-off is added complexity.
