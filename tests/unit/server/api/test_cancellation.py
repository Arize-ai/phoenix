"""
Unit tests for playground cancellation cleanup logic.

Tests the cleanup mechanics in:
- `_cleanup_chat_completion_resources` in subscriptions.py
"""

import asyncio
from collections import deque
from typing import Any, AsyncGenerator, Optional

import pytest

from phoenix.server.api.subscriptions import _cleanup_chat_completion_resources
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionPayload,
    TextChunk,
)

# Type alias for the async generator used in chat completion streams
ChatStream = AsyncGenerator[ChatCompletionSubscriptionPayload, None]


class AsyncGenTracker:
    """
    Tracks state for async generators used in tests.

    Note: The finally block in an async generator only executes if the generator
    has been "started" (i.e., iterated at least once). If aclose() is called on
    a generator that was never iterated, the finally block won't run because
    the generator body was never entered.

    For testing, we need to ensure generators are started before cleanup to
    verify the finally block execution.
    """

    def __init__(self) -> None:
        self.aclose_called = False
        self.aclose_order: list[str] = []
        self.started = False


def create_tracked_async_gen(
    chunks: list[ChatCompletionSubscriptionPayload],
    tracker: AsyncGenTracker,
    name: str = "default",
    aclose_error: Optional[Exception] = None,
) -> ChatStream:
    """
    Create a real async generator that tracks when aclose() is called.

    This is used instead of a mock class because the cleanup function uses
    inspect.isasyncgen() which only returns True for real async generators.

    IMPORTANT: The finally block only executes if the generator has been started
    (iterated at least once). Tests must start the generator before testing cleanup.
    """

    async def gen() -> ChatStream:
        try:
            tracker.started = True
            for chunk in chunks:
                yield chunk
        finally:
            tracker.aclose_called = True
            tracker.aclose_order.append(name)
            if aclose_error is not None:
                raise aclose_error

    return gen()


@pytest.mark.asyncio
class TestCleanupChatCompletionResources:
    """Tests for _cleanup_chat_completion_resources function."""

    async def test_tasks_awaited_before_generators_closed(self) -> None:
        """
        Verify tasks process cancellation before aclose() is called.

        The cleanup sequence (cancel -> await tasks -> aclose generators) is critical.
        task.cancel() only schedules a CancelledError; it doesn't wait for the task
        to process it. We must await all tasks before calling aclose().
        """
        # Track the order of operations
        operation_order: list[str] = []

        # Create a tracker that shares the operation_order list
        tracker = AsyncGenTracker()
        tracker.aclose_order = operation_order

        # Create a real async generator
        mock_gen = create_tracked_async_gen(
            chunks=[TextChunk(content="test"), TextChunk(content="test2")],
            tracker=tracker,
            name="aclose_called",
        )

        # Start the generator so the finally block will run on aclose
        await mock_gen.asend(None)

        # Create a task that takes time to process cancellation
        async def slow_cancellation_task() -> ChatCompletionSubscriptionPayload:
            try:
                await asyncio.sleep(10)  # Would never complete
                return TextChunk(content="never returned")
            except asyncio.CancelledError:
                operation_order.append("task_cancelled")
                raise

        task = asyncio.create_task(slow_cancellation_task())
        # Give the task time to start
        await asyncio.sleep(0)

        in_progress: list[tuple[int, ChatStream, asyncio.Task[Any]]] = [(0, mock_gen, task)]
        not_started: deque[tuple[int, ChatStream]] = deque()

        await _cleanup_chat_completion_resources(
            in_progress=in_progress,
            not_started=not_started,
        )

        # Verify task cancellation happened before aclose
        assert "task_cancelled" in operation_order
        assert "aclose_called" in operation_order
        assert operation_order.index("task_cancelled") < operation_order.index("aclose_called")

    async def test_done_tasks_generators_still_closed(self) -> None:
        """
        Verify generators of completed tasks are still explicitly closed.

        A task being "done" doesn't mean its generator is closed; it just completed
        one iteration. We use explicit aclose() rather than relying on GC to ensure
        generators run their finally blocks immediately.
        """
        tracker = AsyncGenTracker()
        mock_gen = create_tracked_async_gen(
            chunks=[TextChunk(content="test"), TextChunk(content="test2")],
            tracker=tracker,
        )

        # Start the generator so the finally block will run on aclose
        await mock_gen.asend(None)

        # Create an already-completed task
        async def completed_task() -> ChatCompletionSubscriptionPayload:
            return TextChunk(content="completed")

        task = asyncio.create_task(completed_task())
        await task  # Wait for completion

        assert task.done()

        in_progress: list[tuple[int, ChatStream, asyncio.Task[Any]]] = [(0, mock_gen, task)]
        not_started: deque[tuple[int, ChatStream]] = deque()

        await _cleanup_chat_completion_resources(
            in_progress=in_progress,
            not_started=not_started,
        )

        # Even for done tasks, generators should be closed
        assert tracker.aclose_called

    async def test_multiple_tasks_all_cleaned_up(self) -> None:
        """
        Verify all in-progress tasks and generators are cleaned up.
        """
        tracker1 = AsyncGenTracker()
        tracker2 = AsyncGenTracker()
        tracker3 = AsyncGenTracker()

        mock_gen1 = create_tracked_async_gen(
            chunks=[TextChunk(content="1"), TextChunk(content="1b")],
            tracker=tracker1,
            name="gen1",
        )
        mock_gen2 = create_tracked_async_gen(
            chunks=[TextChunk(content="2"), TextChunk(content="2b")],
            tracker=tracker2,
            name="gen2",
        )
        mock_gen3 = create_tracked_async_gen(
            chunks=[TextChunk(content="3"), TextChunk(content="3b")],
            tracker=tracker3,
            name="gen3",
        )

        # Start all generators so their finally blocks will run on aclose
        await mock_gen1.asend(None)
        await mock_gen2.asend(None)
        await mock_gen3.asend(None)

        async def slow_task(n: int) -> ChatCompletionSubscriptionPayload:
            try:
                await asyncio.sleep(10)
                return TextChunk(content=str(n))
            except asyncio.CancelledError:
                raise

        task1 = asyncio.create_task(slow_task(1))
        task2 = asyncio.create_task(slow_task(2))
        task3 = asyncio.create_task(slow_task(3))
        await asyncio.sleep(0)  # Let tasks start

        in_progress: list[tuple[int, ChatStream, asyncio.Task[Any]]] = [
            (0, mock_gen1, task1),
            (1, mock_gen2, task2),
            (2, mock_gen3, task3),
        ]
        not_started: deque[tuple[int, ChatStream]] = deque()

        await _cleanup_chat_completion_resources(
            in_progress=in_progress,
            not_started=not_started,
        )

        # All generators should be closed
        assert tracker1.aclose_called
        assert tracker2.aclose_called
        assert tracker3.aclose_called

        # All tasks should be cancelled
        assert task1.cancelled()
        assert task2.cancelled()
        assert task3.cancelled()

    async def test_empty_in_progress_no_errors(self) -> None:
        """
        Verify cleanup handles empty in_progress list gracefully.
        """
        in_progress: list[tuple[int, ChatStream, asyncio.Task[Any]]] = []
        not_started: deque[tuple[int, ChatStream]] = deque()

        # Should not raise any exceptions
        await _cleanup_chat_completion_resources(
            in_progress=in_progress,
            not_started=not_started,
        )

    async def test_not_started_generators_closed(self) -> None:
        """
        Verify not_started generators are explicitly closed during cleanup.

        Generators in not_started have been created but never iterated. We should
        still call aclose() on them rather than relying on GC, consistent with
        our approach for in_progress generators.
        """
        tracker1 = AsyncGenTracker()
        tracker2 = AsyncGenTracker()

        # Create generators that would be queued but not yet started
        mock_gen1 = create_tracked_async_gen(
            chunks=[TextChunk(content="1"), TextChunk(content="1b")],
            tracker=tracker1,
            name="gen1",
        )
        mock_gen2 = create_tracked_async_gen(
            chunks=[TextChunk(content="2"), TextChunk(content="2b")],
            tracker=tracker2,
            name="gen2",
        )

        # Start generators so finally blocks will execute on aclose
        await mock_gen1.asend(None)
        await mock_gen2.asend(None)

        in_progress: list[tuple[int, ChatStream, asyncio.Task[Any]]] = []
        not_started: deque[tuple[int, ChatStream]] = deque(
            [
                (1, mock_gen1),
                (2, mock_gen2),
            ]
        )

        await _cleanup_chat_completion_resources(
            in_progress=in_progress,
            not_started=not_started,
        )

        # Both not_started generators should be closed
        assert tracker1.aclose_called
        assert tracker2.aclose_called

    async def test_not_started_aclose_errors_dont_prevent_other_cleanups(self) -> None:
        """
        Verify that an error in one not_started aclose() doesn't prevent
        other not_started generators from being closed.
        """
        tracker1 = AsyncGenTracker()
        tracker2 = AsyncGenTracker()

        # Make gen1's aclose raise an error
        mock_gen1 = create_tracked_async_gen(
            chunks=[TextChunk(content="1")],
            tracker=tracker1,
            name="gen1",
            aclose_error=Exception("aclose failed for not_started"),
        )
        mock_gen2 = create_tracked_async_gen(
            chunks=[TextChunk(content="2")],
            tracker=tracker2,
            name="gen2",
        )

        # Start generators so finally blocks will execute
        await mock_gen1.asend(None)
        await mock_gen2.asend(None)

        in_progress: list[tuple[int, ChatStream, asyncio.Task[Any]]] = []
        not_started: deque[tuple[int, ChatStream]] = deque(
            [
                (1, mock_gen1),
                (2, mock_gen2),
            ]
        )

        # Should not raise even though gen1's aclose fails
        await _cleanup_chat_completion_resources(
            in_progress=in_progress,
            not_started=not_started,
        )

        # Both generators should have had aclose called
        assert tracker1.aclose_called
        assert tracker2.aclose_called

    async def test_mixed_in_progress_and_not_started_all_cleaned(self) -> None:
        """
        Verify both in_progress and not_started generators are cleaned up.
        """
        tracker_in_progress = AsyncGenTracker()
        tracker_not_started = AsyncGenTracker()

        # In-progress generator
        mock_gen_in_progress = create_tracked_async_gen(
            chunks=[TextChunk(content="in_progress")],
            tracker=tracker_in_progress,
            name="in_progress",
        )

        # Not-started generator
        mock_gen_not_started = create_tracked_async_gen(
            chunks=[TextChunk(content="not_started")],
            tracker=tracker_not_started,
            name="not_started",
        )

        # Start both generators so finally blocks will execute
        await mock_gen_in_progress.asend(None)
        await mock_gen_not_started.asend(None)

        # Create a task for the in-progress generator
        async def completed_task() -> ChatCompletionSubscriptionPayload:
            return TextChunk(content="done")

        task = asyncio.create_task(completed_task())
        await task

        in_progress: list[tuple[int, ChatStream, asyncio.Task[Any]]] = [
            (0, mock_gen_in_progress, task),
        ]
        not_started: deque[tuple[int, ChatStream]] = deque(
            [
                (1, mock_gen_not_started),
            ]
        )

        await _cleanup_chat_completion_resources(
            in_progress=in_progress,
            not_started=not_started,
        )

        # Both in_progress and not_started generators should be closed
        assert tracker_in_progress.aclose_called
        assert tracker_not_started.aclose_called


@pytest.mark.asyncio
class TestCancellationIntegration:
    """Integration tests for cancellation scenarios."""

    async def test_cleanup_with_mixed_task_states(self) -> None:
        """
        Test cleanup with a mix of running, done, and cancelled tasks.
        """
        tracker1 = AsyncGenTracker()
        tracker2 = AsyncGenTracker()
        tracker3 = AsyncGenTracker()

        # Generator 1 - associated with running task
        mock_gen1 = create_tracked_async_gen(
            chunks=[TextChunk(content="1"), TextChunk(content="1b")],
            tracker=tracker1,
            name="gen1",
        )

        # Generator 2 - associated with completed task
        mock_gen2 = create_tracked_async_gen(
            chunks=[TextChunk(content="2"), TextChunk(content="2b")],
            tracker=tracker2,
            name="gen2",
        )

        # Generator 3 - associated with already-cancelled task
        mock_gen3 = create_tracked_async_gen(
            chunks=[TextChunk(content="3"), TextChunk(content="3b")],
            tracker=tracker3,
            name="gen3",
        )

        # Start all generators so their finally blocks will run on aclose
        await mock_gen1.asend(None)
        await mock_gen2.asend(None)
        await mock_gen3.asend(None)

        # Running task
        async def running_task() -> ChatCompletionSubscriptionPayload:
            try:
                await asyncio.sleep(10)
                return TextChunk(content="running")
            except asyncio.CancelledError:
                raise

        # Completed task
        async def completed_task() -> ChatCompletionSubscriptionPayload:
            return TextChunk(content="completed")

        # Already cancelled task
        async def cancelled_task() -> ChatCompletionSubscriptionPayload:
            await asyncio.sleep(0)
            raise asyncio.CancelledError()

        task1 = asyncio.create_task(running_task())
        task2 = asyncio.create_task(completed_task())
        task3 = asyncio.create_task(cancelled_task())

        await asyncio.sleep(0.01)  # Let tasks progress

        # Wait for task2 to complete and task3 to be cancelled
        await task2
        with pytest.raises(asyncio.CancelledError):
            await task3

        in_progress: list[tuple[int, ChatStream, asyncio.Task[Any]]] = [
            (0, mock_gen1, task1),
            (1, mock_gen2, task2),
            (2, mock_gen3, task3),
        ]
        not_started: deque[tuple[int, ChatStream]] = deque()

        # Should not raise
        await _cleanup_chat_completion_resources(
            in_progress=in_progress,
            not_started=not_started,
        )

        # All generators should be closed regardless of task state
        assert tracker1.aclose_called
        assert tracker2.aclose_called
        assert tracker3.aclose_called

    async def test_aclose_errors_dont_prevent_other_cleanups(self) -> None:
        """
        Verify that an error in one aclose() doesn't prevent other generators
        from being closed (return_exceptions=True in gather).
        """
        tracker1 = AsyncGenTracker()
        tracker2 = AsyncGenTracker()

        # Make gen1's aclose raise an error via the aclose_error parameter
        mock_gen1 = create_tracked_async_gen(
            chunks=[TextChunk(content="1"), TextChunk(content="1b")],
            tracker=tracker1,
            name="gen1",
            aclose_error=Exception("aclose failed"),
        )
        mock_gen2 = create_tracked_async_gen(
            chunks=[TextChunk(content="2"), TextChunk(content="2b")],
            tracker=tracker2,
            name="gen2",
        )

        # Start all generators so their finally blocks will run on aclose
        await mock_gen1.asend(None)
        await mock_gen2.asend(None)

        # Create completed tasks
        async def completed_task() -> ChatCompletionSubscriptionPayload:
            return TextChunk(content="done")

        task1 = asyncio.create_task(completed_task())
        task2 = asyncio.create_task(completed_task())
        await task1
        await task2

        in_progress: list[tuple[int, ChatStream, asyncio.Task[Any]]] = [
            (0, mock_gen1, task1),
            (1, mock_gen2, task2),
        ]
        not_started: deque[tuple[int, ChatStream]] = deque()

        # Should not raise even though gen1's aclose fails
        await _cleanup_chat_completion_resources(
            in_progress=in_progress,
            not_started=not_started,
        )

        # Both generators should have had aclose called
        # (gen1 raised an error but gen2 should still be closed)
        assert tracker1.aclose_called
        assert tracker2.aclose_called
