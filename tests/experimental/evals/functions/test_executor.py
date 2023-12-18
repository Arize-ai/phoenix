import asyncio
import os
import platform
import signal
import time
from unittest.mock import AsyncMock, Mock

import nest_asyncio
import pytest
from phoenix.experimental.evals.functions.executor import (
    AsyncExecutor,
    SyncExecutor,
    get_executor_on_sync_context,
)

# AsyncExecutor tests


async def test_async_executor_executes():
    async def dummy_fn(payload: int) -> int:
        return payload - 1

    executor = AsyncExecutor(dummy_fn, concurrency=10, max_retries=0)
    inputs = [1, 2, 3, 4, 5]
    outputs = await executor.execute(inputs)
    assert outputs == [0, 1, 2, 3, 4]


async def test_async_executor_executes_many_tasks():
    async def dummy_fn(payload: int) -> int:
        return payload

    executor = AsyncExecutor(dummy_fn, concurrency=10, max_retries=0)
    inputs = [x for x in range(100)]
    outputs = await executor.execute(inputs)
    assert outputs == inputs


def test_async_executor_runs_synchronously():
    async def dummy_fn(payload: int) -> int:
        return payload - 2

    executor = AsyncExecutor(dummy_fn, concurrency=10, max_retries=0)
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [-1, 0, 1, 2, 3]


async def test_async_executor_execute_exits_early_on_error():
    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(
        dummy_fn, concurrency=1, max_retries=0, exit_on_error=True, fallback_return_value=52
    )
    inputs = [1, 2, 3, 4, 5]
    outputs = await executor.execute(inputs)
    assert outputs == [0, 1, 52, 52, 52]


def test_async_executor_run_exits_early_on_error():
    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(
        dummy_fn, concurrency=1, max_retries=0, exit_on_error=True, fallback_return_value=52
    )
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [0, 1, 52, 52, 52]


async def test_async_executor_can_continue_on_error():
    async def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = AsyncExecutor(
        dummy_fn, concurrency=1, max_retries=0, exit_on_error=False, fallback_return_value=52
    )
    inputs = [1, 2, 3, 4, 5]
    outputs = await executor.execute(inputs)
    assert outputs == [0, 1, 52, 3, 4]


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
    )
    task = asyncio.create_task(executor.execute(InterruptingIterator(sigint_index, result_length)))

    results = await task
    assert len(results) == result_length
    assert results.count("test") > 100, "most inputs should not have been processed"


async def test_async_executor_retries():
    mock_generate = AsyncMock(side_effect=RuntimeError("Test exception"))
    executor = AsyncExecutor(mock_generate, max_retries=3)

    await executor.execute([1])  # by default the executor does not raise on generation errors

    mock_generate.call_count == 4, "1 initial call + 3 retries"


# SyncExecutor tests


def test_sync_executor_runs_many_tasks():
    def dummy_fn(payload: int) -> int:
        return payload

    executor = SyncExecutor(dummy_fn, max_retries=0)
    inputs = [x for x in range(1000)]
    outputs = executor.run(inputs)
    assert outputs == inputs


def test_sync_executor_runs():
    def dummy_fn(payload: int) -> int:
        return payload - 2

    executor = SyncExecutor(dummy_fn, max_retries=0)
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [-1, 0, 1, 2, 3]


def test_sync_executor_run_exits_early_on_error():
    def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = SyncExecutor(dummy_fn, exit_on_error=True, fallback_return_value=52, max_retries=0)
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [0, 1, 52, 52, 52]


def test_sync_executor_can_continue_on_error():
    def dummy_fn(payload: int) -> int:
        if payload == 3:
            raise ValueError("test error")
        return payload - 1

    executor = SyncExecutor(dummy_fn, exit_on_error=False, fallback_return_value=52, max_retries=0)
    inputs = [1, 2, 3, 4, 5]
    outputs = executor.run(inputs)
    assert outputs == [0, 1, 52, 3, 4]


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
    results = executor.run(InterruptingIterator(sigint_index, result_length))
    assert len(results) == result_length
    assert results.count("test") > 100, "most inputs should not have been processed"


def test_sync_executor_retries():
    mock_generate = Mock(side_effect=RuntimeError("Test exception"))
    executor = SyncExecutor(mock_generate, max_retries=3)

    executor.run([1])  # by default the executor does not raise on generation errors

    assert mock_generate.call_count == 4, "1 initial call + 3 retries"


# test executor factory


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
