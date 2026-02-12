# OTel Context + Async Boundaries

This document is the single reference for why we use **explicit OpenTelemetry context** (no contextvars) across async boundaries in the Phoenix playground (chat, evaluators, streaming), and how we proved and designed around it. It covers the problem, root cause (CPython/asyncio), two possible fixes, why we chose the generator-side fix, and where the design is applied in code.

---

## 1. Problem statement

When using OpenTelemetry with `start_as_current_span` (or any API that relies on `contextvars`), the current context is stored in a contextvar. Across **async suspend/resume** (e.g. `async for chunk in stream()`), that context can change:

- **Generator side:** An async generator that sets a contextvar and gets a token, then `yield`s, may run its `finally` block in a **different** context after the consumer raises or exits. Calling `token.reset()` in that `finally` then raises: *"Token was created in a different Context"* (or OTel’s "Failed to detach context").
- **Consumer side:** The consumer (e.g. code that does `async for` over the generator) may also attach spans via contextvars; the same risk—cleanup running in a different context—can apply when crossing the async boundary.

**Mapping to our code:**

| Role       | Our code                     | Uses contextvars? (before fix) |
|-----------|------------------------------|--------------------------------|
| Generator | `chat_completion_create()`   | Yes (implicit current span)    |
| Consumer  | `evaluate()` (e.g. LLMEvaluator) | Yes (`start_as_current_span`) |

Goal: **prove** the failure mode with generic Python, understand **why** it happens (CPython + docs), then **design** so we never rely on contextvars across these boundaries.

---

## 2. Root cause: CPython and asyncio behavior

### 2.1 What we observe

When an async generator sets a contextvar and gets a token, then yields, and the consumer raises during `async for`, the generator’s `finally` runs later—in a different execution context—and `token.reset()` raises:

```text
ValueError: <Token ...> was created in a different Context
```

The check is in CPython `Python/context.c`:

```c
// PyContextVar_Reset():
PyContext *ctx = context_get();   // current context (from thread state)
if (ctx != tok->tok_ctx) {       // token's context (when set() was called)
    PyErr_Format(PyExc_ValueError,
                 "%R was created in a different Context", tok);
    return -1;
}
```

So the generator’s `finally` runs with a **different** current context than the one in which the token was created.

### 2.2 Why: `async for` does not call `aclose()` on exception

Relevant code: `Python/compile.c` (`compiler_async_for`) and `Python/ceval.c` (`END_ASYNC_FOR`).

- **Structure of `async for`:** `GET_AITER` → loop with `SETUP_FINALLY`, `GET_ANEXT`, `YIELD_FROM` (await), body, then **except block** with `END_ASYNC_FOR`. There is **no** call to `iterator.aclose()` in this flow.
- **What `END_ASYNC_FOR` does:** If the exception is `StopAsyncIteration`, it pops and continues. For **any other exception** (including `RuntimeError` in the body), it **re-raises** only. It does **not** call `iterator.aclose()`. So on exception the async generator is left open and is closed only when it is **finalized** (e.g. by GC).

### 2.3 How the generator actually gets closed: finalizer

From `Lib/asyncio/base_events.py`:

```python
def _asyncgen_finalizer_hook(self, agen):
    self._asyncgens.discard(agen)
    if not self.is_closed():
        self.call_soon_threadsafe(self.create_task, agen.aclose())
```

When the event loop has registered async-gen hooks (in `run_forever()`), the **finalizer** runs when the async generator is destroyed. It schedules `agen.aclose()` by creating a **new** Task:

- `self.create_task(agen.aclose())` creates a **new** `Task`.
- Each `Task` captures the **current** context at creation: `self._context = contextvars.copy_context()` (`Lib/asyncio/tasks.py`).
- So the task that runs `aclose()` has whatever context is **current** when the finalizer runs (e.g. a callback or the loop’s default context), **not** the original consumer task’s context.

When that task runs, it uses `context.run(callback)` (`Lib/asyncio/events.py` `Handle._run()`). So the generator’s code (including its `finally`) runs in that **new** task’s context. Hence:

- Token was created in **Context A** (original consumer task when the generator ran and called `cv.set()`).
- Generator’s `finally` runs in **Context B** (task created by the finalizer to run `aclose()`).
- `context_get()` returns B, `tok->tok_ctx` is A → "created in a different Context".

**Summary:** Exception in the consumer → `async for` does not call `aclose()` → generator is finalized later → finalizer runs `create_task(agen.aclose())` → generator’s `finally` runs in a new task with a different context.

*CPython reference paths:* `Python/context.c` (`PyContextVar_Reset`, `context_get()`), `Python/compile.c` (`compiler_async_for`), `Python/ceval.c` (`END_ASYNC_FOR`), `Lib/asyncio/base_events.py` (`_asyncgen_finalizer_hook`), `Lib/asyncio/tasks.py` (Task `copy_context()`), `Lib/asyncio/events.py` (`Handle._run()`).

---

## 3. Official Python documentation

The language and library docs describe this behavior and the fix:

- **[Asynchronous generator functions](https://docs.python.org/3/reference/expressions.html#asynchronous-generator-functions)** (Language reference):  
  If an asynchronous generator exits early (break, caller cancelled, or other exceptions), its async cleanup runs in an **unexpected context**—e.g. after the lifetime of tasks it depends on, or during event loop shutdown when the async-generator garbage collection hook is called. **The caller must explicitly close the async generator by calling `aclose()`** to finalize it and detach it from the event loop.

- **[contextlib.aclosing](https://docs.python.org/3/library/contextlib.html#contextlib.aclosing)** (Library):  
  Using `async with aclosing(agen):` ensures the generator’s async exit code is executed **in the same context as its iterations** (so that exceptions and context variables work as expected, and the exit code isn’t run after the lifetime of some task it depends on).

The language therefore gives two ways to avoid the problem: 1. **Caller:** Explicitly close the generator (e.g. `async with aclosing(stream): ...`).  
2. **Generator:** Do not rely on contextvars in its cleanup (use explicit context and manual span lifecycle). We chose (2) for the streaming client so we don’t depend on every consumer using `aclosing()`.

---

## 4. Empirical testing (generic Python, no OTel)

**Location:** `internal_docs/vignettes/otel-contextvars-async/contextvars_async_gen_demo.py` (this vignette).  
**Run from repo root:** `uv run python internal_docs/vignettes/otel-contextvars-async/contextvars_async_gen_demo.py` (no pytest: asyncio + assert only, to avoid confounders).

### 4.1 Scenarios in `run_empirical_tests()`

| Scenario | Outcome | Lesson |
|----------|--------|--------|
| Generator sets token, consumer raises **without** aclosing | Generator’s `reset(token)` **fails** ("different Context") | Plain `async for` + exception leaves generator to finalizer → different context. |
| Generator sets token, consumer raises **with** `async with aclosing(gen):` | Generator’s `reset(token)` **succeeds** | Explicit close in the same task keeps cleanup in the same context. |
| Consumer sets token, generator raises | Consumer’s `reset(token)` **succeeds** | We did not reproduce consumer-side token invalidation; avoiding contextvars in evaluate is defensive. |
| Normal exit (no exception) | Generator’s `reset(token)` **succeeds** | Failure is tied to exception/teardown path, not every suspend. |

From this we learn: the failure is reproducible and tied to the finalizer; aclosing fixes it empirically when the direct consumer uses it; the consumer’s token stayed valid in our scenarios (no consumer-side failure reproduced); the problem is exception/teardown-specific, not every suspend. The script runs print demos first, then these assertions.

**Why the consumer (evaluate) can use `start_as_current_span`:** The consumer is an async **function**, not an async generator. When the stream raises or the loop breaks, the exception propagates and the consumer's `with` blocks are exited by normal stack unwind—in the **same** task. So the consumer's contextvar token is still valid when its context manager runs `__exit__`. Our empirical tests (scenario 3–4) confirmed that the consumer's `reset(token)` succeeds. So `evaluate` could use `start_as_current_span`; we use explicit context there for consistency and defense in depth.

### 4.2 What aclosing can do for us

- **Caller-side fix:** If the consumer uses `async with aclosing(stream):` and then `async for chunk in stream: ...`, on break/raise/cancel the context manager awaits `stream.aclose()`. The generator’s `finally` runs in the **same task** (and same context), so any contextvar token in the generator is still valid.
- **Benefits:** (1) Explicit, prompt cleanup in the same task. (2) Same-context guarantee if we ever add context-dependent cleanup in the generator again. (3) Documented stdlib pattern.
- **Why we didn’t rely on it:** We have multiple call sites (evaluators, subscriptions, chat_mutations, playground_clients). Requiring every caller to use `aclosing()` would be easy to miss and wouldn’t help legacy or third-party consumers. Fixing the **generator** (no contextvars, explicit `otel_context`) makes the stream safe regardless of how the caller iterates. We can still add `aclosing` at our own call sites as optional reinforcement.

### 4.3 Two valid fixes (clarification)

**If we use `aclosing` at every call site** that does `async for` over the stream, we **do not** need to stop using `start_as_current_span` in the generator. With `aclosing`, the generator is closed by the same task that consumes it, so its `finally` runs in the same context and the contextvar token remains valid. So either fix is sufficient:

| Fix | What you do | Effect |
|-----|-------------|--------|
| **Caller-side** | Every consumer uses `async with aclosing(stream): async for ...` | Generator’s `finally` runs in same task/context → `start_as_current_span` in the generator is safe. |
| **Generator-side** (what we chose) | Generator uses explicit `otel_context` and `start_span(..., context=otel_context)`, no contextvars | Generator’s cleanup doesn’t depend on current context → safe regardless of whether the caller uses `aclosing`. |

We chose the generator-side fix so correctness doesn’t depend on every caller (including future or third-party code) remembering to use `aclosing`.

### 4.4 Why aclosing at our call sites was not enough (chain of generators)

In practice we added `aclosing(stream)` at every place that calls `chat_completion_create` (subscriptions, chat_mutations, evaluators, playground_clients), but the "Token was created in a different Context" error still occurred.

**Reason:** The **consumer** of our stream is often itself an **async generator** (e.g. a subscription handler that does `async for chunk in stream: yield chunk` to the client). So we have a chain: outer generator A (subscription) uses `async with aclosing(stream B): async for chunk in B: yield chunk`. When the client disconnects or the request is abandoned, the task driving A may be cancelled or A may be dropped. A is then closed only by the **finalizer**, which runs `create_task(A.aclose())` in a **new** task. That task runs A's `aclose()`, which exits A's `async with aclosing(B)` and calls `B.aclose()`. So B is closed from the finalizer's task, not from the original request task. B's `finally` (and thus OTel's detach) runs in the wrong context.

aclosing(B) does run, but it runs **inside** A's `aclose()`, which runs in the finalizer's task. The documentation's guarantee—"generator's finally runs in same task as its iterations"—applies to B only relative to the code that directly iterates B; that code is A's body. When A itself is finalized, that body is no longer running in the original task.

**Takeaway:** aclosing at the direct call site is not sufficient when the direct call site is an async generator that can itself be closed by the finalizer. The generator-side fix (no contextvars in B's cleanup) is required in that architecture.

### 4.5 Why the framework stack (Strawberry, Starlette, ASGI) matters

aclosing is not failing because Strawberry, Starlette, or the ASGI layer "break" it. We do use aclosing correctly around our stream (B): the code that does `async for chunk in stream` is the subscription resolver, and it runs `async with aclosing(stream): ...`. The nuance is **one level up**.

The **consumer** of our stream is the subscription resolver—an **async generator** (A) that yields chunks to the client. The thing that iterates that resolver is the framework (Strawberry’s subscription transport, on top of Starlette/ASGI). When the client disconnects or the request ends, that layer typically does **not** call `aclosing` on the subscription resolver. The resolver is dropped and later finalized. So:

- **We** close our stream (B) with aclosing; the code that iterates B is the resolver (A).
- **The framework** does not close the resolver (A) with aclosing; it leaves A to be garbage-collected and finalized.
- The finalizer then runs `A.aclose()` in a new task. That runs our `aclosing(B).__aexit__`, so B is closed there—in the wrong context.

So the stack below us is relevant not because it breaks aclosing, but because it **defines who iterates the subscription** and does **not** guarantee that that iterator (the resolver) is closed in the same task. The resolver is often left to the finalizer, so our stream ends up being closed from the finalizer’s task. The generator-side fix (no contextvars in B’s cleanup) is therefore required regardless of how the framework closes—or doesn’t close—the subscription.

---

## 5. Testing strategy

1. **Generic Python first** — Use only `contextvars` and async generators (no OTel) to prove that a token can be invalid after suspend + exception. This gives generalizable knowledge about Python.
2. **Map to our architecture** — Generator = streaming LLM client; consumer = evaluator or subscription handler. Design so the generator never attaches span via contextvars; pass explicit `OtelContext` and use `start_span(..., context=otel_context)` + manual `span.end()` in `finally`.
3. **Application tests** — Existing tests (e.g. `test_playground_clients.py`, evaluator tests, chat_mutations/subscriptions) verify that passing `otel_context` and using explicit spans produce the expected traces and no "Failed to detach context" or token errors.

---

## 6. Design decisions (summary)

| Component | Decision | Rationale |
|-----------|----------|-----------|
| **playground_clients.py** `chat_completion_create` | Accept `otel_context: OtelContext`; use `tracer.start_span(..., context=otel_context)` and `span.end()` in `finally`. No `start_as_current_span`. | Proven: generator’s contextvar token can be invalid in `finally` when consumer raises. |
| **evaluators.py** BuiltInEvaluators | Use `start_span(..., context=otel_context)` and `set_span_in_context` + `span.end()` in `finally`. No contextvars. | Consistency and no async generator in the hot path. |
| **evaluators.py** LLMEvaluator `evaluate` | Use explicit `otel_context` and `start_span` + pass same context into `chat_completion_create`. Prefer explicit span + `otel_context` for evaluate as well. | Defensive: same mechanism class; explicit context is safer. |
| **subscriptions.py / chat_mutations.py** | Create `OtelContext()` in the handler and pass it into stream helpers, `evaluate(..., otel_context=...)`, and `chat_completion_create(..., otel_context=...)`. | Single explicit context for the whole request; no contextvars across async boundaries. |

---

## 7. References

- **Phoenix code:** `src/phoenix/server/api/helpers/playground_clients.py`, `src/phoenix/server/api/evaluators.py`, `src/phoenix/server/api/subscriptions.py`, `src/phoenix/server/api/mutations/chat_mutations.py`.
- **Generic demo:** `internal_docs/vignettes/otel-contextvars-async/contextvars_async_gen_demo.py` — run from repo root: `uv run python internal_docs/vignettes/otel-contextvars-async/contextvars_async_gen_demo.py`.
- **Application tests:** `tests/unit/server/api/helpers/test_playground_clients.py`, `test_evaluators.py`, and tests that run the full chat/subscriptions flow with tracing.
- **CPython** (paths under a local cpython clone): `Python/context.c`, `Python/compile.c`, `Python/ceval.c`, `Lib/asyncio/base_events.py`, `Lib/asyncio/tasks.py`, `Lib/asyncio/events.py`.
- **Official docs:** [Asynchronous generator functions](https://docs.python.org/3/reference/expressions.html#asynchronous-generator-functions), [contextlib.aclosing](https://docs.python.org/3/library/contextlib.html#contextlib.aclosing).
