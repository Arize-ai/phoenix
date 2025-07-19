from __future__ import annotations

import asyncio
import logging
import signal
import threading
import time
from contextlib import contextmanager
from enum import Enum
from typing import (
    Any,
    Callable,
    Coroutine,
    Generator,
    List,
    Optional,
    Protocol,
    Sequence,
    Tuple,
    Union,
)

from tqdm.auto import tqdm
import random

from phoenix.evals.exceptions import PhoenixException

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# ASCII timeline helper utilities
# ─────────────────────────────────────────────────────────────────────────────


def _ascii_timeline(
    details_list: List["ExecutionDetails"], *, width: int = 60, max_tasks: int = 20
) -> str:
    """Return an ASCII visualization of task lifecycles.

    Args:
        details_list: List of ExecutionDetails with populated ``events``.
        width: Width of the timeline in characters.
        max_tasks: Maximum number of task rows to render (to keep log output short).
    
    Legend:
        P = Produced/queued, Q = Dequeued, S = Started executing
        * = Executing, T = First timeout, B = Retry timeout (backoff)  
        W = Waiting/backoff period, R = Re-queued, E = Error, F = Fast completion S&C, C = Completed
    """

    # Gather all timestamps. If none yet, bail early.
    all_timestamps = [ts for d in details_list for _, ts in d.events]
    if not all_timestamps:
        return ""

    t0, t1 = min(all_timestamps), max(all_timestamps)
    span = max(t1 - t0, 1e-6)
    scale = (width - 1) / span

    # Priority so later significant symbols overwrite filler chars.
    _priority = {
        "P": 1,  # produced
        "Q": 2,  # dequeued
        "S": 3,  # started/executing
        "*": 0,  # filler during execution
        "W": 1,  # waiting/backoff filler
        "T": 4,  # timeout (first attempt)
        "B": 4,  # timeout on retry (backoff)
        "R": 3,  # re-queued
        "E": 4,  # error
        "F": 5,  # fast completion S&C (S+C in same position)
        "C": 5,  # completed
    }

    lines: List[str] = []
    for task_id, details in enumerate(details_list[:max_tasks]):
        events = sorted(details.events, key=lambda e: e[1])
        if not events:
            continue

        canvas = [" "] * width

        for idx, (tag, ts) in enumerate(events):
            col = int((ts - t0) * scale)
            col = max(0, min(width - 1, col))

            # Special case: if we're placing C and there's already S at this position, show as 'F' (Fast)
            if tag == "C" and canvas[col] == "S":
                canvas[col] = "F"
            # Draw the event itself
            elif _priority.get(tag, 0) >= _priority.get(canvas[col], 0):
                canvas[col] = tag

            # Fill execution span with '*'
            if tag == "S" and idx + 1 < len(events):
                next_ts = events[idx + 1][1]
                end_col = int((next_ts - t0) * scale)
                for c in range(col + 1, min(end_col, width - 1)):
                    if canvas[c] == " ":
                        canvas[c] = "*"
            
            # Fill backoff/wait span with 'W'
            if tag == "W" and idx + 1 < len(events):
                next_ts = events[idx + 1][1]
                end_col = int((next_ts - t0) * scale)
                for c in range(col + 1, min(end_col, width - 1)):
                    if canvas[c] == " ":
                        canvas[c] = "W"

        lines.append(f"T-{task_id:<3} │ {''.join(canvas)}")

    return "\n".join(lines)

# ─────────────────────────────────────────────────────────────────────────────
# Aggregate traffic bar (requests per time-slice)
# ─────────────────────────────────────────────────────────────────────────────


def _ascii_tickbar(
    details_list: List["ExecutionDetails"],
    *,
    width: int = 60,
    focus_tags: Tuple[str, ...] = ("S",),
) -> str:
    """Render a single row summarizing *request starts* density aligned with timeline above.

    Each column is a time slice that matches the timeline scale above. Character intensity 
    encodes how many events of *focus_tags* happened in that slice. This helps spot bursts / back-offs.

    Char scale (approx counts → glyph):
        0  → " "
        1  → "."
        2-4  → ":"
        5-9  → "|"
        10-19 → "*"
        20-49 → "#"
        ≥50  → "@"
    """

    # Flatten timestamps for selected tags
    timestamps: List[float] = []
    for d in details_list:
        timestamps.extend(ts for tag, ts in d.events if tag in focus_tags)

    if not timestamps:
        return ""

    # Use the same time scale as the timeline above for alignment
    all_timestamps = [ts for d in details_list for _, ts in d.events]
    if not all_timestamps:
        return ""
    
    t0, t1 = min(all_timestamps), max(all_timestamps)
    span = max(t1 - t0, 1e-6)
    
    # Use same scale as timeline: (width - 1) / span
    n_bins = width - 1
    bin_size = span / n_bins

    counts = [0] * n_bins
    for ts in timestamps:
        idx = int((ts - t0) * n_bins / span)
        idx = min(n_bins - 1, max(0, idx))
        counts[idx] += 1

    def glyph(c: int) -> str:
        if c == 0:
            return " "
        if c < 2:
            return "."
        if c < 5:
            return ":"
        if c < 10:
            return "|"
        if c < 20:
            return "*"
        if c < 50:
            return "#"
        return "@"  # 50+

    bar = "".join(glyph(c) for c in counts)
    return f"Ticks │ {bar}"


class Unset:
    pass


_unset = Unset()


class ExecutionStatus(Enum):
    DID_NOT_RUN = "DID NOT RUN"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_RETRIES = "COMPLETED WITH RETRIES"
    FAILED = "FAILED"


class ExecutionDetails:
    def __init__(self) -> None:
        self.exceptions: List[Exception] = []
        # Store full traceback strings corresponding to each exception for detailed debugging
        self.tracebacks: List[str] = []

        # Chronological log of attempts with rich metadata
        # Each item: {"attempt": int, "start": float, "end": float|None, "latency": float|None, "status": str, "snippet": str|None}
        self.attempt_history: List[dict] = []
        self.status = ExecutionStatus.DID_NOT_RUN
        self.execution_seconds: float = 0
        self.timeout_count: int = 0
        self.exception_count: int = 0

        # Timeline of lifecycle events for ASCII visualization
        self.events: List[Tuple[str, float]] = []

    def fail(self) -> None:
        self.status = ExecutionStatus.FAILED

    def complete(self) -> None:
        if self.exceptions:
            self.status = ExecutionStatus.COMPLETED_WITH_RETRIES
        else:
            self.status = ExecutionStatus.COMPLETED

    def log_exception(self, exc: Exception) -> None:
        import traceback
        self.exceptions.append(exc)
        # Capture and store the full traceback so we can display it later
        self.tracebacks.append("".join(traceback.format_exception(exc.__class__, exc, exc.__traceback__)))
        if isinstance(exc, TimeoutError):
            self.timeout_count += 1
        else:
            self.exception_count += 1

    def log_runtime(self, start_time: float) -> None:
        self.execution_seconds += time.time() - start_time

    def to_dict(self) -> dict:
        return {
            "status": self.status.value,
            "exceptions": [repr(e) for e in self.exceptions],
            "tracebacks": self.tracebacks,
            "timeout_count": self.timeout_count,
            "exception_count": self.exception_count,
            "execution_seconds": round(self.execution_seconds, 3),
            "attempt_history": self.attempt_history,
        }

    def log_event(self, tag: str) -> None:
        """Append a timestamped lifecycle *tag* (e.g., "P", "Q", "S", etc.)."""
        self.events.append((tag, time.time()))


class Executor(Protocol):
    def run(self, inputs: Sequence[Any]) -> Tuple[List[Any], List[ExecutionDetails]]: ...


class AsyncExecutor(Executor):
    """
    A class that provides asynchronous execution of tasks using a producer-consumer pattern.

    An async interface is provided by the `execute` method, which returns a coroutine, and a sync
    interface is provided by the `run` method.

    Args:
        generation_fn (Callable[[Any], Coroutine[Any, Any, Any]]): A coroutine function that
            generates tasks to be executed.

        concurrency (int, optional): The number of concurrent consumers. Defaults to 3.

        tqdm_bar_format (Optional[str], optional): The format string for the progress bar.
            Defaults to None.

        max_retries (int, optional): The maximum number of times to retry on exceptions.
            Defaults to 4.

        exit_on_error (bool, optional): Whether to exit execution on the first encountered error.
            Defaults to True.

        fallback_return_value (Union[Unset, Any], optional): The fallback return value for tasks
            that encounter errors. Defaults to _unset.

        termination_signal (signal.Signals, optional): The signal handled to terminate the executor.

        task_timeout (int, optional): The maximum time in seconds to wait for a task to complete.
            Defaults to 20.

        backoff_seconds (float, optional): The time to wait before retrying a timed-out task.
            Defaults to 0.0.
    """

    def __init__(
        self,
        generation_fn: Callable[[Any], Coroutine[Any, Any, Any]],
        concurrency: int = 3,
        tqdm_bar_format: Optional[str] = None,
        max_retries: int = 4,
        exit_on_error: bool = True,
        fallback_return_value: Union[Unset, Any] = _unset,
        termination_signal: signal.Signals = signal.SIGINT,
        task_timeout: int = 20,
        backoff_base: float = 1.0,
        max_backoff: float = 60.0,
    ):
        self.generate = generation_fn
        self.fallback_return_value = fallback_return_value
        self.concurrency = concurrency
        self.tqdm_bar_format = tqdm_bar_format
        self.max_retries = max_retries
        self.exit_on_error = exit_on_error
        self.base_priority = 0
        self.termination_signal = termination_signal
        self.task_timeout = task_timeout
        self.backoff_base = backoff_base
        self.max_backoff = max_backoff

    async def producer(
        self,
        inputs: Sequence[Any],
        queue: asyncio.PriorityQueue[Tuple[int, Any]],
        max_fill: int,
        done_producing: asyncio.Event,
        termination_signal: asyncio.Event,
        execution_details: List[ExecutionDetails],
    ) -> None:
        try:
            for index, input in enumerate(inputs):
                if termination_signal.is_set():
                    break
                while queue.qsize() >= max_fill:
                    # keep room in the queue for requeues
                    await asyncio.sleep(1)
                await queue.put((self.base_priority, (index, input)))
                execution_details[index].log_event("P")  # Produced / enqueued
        finally:
            done_producing.set()

    async def consumer(
        self,
        outputs: List[Any],
        execution_details: List[ExecutionDetails],
        queue: asyncio.PriorityQueue[Tuple[int, Any]],
        done_producing: asyncio.Event,
        termination_event: asyncio.Event,
        progress_bar: tqdm[Any],
    ) -> None:
        termination_event_watcher = None
        while True:
            marked_done = False
            try:
                priority, item = await asyncio.wait_for(queue.get(), timeout=1)
            except asyncio.TimeoutError:
                if done_producing.is_set() and queue.empty():
                    break
                continue
            if termination_event.is_set():
                # discard any remaining items in the queue
                queue.task_done()
                marked_done = True
                continue

            index, payload = item
            attempt_no = abs(priority)

            # Dequeued
            execution_details[index].log_event("Q")

            try:
                task_start_time = time.time()
                execution_details[index].log_event("S")  # Started executing
                generate_task = asyncio.create_task(self.generate(payload))
                termination_event_watcher = asyncio.create_task(termination_event.wait())
                done, pending = await asyncio.wait(
                    [generate_task, termination_event_watcher],
                    timeout=self.task_timeout,
                    return_when=asyncio.FIRST_COMPLETED,
                )

                if generate_task in done:
                    result_obj = generate_task.result()
                    outputs[index] = result_obj

                    # Try to extract OpenAI request id if available
                    rid: Optional[str] = None
                    try:
                        if hasattr(result_obj, "headers") and result_obj.headers is not None:
                            rid = result_obj.headers.get("x-request-id")
                        elif isinstance(result_obj, dict):
                            # common patterns: {'request_id': "..."} or {'id': "..."}
                            rid = result_obj.get("request_id") or result_obj.get("id")
                    except Exception:
                        pass
                    if rid:
                        rid = str(rid)[:8]

                    execution_details[index].complete()
                    execution_details[index].log_runtime(task_start_time)
                    execution_details[index].log_event("C")  # Completed
                    runtime = time.time() - task_start_time
                    tqdm.write(
                        f"✅ Task {index}-a{attempt_no}: Completed in {runtime:.2f}s"
                        + (f" rid={rid}" if rid else "")
                    )
                    progress_bar.update()
                    execution_details[index].attempt_history.append({
                        "attempt": attempt_no,
                        "start": task_start_time,
                        "end": time.time(),
                        "latency": runtime,
                        "status": "COMPLETED",
                        "snippet": (str(outputs[index])[:40] if isinstance(outputs[index], str) else None),
                        "rid": rid,
                    })
                elif termination_event.is_set():
                    # discard the pending task and remaining items in the queue
                    if not generate_task.done():
                        generate_task.cancel()
                        try:
                            # allow any cleanup to finish for the cancelled task
                            await generate_task
                        except asyncio.CancelledError:
                            # Handle the cancellation exception
                            pass
                    queue.task_done()
                    marked_done = True
                    continue
                else:
                    retry_count = abs(priority)
                    tqdm.write(f"Worker timeout after {self.task_timeout}s, requeuing (task {index}, attempt {retry_count + 1})")
                    
                    # Cancel the hanging task to prevent resource leaks
                    if not generate_task.done():
                        generate_task.cancel()
                        try:
                            await generate_task
                        except asyncio.CancelledError:
                            pass
                    
                    # Log the timeout as an exception for tracking
                    execution_details[index].log_exception(TimeoutError(f"Task timeout after {self.task_timeout}s"))
                    execution_details[index].log_runtime(task_start_time)
                    # Use different symbols for first timeout vs retries
                    if retry_count == 0:
                        execution_details[index].log_event("T")  # First timeout
                    else:
                        execution_details[index].log_event("B")  # Backoff timeout (retry)

                    execution_details[index].attempt_history.append({
                        "attempt": attempt_no,
                        "start": task_start_time,
                        "end": task_start_time + self.task_timeout,
                        "latency": self.task_timeout,
                        "status": "TIMEOUT",
                        "snippet": None,
                        "rid": None,
                    })
                    
                    # Check if we should keep retrying
                    if retry_count >= self.max_retries:
                        execution_details[index].fail()
                        tqdm.write(f"❌ Task {index}-a{attempt_no}: Max retries ({self.max_retries}) reached, FAILING permanently")
                        progress_bar.update()
                        continue
                    
                    # Exponential backoff with jitter
                    delay = min(self.max_backoff, self.backoff_base * (2 ** retry_count))
                    jittered_delay = delay * random.uniform(0.5, 1.5)
                    tqdm.write(
                        f"⏳ Backing off for {jittered_delay:.2f}s before retrying task {index} (attempt {retry_count + 1})"
                    )
                    execution_details[index].log_event("W")  # Start backoff wait
                    await asyncio.sleep(jittered_delay)
                    
                    # task timeouts are requeued with decreased priority (increased retry_count)
                    execution_details[index].log_event("R")  # Re-queued after backoff
                    await queue.put((priority - 1, item))
            except Exception as exc:
                execution_details[index].log_exception(exc)
                execution_details[index].log_runtime(task_start_time)
                execution_details[index].log_event("E")  # Generic error

                execution_details[index].attempt_history.append({
                    "attempt": attempt_no,
                    "start": task_start_time,
                    "end": time.time(),
                    "latency": time.time() - task_start_time,
                    "status": "ERROR",
                    "snippet": None,
                    "rid": None,
                })
                is_phoenix_exception = isinstance(exc, PhoenixException)
                if (retry_count := abs(priority)) < self.max_retries and not is_phoenix_exception:
                    tqdm.write(
                        f"Exception in worker on attempt {retry_count + 1}: raised {repr(exc)}"
                    )
                    tqdm.write("Requeuing...")
                    execution_details[index].log_event("R")  # Re-queued
                    await queue.put((priority - 1, item))
                else:
                    execution_details[index].fail()
                    tqdm.write(f"Retries exhausted after {retry_count + 1} attempts: {exc}")
                    # attempt history already recorded above for ERROR status
                    if self.exit_on_error:
                        termination_event.set()
                    else:
                        progress_bar.update()
            finally:
                if not marked_done:
                    queue.task_done()
                if termination_event_watcher and not termination_event_watcher.done():
                    termination_event_watcher.cancel()

    async def execute(self, inputs: Sequence[Any]) -> Tuple[List[Any], List[ExecutionDetails]]:
        import os
        print(f"🚀 New Version: AsyncExecutor with timeout leak fix is running! (timeout: {self.task_timeout}s)")
        print(f"🔍 Process PID: {os.getpid()} (use 'kill -9 {os.getpid()}' to force kill if needed)")
        print(f"📊 Starting execution: {len(inputs)} tasks, {self.concurrency} workers, {self.task_timeout}s timeout, {self.max_retries} max retries")
        termination_event = asyncio.Event()
        termination_handled = False

        def termination_handler(signum: int, frame: Any) -> None:
            nonlocal termination_handled
            if not termination_handled:
                termination_handled = True
                termination_event.set()
                tqdm.write("Process was interrupted. The return value will be incomplete...")
            else:
                tqdm.write("Additional interrupt signal received, already handling...")

        original_handler = signal.signal(self.termination_signal, termination_handler)
        outputs = [self.fallback_return_value] * len(inputs)
        execution_details = [ExecutionDetails() for _ in range(len(inputs))]
        progress_bar = tqdm(
            total=len(inputs),
            bar_format=self.tqdm_bar_format,
            disable=self.tqdm_bar_format is None,
        )

        max_queue_size = 5 * self.concurrency  # limit the queue to bound memory usage
        max_fill = max_queue_size - (2 * self.concurrency)  # ensure there is always room to requeue
        queue: asyncio.PriorityQueue[Tuple[int, Any]] = asyncio.PriorityQueue(
            maxsize=max_queue_size
        )
        done_producing = asyncio.Event()

        producer = asyncio.create_task(
            self.producer(inputs, queue, max_fill, done_producing, termination_event, execution_details)
        )
        consumers = [
            asyncio.create_task(
                self.consumer(
                    outputs,
                    execution_details,
                    queue,
                    done_producing,
                    termination_event,
                    progress_bar,
                )
            )
            for _ in range(self.concurrency)
        ]

        tqdm.write("🔄 All tasks submitted, waiting for completion...")
        await asyncio.gather(producer, *consumers)
        
        tqdm.write("🔄 Producer and consumers finished, waiting for queue to empty...")
        completed = sum(1 for d in execution_details if d.status != ExecutionStatus.DID_NOT_RUN)
        failed = sum(1 for d in execution_details if d.status == ExecutionStatus.FAILED)
        succeeded = sum(1 for d in execution_details if d.status in [ExecutionStatus.COMPLETED, ExecutionStatus.COMPLETED_WITH_RETRIES])
        pending = [i for i, d in enumerate(execution_details) if d.status == ExecutionStatus.DID_NOT_RUN]
        tqdm.write(f"📊 Pre-join status: {succeeded} success, {failed} failed, {len(pending)} pending, queue: {queue.qsize()}")
        if pending:
            tqdm.write(f"   📋 Pending before join: {pending}")
        
        join_task = asyncio.create_task(queue.join())
        termination_event_watcher = asyncio.create_task(termination_event.wait())
        
        # Add periodic status updates during queue.join() wait
        async def periodic_status():
            while not join_task.done() and not termination_event_watcher.done():
                await asyncio.sleep(2)  # Print every 2 seconds
                if not join_task.done():
                    completed = sum(1 for d in execution_details if d.status != ExecutionStatus.DID_NOT_RUN)
                    failed = sum(1 for d in execution_details if d.status == ExecutionStatus.FAILED)
                    succeeded = sum(1 for d in execution_details if d.status in [ExecutionStatus.COMPLETED, ExecutionStatus.COMPLETED_WITH_RETRIES])
                    pending = [i for i, d in enumerate(execution_details) if d.status == ExecutionStatus.DID_NOT_RUN]
                    tqdm.write(f"🔄 Cleanup status: {succeeded} success, {failed} failed, {len(pending)} pending, queue: {queue.qsize()}")
                    if pending:
                        tqdm.write(f"   📋 Pending tasks: {pending[:10]}{'...' if len(pending) > 10 else ''}")
                    # ASCII timeline snapshot (limited to first 20 tasks to avoid log spam)
                    timeline_snapshot = _ascii_timeline(execution_details, width=60, max_tasks=20)
                    if timeline_snapshot:
                        tqdm.write("\n" + timeline_snapshot + "\n")

                    tick_snapshot = _ascii_tickbar(execution_details, width=60, focus_tags=("S",))
                    if tick_snapshot:
                        tqdm.write(tick_snapshot + "\n")
        
        status_task = asyncio.create_task(periodic_status())
        
        # Add timeout to prevent infinite hangs
        timeout_task = asyncio.create_task(asyncio.sleep(30))  # 30 second timeout
        
        done, pending = await asyncio.wait(
            [join_task, termination_event_watcher, status_task, timeout_task], 
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel the status and timeout tasks
        if not status_task.done():
            status_task.cancel()
        if not timeout_task.done():
            timeout_task.cancel()
            
        if termination_event_watcher in done:
            tqdm.write("🛑 Termination event detected, cancelling remaining tasks...")
            # Cancel all tasks
            if not join_task.done():
                join_task.cancel()
            if not producer.done():
                producer.cancel()
            for task in consumers:
                if not task.done():
                    task.cancel()
        elif timeout_task in done:
            completed = sum(1 for d in execution_details if d.status != ExecutionStatus.DID_NOT_RUN)
            failed = sum(1 for d in execution_details if d.status == ExecutionStatus.FAILED)
            succeeded = sum(1 for d in execution_details if d.status in [ExecutionStatus.COMPLETED, ExecutionStatus.COMPLETED_WITH_RETRIES])
            pending = [i for i, d in enumerate(execution_details) if d.status == ExecutionStatus.DID_NOT_RUN]
            tqdm.write(f"⏰ TIMEOUT during cleanup! Final: {succeeded} success, {failed} failed, {len(pending)} pending, queue: {queue.qsize()}")
            if pending:
                tqdm.write(f"   📋 Still pending: {pending}")
            # Cancel join task and proceed
            if not join_task.done():
                join_task.cancel()
        else:
            tqdm.write("✅ Queue join completed successfully")

        if not termination_event_watcher.done():
            termination_event_watcher.cancel()

        # reset the SIGTERM handler
        signal.signal(self.termination_signal, original_handler)  # reset the SIGTERM handler
        
        # Print summary
        total_timeouts = sum(d.timeout_count for d in execution_details)
        total_failures = sum(1 for d in execution_details if d.status == ExecutionStatus.FAILED)
        # Count every retry (timeout or other exception) except the *final* successful attempt.
        total_retries = sum(d.timeout_count + d.exception_count for d in execution_details)
        completed_tasks = sum(1 for details in execution_details if details.status != ExecutionStatus.DID_NOT_RUN)
        pending_tasks = [i for i, details in enumerate(execution_details) if details.status == ExecutionStatus.DID_NOT_RUN]
        
        successful_tasks = sum(1 for details in execution_details if details.status in [ExecutionStatus.COMPLETED, ExecutionStatus.COMPLETED_WITH_RETRIES])
        tqdm.write(f"📊 FINAL SUMMARY: {successful_tasks} success, {total_failures} failed, {len(pending_tasks)} pending | {total_timeouts} timeouts, {total_retries} retries")
        if pending_tasks:
            tqdm.write(f"⚠️  Tasks that never completed: {pending_tasks[:10]}{'...' if len(pending_tasks) > 10 else ''}")
        if total_failures > 0:
            failed_tasks = [i for i, details in enumerate(execution_details) if details.status == ExecutionStatus.FAILED]
            tqdm.write(f"❌ Failed tasks: {failed_tasks[:10]}{'...' if len(failed_tasks) > 10 else ''}")

            # Print attempt table for first few failed tasks
            for task_id in failed_tasks[:3]:
                det = execution_details[task_id]
                tqdm.write(f"\n📜 Attempt history for task {task_id}:")
                for record in det.attempt_history:
                    lat = f"{record['latency']:.2f}s" if record['latency'] is not None else "-"
                    tqdm.write(
                        f"  a{record['attempt']}: {record['status']:<8} start={record['start']-det.attempt_history[0]['start']:+.2f}s lat={lat}"
                        + (f" snippet=\"{record['snippet']}\"" if record['snippet'] else "")
                    )

            # Print detailed traceback for each failed task (first 5 to avoid overwhelming logs)
            for task_id in failed_tasks[:5]:
                tb_list = execution_details[task_id].tracebacks
                if tb_list:
                    tqdm.write(f"\n🔍 Traceback for failed task {task_id} (most recent attempt):\n{tb_list[-1]}")

        # Print attempt history for tasks that succeeded but had timeouts
        successful_retried = [i for i, d in enumerate(execution_details) if d.status != ExecutionStatus.FAILED and d.timeout_count > 0]
        if successful_retried:
            tqdm.write(f"\n⏱️  Tasks that timed out but eventually succeeded ({len(successful_retried)}): {successful_retried[:10]}{'...' if len(successful_retried) > 10 else ''}")
            for task_id in successful_retried[:3]:
                det = execution_details[task_id]
                tqdm.write(f"\n📜 Attempt history for task {task_id} (succeeded):")
                for record in det.attempt_history:
                    lat = f"{record['latency']:.2f}s" if record['latency'] is not None else "-"
                    rid_info = f" rid={record['rid']}" if record.get('rid') else ""
                    tqdm.write(
                        f"  a{record['attempt']}: {record['status']:<8} start={record['start']-det.attempt_history[0]['start']:+.2f}s lat={lat}{rid_info}"
                        + (f" snippet=\"{record['snippet']}\"" if record['snippet'] else "")
                    )
        # Final ASCII timeline
        final_timeline = _ascii_timeline(execution_details, width=80, max_tasks=50)
        if final_timeline:
            tqdm.write("\n📊 Timeline Legend: P=Queued, Q=Dequeued, S=Started, *=Executing, T=Timeout, B=Backoff-timeout, W=Waiting, R=Re-queued, E=Error, F=Fast completion S&C, C=Completed")
            tqdm.write("   Note: Fast tasks (<1s) show as 'F' when S&C events occur at same timeline position due to compression")
            tqdm.write("\n" + final_timeline + "\n")

        final_tickbar = _ascii_tickbar(execution_details, width=80, focus_tags=("S",))
        if final_tickbar:
            tqdm.write(final_tickbar + "\n")
        
        return outputs, execution_details

    def run(self, inputs: Sequence[Any]) -> Tuple[List[Any], List[ExecutionDetails]]:
        return asyncio.run(self.execute(inputs))


class SyncExecutor(Executor):
    """
    Synchronous executor for generating outputs from inputs using a given generation function.

    Args:
        generation_fn (Callable[[Any], Any]): The generation function that takes an input and
            returns an output.

        tqdm_bar_format (Optional[str], optional): The format string for the progress bar. Defaults
            to None. If None, the progress bar is disabled.

        max_retries (int, optional): The maximum number of times to retry on exceptions. Defaults to
            4.

        exit_on_error (bool, optional): Whether to exit execution on the first encountered error.
            Defaults to True.

        fallback_return_value (Union[Unset, Any], optional): The fallback return value for tasks
            that encounter errors. Defaults to _unset.
    """

    def __init__(
        self,
        generation_fn: Callable[[Any], Any],
        tqdm_bar_format: Optional[str] = None,
        max_retries: int = 4,
        exit_on_error: bool = True,
        fallback_return_value: Union[Unset, Any] = _unset,
        termination_signal: Optional[signal.Signals] = signal.SIGINT,
    ):
        self.generate = generation_fn
        self.fallback_return_value = fallback_return_value
        self.tqdm_bar_format = tqdm_bar_format
        self.max_retries = max_retries
        self.exit_on_error = exit_on_error
        self.termination_signal = termination_signal

        self._TERMINATE = False

    def _signal_handler(self, signum: int, frame: Any) -> None:
        tqdm.write("Process was interrupted. The return value will be incomplete...")
        self._TERMINATE = True

    @contextmanager
    def _executor_signal_handling(self, signum: Optional[int]) -> Generator[None, None, None]:
        original_handler = None
        if signum is not None:
            original_handler = signal.signal(signum, self._signal_handler)
            try:
                yield
            finally:
                signal.signal(signum, original_handler)
        else:
            yield

    def run(self, inputs: Sequence[Any]) -> Tuple[List[Any], List[Any]]:
        with self._executor_signal_handling(self.termination_signal):
            outputs = [self.fallback_return_value] * len(inputs)
            execution_details: List[ExecutionDetails] = [
                ExecutionDetails() for _ in range(len(inputs))
            ]
            progress_bar = tqdm(
                total=len(inputs),
                bar_format=self.tqdm_bar_format,
                disable=self.tqdm_bar_format is None,
            )

            for index, input in enumerate(inputs):
                task_start_time = time.time()
                try:
                    for attempt in range(self.max_retries + 1):
                        if self._TERMINATE:
                            return outputs, execution_details
                        try:
                            result = self.generate(input)
                            outputs[index] = result
                            execution_details[index].complete()
                            progress_bar.update()
                            break
                        except Exception as exc:
                            execution_details[index].log_exception(exc)
                            is_phoenix_exception = isinstance(exc, PhoenixException)
                            if attempt >= self.max_retries or is_phoenix_exception:
                                raise exc
                            else:
                                tqdm.write(f"Exception in worker on attempt {attempt + 1}: {exc}")
                                tqdm.write("Retrying...")
                except Exception as exc:
                    execution_details[index].fail()
                    tqdm.write(f"Retries exhausted after {attempt + 1} attempts: {exc}")
                    # attempt history already recorded above for ERROR status
                    if self.exit_on_error:
                        return outputs, execution_details
                    else:
                        progress_bar.update()
                finally:
                    execution_details[index].log_runtime(task_start_time)
        return outputs, execution_details


def get_executor_on_sync_context(
    sync_fn: Callable[[Any], Any],
    async_fn: Callable[[Any], Coroutine[Any, Any, Any]],
    run_sync: bool = False,
    concurrency: int = 3,
    tqdm_bar_format: Optional[str] = None,
    max_retries: int = 4,
    exit_on_error: bool = True,
    fallback_return_value: Union[Unset, Any] = _unset,
    task_timeout: int = 20,
    backoff_base: float = 1.0,
    max_backoff: float = 60.0,
) -> Executor:
    if threading.current_thread() is not threading.main_thread():
        # run evals synchronously if not in the main thread

        if run_sync is False:
            logger.warning(
                "Async evals execution is not supported in non-main threads. Falling back to sync."
            )
        return SyncExecutor(
            sync_fn,
            tqdm_bar_format=tqdm_bar_format,
            exit_on_error=exit_on_error,
            max_retries=max_retries,
            fallback_return_value=fallback_return_value,
            termination_signal=None,
        )

    if run_sync is True:
        return SyncExecutor(
            sync_fn,
            tqdm_bar_format=tqdm_bar_format,
            max_retries=max_retries,
            exit_on_error=exit_on_error,
            fallback_return_value=fallback_return_value,
        )

    if _running_event_loop_exists():
        if getattr(asyncio, "_nest_patched", False):
            return AsyncExecutor(
                async_fn,
                concurrency=concurrency,
                tqdm_bar_format=tqdm_bar_format,
                max_retries=max_retries,
                exit_on_error=exit_on_error,
                fallback_return_value=fallback_return_value,
                task_timeout=task_timeout,
                backoff_base=backoff_base,
                max_backoff=max_backoff,
            )
        else:
            logger.warning(
                "🐌!! If running inside a notebook, patching the event loop with "
                "nest_asyncio will allow asynchronous eval submission, and is significantly "
                "faster. To patch the event loop, run `nest_asyncio.apply()`."
            )
            return SyncExecutor(
                sync_fn,
                tqdm_bar_format=tqdm_bar_format,
                max_retries=max_retries,
                exit_on_error=exit_on_error,
                fallback_return_value=fallback_return_value,
            )
    else:
        return AsyncExecutor(
            async_fn,
            concurrency=concurrency,
            tqdm_bar_format=tqdm_bar_format,
            max_retries=max_retries,
            exit_on_error=exit_on_error,
            fallback_return_value=fallback_return_value,
            task_timeout=task_timeout,
            backoff_base=backoff_base,
            max_backoff=max_backoff,
        )


def _running_event_loop_exists() -> bool:
    """Checks for a running event loop.

    Returns:
        bool: True if a running event loop exists, False otherwise.
    """
    try:
        asyncio.get_running_loop()
        return True
    except RuntimeError:
        return False
