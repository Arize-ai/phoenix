import asyncio
import os
import platform
import queue
import signal
import threading
import time
from unittest.mock import AsyncMock, Mock

import nest_asyncio
import pytest

from phoenix.evals.executors import (
    AsyncExecutor,
    ExecutionStatus,
    SyncExecutor,
    get_executor_on_sync_context,
)

# AsyncExecutor tests


async def test_async_executor_executes():
    async def dummy_fn(payload: int) -> int:
        return payload - 1

    executor = AsyncExecutor(
        dummy_fn, concurrency=10, max_retries=0, enable_dynamic_concurrency=False
    )
    inputs = [1, 2, 3, 4, 5]
    outputs, _ = await executor.execute(inputs)
    assert outputs == [0, 1, 2, 3, 4]


async def test_async_executor_executes_many_tasks():
    async def dummy_fn(payload: int) -> int:
        return payload

    executor = AsyncExecutor(
        dummy_fn, concurrency=10, max_retries=0, enable_dynamic_concurrency=False
    )
    inputs = [x for x in range(100)]
    outputs, _ = await executor.execute(inputs)
    assert outputs == inputs


def test_async_executor_runs_synchronously():
    async def dummy_fn(payload: int) -> int:
        return payload - 2

    executor = AsyncExecutor(
        dummy_fn, concurrency=10, max_retries=0, enable_dynamic_concurrency=False
    )
    inputs = [1, 2, 3, 4, 5]
    outputs, _ = executor.run(inputs)
    assert outputs == [-1, 0, 1, 2, 3]


async def test_async_executor_execute_exits_early_on_error():
    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(
        dummy_fn,
        concurrency=1,
        max_retries=0,
        exit_on_error=True,
        fallback_return_value=52,
        enable_dynamic_concurrency=False,
    )
    inputs = [1, 2, 3, 4, 5]
    outputs, _ = await executor.execute(inputs)
    assert outputs == [0, 1, 52, 52, 52]


def test_async_executor_run_exits_early_on_error():
    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(
        dummy_fn,
        concurrency=1,
        max_retries=0,
        exit_on_error=True,
        fallback_return_value=52,
        enable_dynamic_concurrency=False,
    )
    inputs = [1, 2, 3, 4, 5]
    outputs, statuses = executor.run(inputs)
    exceptions = [status.exceptions for status in statuses]
    status_types = [status.status for status in statuses]
    assert outputs == [0, 1, 52, 52, 52]
    assert [len(excs) if excs else 0 for excs in exceptions] == [
        0,
        0,
        1,
        0,
        0,
    ], "one exception raised, then exits"
    assert status_types == [
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.FAILED,
        ExecutionStatus.DID_NOT_RUN,
        ExecutionStatus.DID_NOT_RUN,
    ]
    assert all(isinstance(exc, ValueError) for exc in exceptions[2])


async def test_async_executor_can_continue_on_error():
    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(
        dummy_fn,
        concurrency=1,
        max_retries=1,
        exit_on_error=False,
        fallback_return_value=52,
        enable_dynamic_concurrency=False,
    )
    inputs = [1, 2, 3, 4, 5]
    outputs, statuses = await executor.execute(inputs)
    exceptions = [status.exceptions for status in statuses]
    status_types = [status.status for status in statuses]
    execution_times = [status.execution_seconds for status in statuses]
    assert outputs == [0, 1, 52, 3, 4], "failed tasks use the fallback value"
    assert [len(excs) if excs else 0 for excs in exceptions] == [
        0,
        0,
        2,
        0,
        0,
    ], "two exceptions due to retries"
    assert status_types == [
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.FAILED,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
    ]
    assert len(execution_times) == 5
    assert all(isinstance(runtime, float) for runtime in execution_times)
    assert all(isinstance(exc, ValueError) for exc in exceptions[2])


async def test_async_executor_marks_completed_with_retries_status():
    retry_counter = 0

    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            nonlocal retry_counter
            if retry_counter < 2:
                retry_counter += 1
                raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(
        dummy_fn,
        concurrency=1,
        max_retries=3,
        exit_on_error=False,
        fallback_return_value=52,
        enable_dynamic_concurrency=False,
    )
    inputs = [1, 2, 3, 4, 5]
    outputs, execution_details = await executor.execute(inputs)
    assert outputs == [0, 1, 2, 3, 4], "input 3 should only fail twice"
    assert [status.status for status in execution_details] == [
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED_WITH_RETRIES,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
    ]


@pytest.mark.skipif(platform.system() == "Windows", reason="SIGUSR1 not supported on Windows")
async def test_async_executor_sigint_handling():
    class InterruptingIterator:
        def __init__(self, interruption_index: int, max_elements: int):
            self.interruption_index = interruption_index
            self.max_elements = max_elements
            self.current = 0

        def __len__(self):
            return self.max_elements

        def __iter__(self):
            return self

        def __next__(self):
            if self.current < self.max_elements:
                if self.current == self.interruption_index:
                    # Trigger interruption signal
                    os.kill(os.getpid(), signal.SIGUSR1)
                    time.sleep(0.1)

                res = self.current
                self.current += 1
                return res
            else:
                raise StopIteration

    async def async_fn(x):
        await asyncio.sleep(0.01)
        return x

    result_length = 1000
    sigint_index = 50
    executor = AsyncExecutor(
        async_fn,
        concurrency=5,
        max_retries=0,
        fallback_return_value="test",
        termination_signal=signal.SIGUSR1,
        enable_dynamic_concurrency=False,
        dynamic_initial_target=1,
        dynamic_window_seconds=0.1,
        dynamic_increase_step=1,
        dynamic_decrease_ratio=0.5,
        dynamic_inactive_check_interval=0.01,
    )
    task = asyncio.create_task(executor.execute(InterruptingIterator(sigint_index, result_length)))

    results, _ = await task
    assert len(results) == result_length
    assert results.count("test") > 100, "most inputs should not have been processed"


@pytest.mark.xfail(reason="Flaky test", strict=False)
async def test_async_executor_retries():
    mock_generate = AsyncMock(side_effect=RuntimeError("Test exception"))
    executor = AsyncExecutor(mock_generate, max_retries=3, enable_dynamic_concurrency=False)

    await executor.execute([1])  # by default the executor does not raise on generation errors

    mock_generate.call_count == 4, "1 initial call + 3 retries"


# SyncExecutor tests


def test_sync_executor_runs_many_tasks():
    def dummy_fn(payload: int) -> int:
        return payload

    executor = SyncExecutor(dummy_fn, max_retries=0)
    inputs = [x for x in range(1000)]
    outputs, _ = executor.run(inputs)
    assert outputs == inputs


def test_sync_executor_runs_once_per_task():
    dummy_fn = Mock(side_effect=lambda x: x)

    executor = SyncExecutor(dummy_fn, max_retries=3)
    inputs = [x for x in range(10)]
    executor.run(inputs)
    assert dummy_fn.call_count == 10


def test_sync_executor_runs():
    def dummy_fn(payload: int) -> int:
        return payload - 2

    executor = SyncExecutor(dummy_fn, max_retries=0)
    inputs = [1, 2, 3, 4, 5]
    outputs, _ = executor.run(inputs)
    assert outputs == [-1, 0, 1, 2, 3]


def test_sync_executor_run_exits_early_on_error():
    def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = SyncExecutor(dummy_fn, exit_on_error=True, fallback_return_value=52, max_retries=0)
    inputs = [1, 2, 3, 4, 5]
    outputs, execution_details = executor.run(inputs)
    exceptions = [status.exceptions for status in execution_details]
    status_types = [status.status for status in execution_details]
    assert outputs == [0, 1, 52, 52, 52]
    assert [len(excs) if excs else 0 for excs in exceptions] == [
        0,
        0,
        1,
        0,
        0,
    ], "one exception raised, then exits"
    assert status_types == [
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.FAILED,
        ExecutionStatus.DID_NOT_RUN,
        ExecutionStatus.DID_NOT_RUN,
    ]
    assert all(isinstance(exc, ValueError) for exc in exceptions[2])


def test_sync_executor_can_continue_on_error():
    def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = SyncExecutor(dummy_fn, exit_on_error=False, fallback_return_value=52, max_retries=1)
    inputs = [1, 2, 3, 4, 5]
    outputs, execution_details = executor.run(inputs)
    exceptions = [status.exceptions for status in execution_details]
    status_types = [status.status for status in execution_details]
    execution_times = [status.execution_seconds for status in execution_details]
    assert outputs == [0, 1, 52, 3, 4]
    assert [len(excs) if excs else 0 for excs in exceptions] == [
        0,
        0,
        2,
        0,
        0,
    ], "two exceptions due to retries"
    assert status_types == [
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.FAILED,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
    ]
    assert len(execution_times) == 5
    assert all(isinstance(runtime, float) for runtime in execution_times)
    assert all(isinstance(exc, ValueError) for exc in exceptions[2])


def test_sync_executor_marks_completed_with_retries_status():
    retry_counter = 0

    def dummy_fn(payload: int) -> int:
        if payload == 3:
            nonlocal retry_counter
            if retry_counter < 2:
                retry_counter += 1
                raise ValueError("test error")
        return payload - 1

    executor = SyncExecutor(dummy_fn, max_retries=3, exit_on_error=False, fallback_return_value=52)
    inputs = [1, 2, 3, 4, 5]
    outputs, execution_details = executor.run(inputs)
    assert outputs == [0, 1, 2, 3, 4], "input 3 should only fail twice"
    assert [status.status for status in execution_details] == [
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED_WITH_RETRIES,
        ExecutionStatus.COMPLETED,
        ExecutionStatus.COMPLETED,
    ]


@pytest.mark.skipif(platform.system() == "Windows", reason="SIGUSR1 not supported on Windows")
def test_sync_executor_sigint_handling():
    class InterruptingIterator:
        def __init__(self, interruption_index: int, max_elements: int):
            self.interruption_index = interruption_index
            self.max_elements = max_elements
            self.current = 0

        def __len__(self):
            return self.max_elements

        def __iter__(self):
            return self

        def __next__(self):
            if self.current < self.max_elements:
                if self.current == self.interruption_index:
                    # Trigger interruption signal
                    os.kill(os.getpid(), signal.SIGUSR1)
                    time.sleep(0.1)

                res = self.current
                self.current += 1
                return res
            else:
                raise StopIteration

    def sync_fn(x):
        time.sleep(0.01)
        return x

    result_length = 1000
    sigint_index = 50
    executor = SyncExecutor(
        sync_fn,
        max_retries=0,
        fallback_return_value="test",
        termination_signal=signal.SIGUSR1,
    )
    results, _ = executor.run(InterruptingIterator(sigint_index, result_length))
    assert len(results) == result_length
    assert results.count("test") > 100, "most inputs should not have been processed"


def test_sync_executor_defaults_sigint_handling():
    def sync_fn(x):
        return signal.getsignal(signal.SIGINT)

    executor = SyncExecutor(
        sync_fn,
        max_retries=0,
        fallback_return_value="test",
    )
    res, _ = executor.run(["test"])
    assert res[0] != signal.default_int_handler


def test_sync_executor_bypasses_sigint_handling_if_none():
    def sync_fn(x):
        return signal.getsignal(signal.SIGINT)

    executor = SyncExecutor(
        sync_fn,
        max_retries=0,
        fallback_return_value="test",
        termination_signal=None,
    )
    res, _ = executor.run(["test"])
    assert res[0] == signal.default_int_handler


def test_sync_executor_retries():
    mock_generate = Mock(side_effect=RuntimeError("Test exception"))
    executor = SyncExecutor(mock_generate, max_retries=3)

    executor.run([1])  # by default the executor does not raise on generation errors

    assert mock_generate.call_count == 4, "1 initial call + 3 retries"


# test executor factory


@pytest.mark.xfail(reason="Flaky test", strict=False)
async def test_executor_factory_returns_sync_in_async_context():
    def sync_fn():
        pass

    async def async_fn():
        pass

    async def executor_in_async_context():
        return get_executor_on_sync_context(sync_fn, async_fn)

    executor = await executor_in_async_context()
    assert isinstance(executor, SyncExecutor)


async def test_executor_factory_returns_async_in_patched_async_context():
    nest_asyncio.apply()

    def sync_fn():
        pass

    async def async_fn():
        pass

    async def executor_in_async_context():
        return get_executor_on_sync_context(sync_fn, async_fn)

    executor = await executor_in_async_context()
    assert isinstance(executor, AsyncExecutor)


def test_executor_factory_returns_async_in_sync_context():
    def sync_fn():
        pass

    async def async_fn():
        pass

    def executor_in_sync_context():
        return get_executor_on_sync_context(sync_fn, async_fn)

    executor = executor_in_sync_context()
    assert isinstance(executor, AsyncExecutor)


def test_executor_factory_returns_sync_in_sync_context_if_asked():
    def sync_fn():
        pass

    async def async_fn():
        pass

    def executor_in_sync_context():
        return get_executor_on_sync_context(
            sync_fn,
            async_fn,
            run_sync=True,  # request a sync_executor
        )

    executor = executor_in_sync_context()
    assert isinstance(executor, SyncExecutor)


def test_executor_factory_returns_sync_in_threads():
    def sync_fn():
        pass

    async def async_fn():
        pass

    exception_log = queue.Queue()

    def run_test():
        try:
            executor = get_executor_on_sync_context(
                sync_fn,
                async_fn,
                run_sync=True,  # request a sync_executor
            )
            assert isinstance(executor, SyncExecutor)
            assert executor.termination_signal is None
        except Exception as e:
            exception_log.put(e)

    test_thread = threading.Thread(target=run_test)
    test_thread.start()
    test_thread.join()
    if not exception_log.empty():
        raise exception_log.get()


async def test_executor_factory_returns_sync_in_threads_even_if_async_context():
    def sync_fn():
        pass

    async def async_fn():
        pass

    exception_log = queue.Queue()

    async def run_test():
        nest_asyncio.apply()
        try:
            executor = get_executor_on_sync_context(
                sync_fn,
                async_fn,
            )
            assert isinstance(executor, SyncExecutor)
            assert executor.termination_signal is None
        except Exception as e:
            exception_log.put(e)

    def async_task(loop):
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run_test())

    loop = asyncio.new_event_loop()
    test_thread = threading.Thread(target=async_task, args=(loop,))
    test_thread.start()
    test_thread.join()

    if not exception_log.empty():
        raise exception_log.get()


def test_executor_factory_returns_async_not_in_thread_if_async_context():
    def sync_fn():
        pass

    async def async_fn():
        pass

    exception_log = queue.Queue()

    async def run_test():
        nest_asyncio.apply()
        try:
            executor = get_executor_on_sync_context(
                sync_fn,
                async_fn,
            )
            assert isinstance(executor, AsyncExecutor)
            assert executor.termination_signal is not None
        except Exception as e:
            exception_log.put(e)

    def async_task():
        asyncio.run(run_test())

    async_task()

    if not exception_log.empty():
        raise exception_log.get()


# Executor-level concurrency integration tests


class MockController:
    def __init__(self, *, current_target: int, inactive_check_interval: float = 0.01) -> None:
        self._target_concurrency = current_target
        self._inactive_check_interval = inactive_check_interval

    @property
    def target_concurrency(self) -> int:
        return max(1, int(self._target_concurrency))

    @property
    def current_target(self) -> int:
        return self.target_concurrency

    @current_target.setter
    def current_target(self, value: int) -> None:  # type: ignore[no-redef]
        self._target_concurrency = value

    @property
    def inactive_check_interval(self) -> float:
        return self._inactive_check_interval

    def record_success(self, latency_seconds: float) -> None:  # noqa: ARG002
        pass

    def record_timeout(self) -> None:
        pass

    def record_error(self) -> None:
        pass


@pytest.mark.asyncio
async def test_executor_respects_reduced_target() -> None:
    inflight: int = 0
    max_inflight: int = 0
    lock = asyncio.Lock()

    async def generate(x: int) -> int:
        nonlocal inflight, max_inflight
        async with lock:
            inflight += 1
            if inflight > max_inflight:
                max_inflight = inflight
        await asyncio.sleep(0.05)
        async with lock:
            inflight -= 1
        return x

    executor = AsyncExecutor(
        generate, concurrency=4, max_retries=0, timeout=2, enable_dynamic_concurrency=True
    )
    stub = MockController(current_target=1)
    executor._concurrency_controller = stub  # type: ignore[attr-defined]

    inputs = list(range(20))
    outputs, _ = await executor.execute(inputs)

    assert outputs == inputs
    assert max_inflight == 1


@pytest.mark.asyncio
async def test_executor_ramps_up_when_target_increases() -> None:
    inflight: int = 0
    max_inflight: int = 0
    lock = asyncio.Lock()

    async def generate(x: int) -> int:
        nonlocal inflight, max_inflight
        async with lock:
            inflight += 1
            if inflight > max_inflight:
                max_inflight = inflight
        await asyncio.sleep(0.05)
        async with lock:
            inflight -= 1
        return x

    executor = AsyncExecutor(
        generate, concurrency=4, max_retries=0, timeout=3, enable_dynamic_concurrency=True
    )
    stub = MockController(current_target=1)
    executor._concurrency_controller = stub  # type: ignore[attr-defined]

    async def bump_target_later() -> None:
        await asyncio.sleep(0.2)
        stub.current_target = 3

    bump_task = asyncio.create_task(bump_target_later())

    inputs = list(range(40))
    outputs, _ = await executor.execute(inputs)
    await bump_task

    assert outputs == inputs
    assert max_inflight <= 4
    assert max_inflight >= 3
