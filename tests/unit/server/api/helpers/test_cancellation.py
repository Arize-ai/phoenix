import asyncio
import time

import pytest

from phoenix.server.api.helpers.cancellation import (
    CancellationRequested,
    PlaygroundCancellationToken,
)


class TestPlaygroundCancellationToken:
    def test_initial_state_not_cancelled(self) -> None:
        """Token should not be cancelled initially."""
        token = PlaygroundCancellationToken("test_operation")
        assert not token.is_cancelled()
        assert token.reason is None

    def test_cancel_sets_flag(self) -> None:
        """Calling cancel() should set the cancelled flag."""
        token = PlaygroundCancellationToken("test_operation")
        token.cancel("Test reason")
        assert token.is_cancelled()
        assert token.reason is not None
        assert token.reason.reason == "Test reason"

    def test_cancel_with_cancelled_by(self) -> None:
        """Cancel should record who cancelled."""
        token = PlaygroundCancellationToken("test_operation")
        token.cancel(reason="Client disconnected", cancelled_by="client_disconnect")
        assert token.is_cancelled()
        assert token.reason is not None
        assert token.reason.cancelled_by == "client_disconnect"

    def test_cancel_idempotent(self) -> None:
        """Multiple cancel calls should keep the first reason."""
        token = PlaygroundCancellationToken("test_operation")
        token.cancel("First reason")
        first_time = token.reason.cancelled_at if token.reason else None

        # Wait a bit to ensure different timestamp if it were to change
        time.sleep(0.01)

        token.cancel("Second reason")
        assert token.reason is not None
        assert token.reason.reason == "First reason"  # Still first reason
        assert token.reason.cancelled_at == first_time  # Same timestamp

    def test_is_cancelled_performance(self) -> None:
        """is_cancelled() should be O(1) - verify 10K checks complete quickly."""
        token = PlaygroundCancellationToken("test_operation")
        start = time.perf_counter()
        for _ in range(10000):
            token.is_cancelled()
        elapsed_ms = (time.perf_counter() - start) * 1000
        # Should complete in under 50ms (being generous for CI)
        assert elapsed_ms < 50, f"10K is_cancelled() calls took {elapsed_ms:.2f}ms"

    @pytest.mark.asyncio
    async def test_check_cancelled_raises_when_cancelled(self) -> None:
        """check_cancelled() should raise CancellationRequested when cancelled."""
        token = PlaygroundCancellationToken("test_operation")
        token.cancel("Test cancellation")
        with pytest.raises(CancellationRequested):
            await token.check_cancelled()

    @pytest.mark.asyncio
    async def test_check_cancelled_does_not_raise_when_not_cancelled(self) -> None:
        """check_cancelled() should not raise when not cancelled."""
        token = PlaygroundCancellationToken("test_operation")
        # Should not raise
        await token.check_cancelled()

    def test_operation_id_stored(self) -> None:
        """Operation ID should be stored on the token."""
        token = PlaygroundCancellationToken("my_unique_operation")
        assert token.operation_id == "my_unique_operation"


class TestCancellationIntegration:
    @pytest.mark.asyncio
    async def test_cancellation_stops_async_iteration(self) -> None:
        """Verify cancellation can stop an async iteration."""
        from collections.abc import AsyncIterator

        token = PlaygroundCancellationToken("test_iteration")
        items_processed = 0

        async def async_generator() -> AsyncIterator[int]:
            for i in range(100):
                if token.is_cancelled():
                    break
                yield i
                await asyncio.sleep(0.001)

        async def cancel_after_delay() -> None:
            await asyncio.sleep(0.01)
            token.cancel("Timeout")

        # Start cancellation task
        cancel_task = asyncio.create_task(cancel_after_delay())

        async for _ in async_generator():
            items_processed += 1

        await cancel_task

        # Should have processed some items but not all 100
        assert items_processed > 0
        assert items_processed < 100
        assert token.is_cancelled()

    @pytest.mark.asyncio
    async def test_multiple_tasks_see_cancellation(self) -> None:
        """Multiple tasks sharing a token should all see cancellation."""
        token = PlaygroundCancellationToken("shared_operation")
        task_results: list[int] = []

        async def worker(worker_id: int) -> None:
            while not token.is_cancelled():
                await asyncio.sleep(0.001)
            task_results.append(worker_id)

        # Start multiple workers
        tasks = [asyncio.create_task(worker(i)) for i in range(3)]

        # Cancel after a short delay
        await asyncio.sleep(0.01)
        token.cancel("Cancelling all workers")

        # Wait for all workers to complete
        await asyncio.gather(*tasks)

        # All workers should have completed
        assert len(task_results) == 3
        assert set(task_results) == {0, 1, 2}
