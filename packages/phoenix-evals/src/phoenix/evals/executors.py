from __future__ import annotations

import asyncio
import logging
import random
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

from phoenix.evals.exceptions import PhoenixException
from phoenix.evals.reporter import BaseReporter, NullReporter, StdoutReporter

logger = logging.getLogger(__name__)


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
        self.exceptions.append(exc)
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
            "timeout_count": self.timeout_count,
            "exception_count": self.exception_count,
            "execution_seconds": round(self.execution_seconds, 3),
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
            Defaults to 7.

        exit_on_error (bool, optional): Whether to exit execution on the first encountered error.
            Defaults to True.

        fallback_return_value (Union[Unset, Any], optional): The fallback return value for tasks
            that encounter errors. Defaults to _unset.

        termination_signal (signal.Signals, optional): The signal handled to terminate the executor.

        task_timeout (int, optional): The maximum time in seconds to wait for a task to complete.
            Defaults to 20.

        backoff_base (float, optional): The base time to wait before retrying a timed-out task.
            Defaults to 5.0.

        max_backoff (float, optional): The maximum backoff time in seconds. Defaults to 120.0.

        reporter (Optional[BaseReporter], optional): The reporter to use for progress visualization.
            Defaults to StdoutReporter().

        show_ascii_timeline (bool, optional): If True, enables ASCII timeline visualization.
            Defaults to False (no ASCII visualization).
    """

    def __init__(
        self,
        generation_fn: Callable[[Any], Coroutine[Any, Any, Any]],
        concurrency: int = 3,
        tqdm_bar_format: Optional[str] = None,
        max_retries: int = 12,
        exit_on_error: bool = True,
        fallback_return_value: Union[Unset, Any] = _unset,
        termination_signal: signal.Signals = signal.SIGINT,
        task_timeout: int = 20,
        backoff_base: float = 5.0,
        max_backoff: float = 120.0,
        reporter: Optional[BaseReporter] = None,
        show_ascii_timeline: bool = False,
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
        if show_ascii_timeline:
            self.reporter = reporter if reporter is not None else StdoutReporter()
        else:
            self.reporter = NullReporter()

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
        worker_id = id(asyncio.current_task())  # Unique identifier for this worker
        
        while True:
            marked_done = False
            
            # ──────────────────────────────────────────────────────────
            # (NEW) Dynamic concurrency control - AFTER grabbing task
            # If rate limiter has collapsed, inactive workers put their
            # task back and sleep, reducing token contention.
            # ──────────────────────────────────────────────────────────
            try:
                gen_self = getattr(self.generate, "__self__", None)
                _rate_limiter = getattr(gen_self, "_rate_limiter", None)
                _throttler = getattr(_rate_limiter, "_throttler", None)
                
                if _throttler is not None:
                    current_rate = float(getattr(_throttler, "rate", 10.0))
                    # Calculate how many workers we actually want active
                    if current_rate <= 0.1:
                        # Very slow rate: only 1 worker active
                        effective_concurrency = 1
                        sleep_duration = 8.0
                    elif current_rate <= 0.5:
                        # Slow rate: 2-3 workers active  
                        effective_concurrency = max(1, int(current_rate * 6))
                        sleep_duration = 5.0
                    elif current_rate <= 1.0:
                        # Moderate rate: proportional workers
                        effective_concurrency = max(1, min(self.concurrency, int(current_rate * 10)))
                        sleep_duration = 2.0
                    else:
                        # Normal rate: all workers active
                        effective_concurrency = self.concurrency
                        sleep_duration = 0.0
                    
                    # Determine if this worker should be active
                    # Use consistent hash-based assignment  
                    worker_index = hash(worker_id) % self.concurrency
                    should_be_active = worker_index < effective_concurrency
                    
                    if not should_be_active:
                        # DEADLOCK PREVENTION: Check if putting this task back would
                        # leave no active workers. If queue is non-empty and we're
                        # the last potential active worker, stay active.
                        tasks_in_queue = queue.qsize()
                        if tasks_in_queue > 0 and effective_concurrency == 1 and worker_index == 0:
                            # This is the designated active worker, don't sleep
                            pass  
                        else:
                            # Put task back in queue and sleep to reduce contention
                            await queue.put((priority, item))
                            queue.task_done()  # Mark current task as done since we're putting it back
                            marked_done = True
                            # Use shorter sleep to re-evaluate concurrency decisions more frequently
                            await asyncio.sleep(min(sleep_duration, 3.0))
                            continue
                        
            except Exception:
                # Best-effort only; continue normally if anything fails
                pass
            
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
            # Track which retry attempt we're on (priority is negative for retries)
            attempt_no = abs(priority)

            # Log that we've dequeued this task
            execution_details[index].log_event("Q")

            # ──────────────────────────────────────────────────────────
            # (NEW) Pre-wait outside the task stopwatch
            # If the generation function belongs to a model that has a
            # ``_rate_limiter`` with an underlying ``_throttler`` (e.g.
            # OpenAIModel, AnthropicModel, BedrockModel, …), acquire a
            # token *before* we record ``task_start_time`` and start the
            # executor-level timeout.  This way the 20-second (or user-
            # supplied) ``task_timeout`` only measures the true network
            # round-trip to the provider, not the time the coroutine
            # spends waiting for the adaptive token bucket after a burst
            # of 429s.
            #
            # If we can't detect a throttler we simply continue – the
            # behaviour is unchanged for non-Phoenix generation
            # functions.
            # ──────────────────────────────────────────────────────────
            try:
                # Debug prints removed for conciseness
                gen_self = getattr(self.generate, "__self__", None)
                
                # Enhanced introspection: if gen_self is None, try to find Phoenix models
                # in the function's closure or global scope
                if gen_self is None:
                    # verbose debug removed
                    
                    # Check if it's a closure with captured Phoenix models
                    if hasattr(self.generate, '__closure__') and self.generate.__closure__:
                        # verbose debug removed
                        for i, cell in enumerate(self.generate.__closure__):
                            try:
                                cell_value = cell.cell_contents
                                # verbose debug removed
                                if hasattr(cell_value, '_rate_limiter'):
                                    # verbose debug removed
                                    gen_self = cell_value
                                    break
                            except ValueError:
                                pass  # silent when cell is empty
                    
                    # Check global scope for common Phoenix model variable names
                    if gen_self is None and hasattr(self.generate, '__globals__'):
                        # verbose debug removed
                        globals_dict = self.generate.__globals__
                        for name, obj in globals_dict.items():
                            if hasattr(obj, '_rate_limiter') and hasattr(obj, '_throttler'):
                                # verbose debug removed
                                gen_self = obj
                                break
                
                _rate_limiter = getattr(gen_self, "_rate_limiter", None)
                _throttler = getattr(_rate_limiter, "_throttler", None)
                if _throttler is not None and hasattr(_throttler, "async_wait_until_ready"):
                    # verbose debug removed
                    await _throttler.async_wait_until_ready()
                # derive an adaptive timeout: at least self.task_timeout, but
                # if the token bucket rate drops below 1 rps, give tasks a
                # bigger budget (~2× the inter-arrival time between tokens)
                effective_timeout = self.task_timeout
                # verbose debug removed
                if _throttler is not None:
                    # verbose debug removed
                    try:
                        rate = float(getattr(_throttler, "rate", 0.0)) or 0.001
                        # verbose debug removed
                        # Number of tasks that may be contending for tokens:
                        active_workers = max(1, self.concurrency)
                        expected_wait = active_workers / rate  # seconds until last worker gets a token
                        
                        # AGGRESSIVE timeout scaling for severely rate-limited scenarios
                        # verbose debug removed
                        if rate <= 0.05:
                            # Extremely slow rate: 5+ minutes timeout to handle worst case
                            effective_timeout = max(effective_timeout, 300)  # 300 seconds = 5 minutes
                            # verbose debug removed
                        elif rate <= 0.1:
                            # Very slow rate: 3+ minutes timeout  
                            effective_timeout = max(effective_timeout, 180)  # 180 seconds = 3 minutes
                            # verbose debug removed
                        elif rate <= 0.5:
                            # Slow rate: larger multiplier for expected wait
                            effective_timeout = max(effective_timeout, int(expected_wait * 2.0))
                            # verbose debug removed
                        else:
                            # Moderate rate: standard head-room
                            effective_timeout = max(effective_timeout, int(expected_wait * 1.3))
                            # verbose debug removed
                    except Exception:
                        # Best-effort; fallback to base timeout on any error
                        # verbose debug removed
                        pass
                else:
                    # verbose debug removed
                    effective_timeout = self.task_timeout
                # verbose debug removed
            except Exception:
                # silent fall-back on inspection error
                pass

            try:
                task_start_time = time.time()
                execution_details[index].log_event("S")  # Started executing
                generate_task = asyncio.create_task(self.generate(payload))
                termination_event_watcher = asyncio.create_task(termination_event.wait())
                done, pending = await asyncio.wait(
                    [generate_task, termination_event_watcher],
                    timeout=effective_timeout,
                    return_when=asyncio.FIRST_COMPLETED,
                )

                if generate_task in done:
                    result_obj = generate_task.result()
                    outputs[index] = result_obj
                    execution_details[index].complete()
                    execution_details[index].log_runtime(task_start_time)
                    execution_details[index].log_event("C")  # Completed
                    runtime = time.time() - task_start_time
                    self.reporter.task_completed(index, attempt_no, runtime)
                    progress_bar.update()
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
                    tqdm.write(f"Worker timeout after {effective_timeout}s, requeuing (task {index}, attempt {retry_count + 1})")
                    
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


                    
                    # Check if we should keep retrying
                    if retry_count >= self.max_retries:
                        execution_details[index].fail()
                        execution_details[index].log_event("X")  # Failed permanently
                        tqdm.write(f"❌ Task {index}-a{attempt_no}: Max retries ({self.max_retries}) reached, FAILING permanently")
                        progress_bar.update()
                        continue  # ← Task is abandoned, no requeue
                    
                    # Exponential backoff with jitter
                    delay = min(self.max_backoff, self.backoff_base * (2 ** retry_count))
                    jittered_delay = delay * random.uniform(0.5, 2.0)
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
                    execution_details[index].log_event("X")  # Failed permanently
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
                    # Periodic reporting via reporter
                    self.reporter.periodic(execution_details)
        
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
            # removed verbose failed/succeeded task attempt history printing

        # Final reporting via reporter
        self.reporter.final(execution_details)
        
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
        max_retries: int = 12,
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
                    execution_details[index].log_event("X")  # Failed permanently
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
    max_retries: int = 12,
    exit_on_error: bool = True,
    fallback_return_value: Union[Unset, Any] = _unset,
    task_timeout: int = 20,
    backoff_base: float = 5.0,
    max_backoff: float = 120.0,
    reporter: Optional[BaseReporter] = None,
    show_ascii_timeline: bool = False,
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
                reporter=reporter,
                show_ascii_timeline=show_ascii_timeline,
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
            reporter=reporter,
            show_ascii_timeline=show_ascii_timeline,
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
