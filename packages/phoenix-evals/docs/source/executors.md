# Evals Executors

Under the hood, Phoenix uses **executors** to run evaluations faster and more
reliably. When you call `evaluate_dataframe` or any high-level evals API,
Phoenix automatically wraps the per-row evaluation function in an executor
that handles the infrastructure complexity for you:

- **Rate limit handling** — automatically retries when LLM providers throttle
  requests.
- **Error management** — distinguishes between transient failures and
  permanent errors so retries don't waste API budget.
- **Dynamic concurrency** — adjusts parallelism based on provider performance
  to maximize throughput without triggering rate limits.

This means you can run thousands of evaluations without writing any retry or
concurrency logic yourself.

This document specifies how the executor system works.

## Overview

The executor system lives in `phoenix.evals.executors` and exposes two
implementations behind a common `Executor` protocol:

```python
class Executor(Protocol):
    def run(self, inputs: Sequence[Any]) -> Tuple[List[Any], List[ExecutionDetails]]: ...
```

| Implementation  | When it's used                                                                 |
| --------------- | ------------------------------------------------------------------------------ |
| `AsyncExecutor` | Default. Used when an async generation function is available and the caller is on the main thread (or `nest_asyncio` is applied inside a notebook). |
| `SyncExecutor`  | Fallback. Used when called from a non-main thread, when `run_sync=True`, or when an event loop is already running without `nest_asyncio`. |

The factory `get_executor_on_sync_context(...)` selects the right
implementation automatically based on the runtime context.

Both executors return:

1. A list of outputs (one per input, in order). Failed/skipped slots hold the
   configured `fallback_return_value` (default: a sentinel `_unset`).
2. A parallel list of `ExecutionDetails` describing what happened for each
   input.

## Per-task result: `ExecutionDetails`

Every input gets an `ExecutionDetails` record:

| Field               | Meaning                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `status`            | One of `DID_NOT_RUN`, `COMPLETED`, `COMPLETED_WITH_RETRIES`, `FAILED`.   |
| `exceptions`        | Every exception observed across attempts for this input.                 |
| `execution_seconds` | Total wall-clock time spent in `generate(...)` for this input.           |

Status transitions:

- `DID_NOT_RUN` → initial state (e.g. when execution was terminated early).
- `COMPLETED` → succeeded on the first attempt.
- `COMPLETED_WITH_RETRIES` → eventually succeeded but had at least one failed
  attempt.
- `FAILED` → retries were exhausted, or a non-retryable error was raised.

## Error classification and retry policy

Both executors use the same exception classification:

- **`RateLimitError`** (from `phoenix.evals.rate_limiters`) — treated as a
  transient throttle. Retried with the same priority and (in the async
  executor) signaled to the concurrency controller as an error event.
- **`PhoenixException`** (other than `RateLimitError`) — treated as a
  *permanent* error (e.g. `PhoenixContextLimitExceeded`,
  `PhoenixTemplateMappingError`). **Retries are bypassed**: the task is failed
  immediately. This is what prevents wasted API budget on inputs that can
  never succeed.
- **Any other `Exception`** — treated as transient and retried (up to
  `max_retries`).

Retry budget is governed by `max_retries` (default `10`). After the budget is
exhausted the task is marked `FAILED`. If `exit_on_error=True` (the default),
the executor signals termination and returns whatever results it has
accumulated; otherwise it continues processing remaining inputs.

## `AsyncExecutor`

`AsyncExecutor` runs a coroutine `generation_fn(input) -> Any` over a
sequence of inputs using a producer–consumer pattern over an
`asyncio.PriorityQueue`.

### Configuration

```python
AsyncExecutor(
    generation_fn,
    concurrency=3,                  # max parallel workers
    tqdm_bar_format=None,           # progress bar (disabled if None)
    max_retries=10,
    exit_on_error=True,
    fallback_return_value=_unset,
    termination_signal=signal.SIGINT,
    timeout=60,                     # per-task timeout in seconds
    enable_dynamic_concurrency=True,
    dynamic_initial_target=None,
    dynamic_window_seconds=5.0,
    dynamic_increase_step=1,
    dynamic_decrease_ratio=0.5,
    dynamic_inactive_check_interval=1.0,
)
```

### Architecture

- **Producer.** Iterates the input sequence in order and pushes
  `(priority, (index, input))` onto the queue. The queue size is bounded
  (`max_queue_size = 5 * concurrency`) and the producer pauses fill at
  `max_fill = max_queue_size - 2 * concurrency`, leaving headroom for
  re-queues so retries never deadlock against a full queue.
- **Consumers.** `concurrency` worker coroutines run in parallel. Each worker
  loops:
  1. **Concurrency gate.** If dynamic concurrency is enabled and this
     worker's index is `>= target_concurrency`, it sleeps for
     `inactive_check_interval` seconds without touching the queue. Inactive
     workers don't pull work; they just wait.
  2. **Dequeue.** `await queue.get()` with a 1-second timeout (so the worker
     can periodically re-check termination / done conditions).
  3. **Run.** `asyncio.wait` on the generation task with `timeout=timeout`,
     racing it against a termination event watcher.
  4. **Outcome dispatch** (see below).
- **Termination.** SIGINT (or the configured signal, when running on the
  main thread) sets a termination event. Pending tasks are cancelled,
  remaining queue items are discarded, and the call returns with partial
  results.

### Outcome dispatch (per task)

| Outcome                   | Action                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generation succeeded      | Store result at `outputs[index]`, mark `COMPLETED` / `COMPLETED_WITH_RETRIES`, record success latency to the controller, advance progress bar.                  |
| Termination event set     | Cancel the in-flight task, mark queue item done, exit.                                                                                                          |
| Per-task `timeout` hit    | Cancel the task, **re-queue at the same priority** (timeouts don't count against `max_retries`), record a timeout event to the controller.                      |
| `RateLimitError` raised   | Re-queue with `priority - 1` (decremented retry counter), record an error event to the controller.                                                              |
| Permanent `PhoenixException` (non-rate-limit) | Bypass retries, mark task `FAILED`. Honor `exit_on_error`.                                                                                                      |
| Other `Exception` raised  | If `retry_count < max_retries`: re-queue with `priority - 1`. Else: mark `FAILED` and honor `exit_on_error`.                                                    |

The `priority` field doubles as a retry counter: each retry decrements it by
1 (so `abs(priority) == retry_count`), and lower-priority (i.e. retried)
items are dequeued *before* fresh items, which keeps the working set small
and finishes in-flight inputs first.

### Dynamic concurrency: `ConcurrencyController`

The async executor uses an **AIMD** (Additive Increase / Multiplicative
Decrease) controller — the same family of feedback algorithms used by TCP
congestion control — to adjust the number of *active* workers within a
fixed pool of `concurrency` coroutines.

Per feedback window (default 5 seconds):

- If **no errors or timeouts** were observed, increase the target by
  `+increase_step` (default `+1`).
- If **any errors or timeouts** were observed, multiply the target by
  `decrease_ratio` (default `0.5`).
- The target is clamped to `[1, max_concurrency]`.

The controller also has a **fast-collapse** safety: if
`collapse_error_threshold` errors occur within `collapse_window_seconds`
(default: 2 errors in 30s), the target snaps down to `1` immediately
without waiting for the window boundary. This prevents a burst of 429s
from amplifying while AIMD waits to react.

The controller additionally tracks an EMA-smoothed success latency
(`smoothing_factor=0.2`) for observability; it is not currently used to
drive concurrency directly but is recorded on every success.

Workers whose index falls above `target_concurrency` are *idle* — they
sleep instead of dequeuing — so adjusting the target instantly changes
how many tasks are in flight, without spawning or tearing down coroutines.

### Steady-state intuition

For a target error fraction `r_e` (the fraction of windows in which at
least one error is observed), AIMD settles around:

```
concurrency ≈ a * (1 - r_e) / ((1 - β) * r_e)
```

where `a = increase_step` and `β = decrease_ratio`. With defaults
`a=1, β=0.5`, the controller tends toward a single in-flight worker once
`r_e ≥ 2/3` — i.e. when roughly two thirds of windows see throttling, the
executor self-throttles to serial execution.

## `SyncExecutor`

`SyncExecutor` runs a synchronous `generation_fn(input) -> Any` sequentially
over the inputs. It supports the same retry policy and exception
classification, but has no concurrency controller (and therefore no AIMD,
no per-task timeout, and no priority queue).

```python
SyncExecutor(
    generation_fn,
    tqdm_bar_format=None,
    max_retries=10,
    exit_on_error=True,
    fallback_return_value=_unset,
    termination_signal=signal.SIGINT,
)
```

For each input it tries up to `max_retries + 1` times. A non-rate-limit
`PhoenixException` is re-raised immediately (no retries). On final failure,
the task is marked `FAILED`; `exit_on_error=True` returns the partial
results, otherwise the loop continues.

## Executor selection

`get_executor_on_sync_context` is the entry point used by Phoenix's
high-level evals APIs:

```python
get_executor_on_sync_context(
    sync_fn, async_fn,
    run_sync=False,
    concurrency=3,
    tqdm_bar_format=None,
    max_retries=10,
    exit_on_error=True,
    fallback_return_value=_unset,
    timeout=None,
)
```

Decision tree:

1. **Not on main thread** → `SyncExecutor` (no signal handling). A warning
   is emitted unless `run_sync=True`.
2. **`run_sync=True`** → `SyncExecutor` on the main thread.
3. **Event loop already running** (e.g. inside a notebook):
   - If `nest_asyncio` has been applied → `AsyncExecutor`.
   - Otherwise → `SyncExecutor`, with a warning recommending
     `nest_asyncio.apply()` for a substantial speedup.
4. **No running event loop** → `AsyncExecutor`, driven via `asyncio.run`.

## Guarantees and invariants

- **Order preservation.** Outputs are written by index, so
  `outputs[i]` always corresponds to `inputs[i]`, regardless of completion
  order.
- **Bounded memory.** The async queue is capped at `5 * concurrency`; the
  producer back-pressures at `max_fill` to leave room for re-queues.
- **Bounded retries.** Every retried task carries a priority that doubles as
  a retry counter; once `max_retries` is reached the task is failed rather
  than re-queued.
- **Permanent errors fail fast.** Non-rate-limit `PhoenixException`s skip
  the retry budget entirely.
- **Timeouts don't burn retries.** A per-task timeout re-queues at the same
  priority and is reported to the controller as a transient signal.
- **Clean shutdown.** SIGINT (main thread) sets a termination event;
  pending tasks are cancelled, remaining queue items are discarded, and
  partial results are returned with previously installed signal handlers
  restored.
