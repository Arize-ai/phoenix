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

from phoenix.evals.exceptions import PhoenixException

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
        termination_signal: signal.Signals = signal.SIGINT,
    ):
        self.generate = generation_fn
        self.fallback_return_value = fallback_return_value
        self.concurrency = concurrency
        self.tqdm_bar_format = tqdm_bar_format
        self.max_retries = max_retries
        self.exit_on_error = exit_on_error
        self.base_priority = 0
        self.termination_signal = termination_signal

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

            try:
                task_start_time = time.time()
                generate_task = asyncio.create_task(self.generate(payload))
                termination_event_watcher = asyncio.create_task(termination_event.wait())
                done, pending = await asyncio.wait(
                    [generate_task, termination_event_watcher],
                    timeout=120,
                    return_when=asyncio.FIRST_COMPLETED,
                )

                if generate_task in done:
                    outputs[index] = generate_task.result()
                    execution_details[index].complete()
                    execution_details[index].log_runtime(task_start_time)
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
                    # task timeouts are requeued at the same priority
                    await queue.put((priority, item))
                    execution_details[index].log_runtime(task_start_time)
            except Exception as exc:
                execution_details[index].log_exception(exc)
                execution_details[index].log_runtime(task_start_time)
                is_phoenix_exception = isinstance(exc, PhoenixException)
                if (retry_count := abs(priority)) < self.max_retries and not is_phoenix_exception:
                    tqdm.write(
                        f"Exception in worker on attempt {retry_count + 1}: raised {repr(exc)}"
                    )
                    tqdm.write("Requeuing...")
                    await queue.put((priority - 1, item))
                else:
                    execution_details[index].fail()
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

        original_handler = signal.signal(self.termination_signal, termination_handler)
        outputs = [self.fallback_return_value] * len(inputs)
        execution_details = [ExecutionDetails() for _ in range(len(inputs))]
        progress_bar = tqdm(total=len(inputs), bar_format=self.tqdm_bar_format)

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
                )
            )
            for _ in range(self.concurrency)
        ]

        await asyncio.gather(producer, *consumers)
        join_task = asyncio.create_task(queue.join())
        termination_event_watcher = asyncio.create_task(termination_event.wait())
        done, pending = await asyncio.wait(
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

        # reset the SIGTERM handler
        signal.signal(self.termination_signal, original_handler)  # reset the SIGTERM handler
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
            to None.

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
            progress_bar = tqdm(total=len(inputs), bar_format=self.tqdm_bar_format)

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
