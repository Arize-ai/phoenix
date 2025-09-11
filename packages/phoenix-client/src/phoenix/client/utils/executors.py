from __future__ import annotations

import asyncio
import logging
import signal
import threading
import time
from collections import deque
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
    cast,
)

from tqdm.auto import tqdm  # type: ignore[import-untyped]

from phoenix.client.exceptions import PhoenixException
from phoenix.client.utils.rate_limiters import RateLimitError

logger = logging.getLogger(__name__)


EvalsRateLimitError: type[BaseException]
try:
    # TODO: update import path after evals 2.0 is released
    from phoenix.evals.models.rate_limiters import RateLimitError as EvalsRateLimitError
except ImportError:

    class _EvalsRateLimitErrorFallback(Exception):
        pass

    EvalsRateLimitError = _EvalsRateLimitErrorFallback


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

    def fail(self) -> None:
        self.status = ExecutionStatus.FAILED

    def complete(self) -> None:
        if self.exceptions:
            self.status = ExecutionStatus.COMPLETED_WITH_RETRIES
        else:
            self.status = ExecutionStatus.COMPLETED

    def log_exception(self, exc: Exception) -> None:
        self.exceptions.append(exc)

    def log_runtime(self, start_time: float) -> None:
        self.execution_seconds += time.time() - start_time


class Executor(Protocol):
    def run(self, inputs: Sequence[Any]) -> Tuple[List[Any], List[ExecutionDetails]]: ...


class ConcurrencyController:
    """
    AIMD (Additive Increase/Multiplicative Decrease) controller for target concurrency.

    Per window: if no error, increase target by +a (increase_step); otherwise decrease concurrency
    by a factor of β, clamped to [1, max_concurrency].

    Steady-state guide for choosing feedback constants:
      concurrency ~= a * (1 - r_e) / ((1 - β) * r_e)
    where r_e is the fraction of windows that observe at least one error.
    To tend toward a single active worker when errors are frequent, select (a, β) so that
      concurrency <= 1 when r_e >= a / (a + 1 - β).
    Example: a=1, β=0.5 ⇒ threshold r_e >= 2/3.
    """

    def __init__(
        self,
        *,
        max_concurrency: int,
        initial_target: float,
        window_seconds: float = 5,
        increase_step: float = 0.5,
        decrease_ratio: float = 0.5,
        inactive_check_interval: float = 1.0,
        smoothing_factor: float = 0.2,
        collapse_window_seconds: float = 15.0,
        collapse_error_threshold: int = 2,
    ) -> None:
        self._max_concurrency = max(1, int(max_concurrency))
        self._target_concurrency = float(initial_target)
        self._window_seconds = float(window_seconds)
        self._increase_step = float(increase_step)
        self._decrease_ratio = float(decrease_ratio)
        self._smoothing_factor = smoothing_factor
        self._collapse_window_seconds = float(collapse_window_seconds)
        self._collapse_error_threshold = max(1, int(collapse_error_threshold))

        self._window_started_at = time.time()
        self._success_count = 0
        self._timeout_count = 0
        self._error_count = 0
        self._smoothed_latency_seconds: Optional[float] = None
        # Track only the most recent N error timestamps; bounded by threshold
        self._error_timestamps: deque[float] = deque(maxlen=self._collapse_error_threshold)

        self.inactive_check_interval = max(0.1, float(inactive_check_interval))

    @property
    def target_concurrency(self) -> int:
        floored = max(1, int(self._target_concurrency))
        return min(floored, self._max_concurrency)

    def _feedback_window_finished(self) -> bool:
        now = time.time()
        return (now - self._window_started_at) >= self._window_seconds

    def _update_concurrency_target(self) -> None:
        now = time.time()
        had_issue = (self._timeout_count + self._error_count) > 0
        if had_issue:
            self._target_concurrency *= self._decrease_ratio
        else:
            self._target_concurrency += self._increase_step
        self._window_started_at = now
        self._success_count = 0
        self._timeout_count = 0
        self._error_count = 0

    def record_success(self, latency_seconds: float) -> None:
        self._success_count += 1
        if self._smoothed_latency_seconds is None:
            self._smoothed_latency_seconds = float(latency_seconds)
        else:
            self._smoothed_latency_seconds = (
                1 - self._smoothing_factor
            ) * self._smoothed_latency_seconds + self._smoothing_factor * float(latency_seconds)
        if self._feedback_window_finished():
            self._update_concurrency_target()

    def record_timeout(self) -> None:
        self._timeout_count += 1
        if self._feedback_window_finished():
            self._update_concurrency_target()

    def record_error(self) -> None:
        now = time.time()
        self._error_count += 1
        self._error_timestamps.append(now)
        if (
            len(self._error_timestamps) >= self._collapse_error_threshold
            and (now - self._error_timestamps[0]) <= self._collapse_window_seconds
        ):
            self._target_concurrency = 1.0
        if self._feedback_window_finished():
            self._update_concurrency_target()


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
            Defaults to 10.

        exit_on_error (bool, optional): Whether to exit execution on the first encountered error.
            Defaults to True.

        fallback_return_value (Union[Unset, Any], optional): The fallback return value for tasks
            that encounter errors. Defaults to _unset.

        termination_signal (signal.Signals, optional): The signal handled to terminate the executor.
    """

    def __init__(
        self,
        generation_fn: Callable[[Any], Coroutine[Any, Any, Any]],
        concurrency: int = 3,
        tqdm_bar_format: Optional[str] = None,
        max_retries: int = 10,
        exit_on_error: bool = True,
        fallback_return_value: Union[Unset, Any] = _unset,
        termination_signal: Optional[signal.Signals] = signal.SIGINT,
        timeout: Optional[int] = None,
        *,
        enable_dynamic_concurrency: bool = True,
        dynamic_initial_target: Optional[int] = None,
        dynamic_window_seconds: float = 5.0,
        dynamic_increase_step: int = 1,
        dynamic_decrease_ratio: float = 0.5,
        dynamic_inactive_check_interval: float = 1.0,
    ):
        self.generate = generation_fn
        self.fallback_return_value = fallback_return_value
        self.concurrency = concurrency
        self.tqdm_bar_format = tqdm_bar_format
        self.max_retries = max_retries
        self.exit_on_error = exit_on_error
        self.base_priority = 0
        self.termination_signal = termination_signal
        self.timeout: int = timeout or 60

        # Dynamic concurrency controller (AIMD)
        self._concurrency_controller: Optional[ConcurrencyController] = None
        if enable_dynamic_concurrency:
            self._concurrency_controller = ConcurrencyController(
                max_concurrency=self.concurrency,
                initial_target=dynamic_initial_target or self.concurrency,
                window_seconds=dynamic_window_seconds,
                increase_step=dynamic_increase_step,
                decrease_ratio=dynamic_decrease_ratio,
                inactive_check_interval=dynamic_inactive_check_interval,
                collapse_window_seconds=30.0,
            )

    async def producer(
        self,
        inputs: Sequence[Any],
        queue: asyncio.PriorityQueue[Tuple[int, Any]],
        max_fill: int,
        done_producing: asyncio.Event,
        termination_signal: asyncio.Event,
    ) -> None:
        try:
            for index, input in enumerate(inputs):
                if termination_signal.is_set():
                    break
                while queue.qsize() >= max_fill:
                    # keep room in the queue for requeues
                    await asyncio.sleep(1)
                await queue.put((self.base_priority, (index, input)))
        finally:
            done_producing.set()

    async def consumer(
        self,
        outputs: List[Any],
        execution_details: List[ExecutionDetails],
        queue: asyncio.PriorityQueue[Tuple[int, Any]],
        done_producing: asyncio.Event,
        termination_event: asyncio.Event,
        progress_bar: Any,
        worker_index: int,
    ) -> None:
        termination_event_watcher = None
        while True:
            marked_done = False
            # Dynamic gating before dequeue; inactive workers do not touch the queue
            if self._concurrency_controller is not None:
                if worker_index >= self._concurrency_controller.target_concurrency:
                    # If production is finished and queue is empty, exit instead of sleeping
                    if done_producing.is_set() and queue.empty():
                        break
                    if termination_event.is_set():
                        break
                    await asyncio.sleep(self._concurrency_controller.inactive_check_interval)
                    continue
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

            task_start_time = time.time()
            try:
                generate_task = asyncio.create_task(self.generate(payload))
                termination_event_watcher = asyncio.create_task(termination_event.wait())
                done, _ = await asyncio.wait(
                    [generate_task, termination_event_watcher],
                    timeout=self.timeout,
                    return_when=asyncio.FIRST_COMPLETED,
                )

                if generate_task in done:
                    outputs[index] = generate_task.result()
                    details = cast(ExecutionDetails, execution_details[index])
                    details.complete()
                    details.log_runtime(task_start_time)
                    if self._concurrency_controller is not None:
                        self._concurrency_controller.record_success(time.time() - task_start_time)
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
                    tqdm.write("Worker timeout, requeuing")
                    # Best-effort cancel the timed-out task without blocking the loop
                    if not generate_task.done():
                        generate_task.cancel()
                        try:
                            await asyncio.wait_for(generate_task, timeout=1)
                        except (asyncio.TimeoutError, asyncio.CancelledError):
                            pass
                    # task timeouts are requeued at the same priority
                    await queue.put((priority, item))
                    details = cast(ExecutionDetails, execution_details[index])
                    details.log_runtime(task_start_time)
                    if self._concurrency_controller is not None:
                        self._concurrency_controller.record_timeout()
            except Exception as exc:
                details = cast(ExecutionDetails, execution_details[index])
                details.log_exception(exc)
                details.log_runtime(task_start_time)

                is_client_rate_limit_error = isinstance(exc, RateLimitError)
                is_evals_rate_limit_error = isinstance(exc, EvalsRateLimitError)
                is_rate_limit_error = is_client_rate_limit_error or is_evals_rate_limit_error

                is_phoenix_exception = isinstance(exc, PhoenixException) and not is_rate_limit_error
                bypass_retries = is_phoenix_exception and not is_rate_limit_error
                if (retry_count := abs(priority)) < self.max_retries and not bypass_retries:
                    if is_rate_limit_error:
                        tqdm.write(
                            f"Rate limit throttle on attempt {retry_count + 1}: raised {repr(exc)}"
                        )
                        tqdm.write("Requeuing...")
                        await queue.put((priority - 1, item))
                        if self._concurrency_controller is not None:
                            self._concurrency_controller.record_error()
                    else:
                        tqdm.write(
                            f"Exception in worker on attempt {retry_count + 1}: raised {repr(exc)}"
                        )
                        tqdm.write("Requeuing...")
                        await queue.put((priority - 1, item))
                else:
                    details = cast(ExecutionDetails, execution_details[index])
                    details.fail()
                    tqdm.write(f"Retries exhausted after {retry_count + 1} attempts: {exc}")
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
        termination_event = asyncio.Event()

        def termination_handler(signum: int, frame: Any) -> None:
            termination_event.set()
            tqdm.write("Process was interrupted. The return value will be incomplete...")

        # Only set up signal handling if we have a termination signal and we're in the main thread
        original_handler = None
        if (
            self.termination_signal is not None
            and threading.current_thread() is threading.main_thread()
        ):
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
            self.producer(inputs, queue, max_fill, done_producing, termination_event)
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
                    worker_index=i,
                )
            )
            for i in range(self.concurrency)
        ]

        await asyncio.gather(producer, *consumers)
        join_task = asyncio.create_task(queue.join())
        termination_event_watcher = asyncio.create_task(termination_event.wait())
        done, _ = await asyncio.wait(
            [join_task, termination_event_watcher], return_when=asyncio.FIRST_COMPLETED
        )
        if termination_event_watcher in done:
            # Cancel all tasks
            if not join_task.done():
                join_task.cancel()
            if not producer.done():
                producer.cancel()
            for task in consumers:
                if not task.done():
                    task.cancel()

        if not termination_event_watcher.done():
            termination_event_watcher.cancel()

        # reset the signal handler if we set one
        if (
            self.termination_signal is not None
            and threading.current_thread() is threading.main_thread()
            and original_handler is not None
        ):
            signal.signal(self.termination_signal, original_handler)
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
            10.

        exit_on_error (bool, optional): Whether to exit execution on the first encountered error.
            Defaults to True.

        fallback_return_value (Union[Unset, Any], optional): The fallback return value for tasks
            that encounter errors. Defaults to _unset.
    """

    def __init__(
        self,
        generation_fn: Callable[[Any], Any],
        tqdm_bar_format: Optional[str] = None,
        max_retries: int = 10,
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

        self._terminate = False

    def _signal_handler(self, signum: int, frame: Any) -> None:
        tqdm.write("Process was interrupted. The return value will be incomplete...")
        self._terminate = True

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
        # Only enable signal handling if we're in the main thread
        signal_to_use = (
            self.termination_signal
            if threading.current_thread() is threading.main_thread()
            else None
        )
        with self._executor_signal_handling(signal_to_use):
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
                attempt = -1
                try:
                    for attempt in range(self.max_retries + 1):
                        if self._terminate:
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
                    exhausted_attempt_local = attempt if attempt >= 0 else 0
                    tqdm.write(
                        f"Retries exhausted after {exhausted_attempt_local + 1} attempts: {exc}"
                    )
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
    max_retries: int = 10,
    exit_on_error: bool = True,
    fallback_return_value: Union[Unset, Any] = _unset,
    timeout: Optional[int] = None,
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
                timeout=timeout,
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
            timeout=timeout,
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
