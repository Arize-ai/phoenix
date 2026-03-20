"""Unit tests for BulkInserter loop behavior (wake-up, timeout, drain, parallelism)."""

from __future__ import annotations

import asyncio
from time import perf_counter
from unittest.mock import AsyncMock, MagicMock

from phoenix.db.bulk_inserter import BulkInserter
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.types import DbSessionFactory

# ---------------------------------------------------------------------------
# Test doubles
# ---------------------------------------------------------------------------


class _FakeEventQueue:
    """Minimal CanPutItem[DmlEvent] implementation."""

    def put(self, item: object) -> None:
        pass


class _TrackingInserter(BulkInserter):
    """BulkInserter that records timestamps when _insert_spans is called with n > 0."""

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)  # type: ignore[arg-type]
        self.insert_span_calls: list[float] = []

    async def _insert_spans(self, num_spans_to_insert: int) -> None:
        if num_spans_to_insert:
            self.insert_span_calls.append(perf_counter())

    async def _insert_evaluations(self, num_evals_to_insert: int) -> None:
        pass

    async def _drain_operations(self) -> None:
        pass


def _make_inserter(sleep: float = 0.5) -> _TrackingInserter:
    """Return a _TrackingInserter with a mocked db and cost calculator."""
    db = MagicMock(spec=DbSessionFactory)
    fake_session = AsyncMock()
    db.return_value.__aenter__ = AsyncMock(return_value=fake_session)
    db.return_value.__aexit__ = AsyncMock(return_value=False)

    cost_calculator = MagicMock(spec=SpanCostCalculator)
    cost_calculator.calculate_cost.return_value = None

    return _TrackingInserter(
        db=db,
        event_queue=_FakeEventQueue(),
        span_cost_calculator=cost_calculator,
        sleep=sleep,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestImmediateWakeUp:
    """When a span is enqueued, the insert loop should wake up immediately
    (well before the sleep interval elapses)."""

    async def test_span_processed_before_sleep_interval(self) -> None:
        sleep = 0.5  # half a second — long enough to detect a missed wake-up
        inserter = _make_inserter(sleep=sleep)

        async with inserter:
            start = perf_counter()
            await inserter._enqueue_span(MagicMock(), "test_project")
            deadline = start + sleep * 0.5  # must finish in < half the sleep interval
            while perf_counter() < deadline:
                if inserter.insert_span_calls:
                    break
                await asyncio.sleep(0.01)
            elapsed = perf_counter() - start

        assert inserter.insert_span_calls, "_insert_spans was never called"
        assert elapsed < sleep, f"Insert took {elapsed:.3f}s, should be < sleep interval {sleep}s"

    async def test_wake_event_is_set_on_enqueue(self) -> None:
        inserter = _make_inserter()
        inserter._running = True
        inserter._operations = asyncio.Queue()
        await inserter._enqueue_span(MagicMock(), "test_project")
        assert inserter._wake_event.is_set(), "_wake_event should be set after enqueue"


class TestTimeoutFallback:
    """With no wake signal, _wait_for_work() should block for approximately
    the configured sleep interval before returning (timeout path)."""

    async def test_wait_for_work_blocks_for_sleep_interval(self) -> None:
        sleep = 0.1  # short enough to keep the test fast
        inserter = _make_inserter(sleep=sleep)

        start = perf_counter()
        await inserter._wait_for_work()
        elapsed = perf_counter() - start

        # Should have waited at least the sleep interval (minus 10ms tolerance for scheduling)
        assert elapsed >= sleep - 0.01, (
            f"_wait_for_work returned too quickly: {elapsed:.3f}s < {sleep:.3f}s"
        )
        # Should not have waited significantly longer than the interval
        assert elapsed < sleep * 3, (
            f"_wait_for_work waited too long: {elapsed:.3f}s > {sleep * 3:.3f}s"
        )

    async def test_wait_for_work_returns_early_on_wake(self) -> None:
        sleep = 0.5  # long enough that early return is clearly distinguishable
        inserter = _make_inserter(sleep=sleep)

        async def set_event_soon() -> None:
            await asyncio.sleep(0.05)
            inserter._wake_event.set()

        start = perf_counter()
        asyncio.create_task(set_event_soon())
        await inserter._wait_for_work()
        elapsed = perf_counter() - start

        # Should have returned well before the full sleep interval
        assert elapsed < sleep * 0.5, (
            f"_wait_for_work did not wake up early: {elapsed:.3f}s >= {sleep * 0.5:.3f}s"
        )


class TestShutdownDrain:
    """After __aexit__, all items buffered before shutdown must be processed
    (not silently dropped)."""

    async def test_spans_enqueued_before_exit_are_processed(self) -> None:
        # Use a short sleep so the test doesn't block long during drain
        inserter = _make_inserter(sleep=0.05)

        # Track how many spans _insert_spans was asked to process in total
        spans_processed: list[int] = []

        async def counting_insert_spans(n: int) -> None:
            if n:
                spans_processed.append(n)
            # Drain the internal deque so the loop's while-condition can clear
            for _ in range(n):
                if inserter._spans:
                    inserter._spans.popleft()

        inserter._insert_spans = counting_insert_spans  # type: ignore[assignment]

        num_spans = 5
        async with inserter as (_, enqueue_span, _enqueue_eval, _enqueue_op):
            for _ in range(num_spans):
                await enqueue_span(MagicMock(), "test_project")
            # __aexit__ is called here; the loop should drain remaining spans before stopping

        total_processed = sum(spans_processed)
        assert total_processed == num_spans, (
            f"Expected {num_spans} spans processed, got {total_processed} "
            "(some spans may have been dropped on shutdown)"
        )


class TestParallelOperationsAndSpans:
    """Operations and spans should be processed concurrently within the same
    loop iteration via asyncio.gather, not sequentially."""

    async def test_both_processed_without_interference(self) -> None:
        """Enqueue both an operation and a span; verify both are processed."""
        inserter = _make_inserter(sleep=0.5)

        ops_processed: list[bool] = []
        spans_processed: list[bool] = []

        async def tracking_drain_operations() -> None:
            ops_processed.append(True)

        async def tracking_insert_spans(n: int) -> None:
            if n:
                spans_processed.append(True)
                # Pop from deque so the loop condition clears
                for _ in range(n):
                    if inserter._spans:
                        inserter._spans.popleft()

        inserter._drain_operations = tracking_drain_operations  # type: ignore[method-assign]
        inserter._insert_spans = tracking_insert_spans  # type: ignore[method-assign,assignment]

        async with inserter as (_, enqueue_span, _enqueue_eval, enqueue_op):
            await enqueue_span(MagicMock(), "test_project")
            enqueue_op(MagicMock())
            # Give the loop one iteration to pick up both
            await asyncio.sleep(0.05)

        assert ops_processed, "_drain_operations was never called — operation was dropped"
        assert spans_processed, "_insert_spans was never called — span was dropped"

    async def test_operations_and_spans_run_concurrently(self) -> None:
        """Verify operations and spans run concurrently (overlapping wall-clock time)
        by introducing a small async delay in each and checking that the combined
        elapsed time is less than the sum of the individual delays."""
        inserter = _make_inserter(sleep=0.5)
        delay = 0.05  # 50ms delay per phase

        start_times: dict[str, float] = {}
        end_times: dict[str, float] = {}

        async def slow_drain_operations() -> None:
            start_times["ops"] = perf_counter()
            await asyncio.sleep(delay)
            end_times["ops"] = perf_counter()

        async def slow_insert_spans(n: int) -> None:
            if n:
                start_times["spans"] = perf_counter()
                await asyncio.sleep(delay)
                end_times["spans"] = perf_counter()
                for _ in range(n):
                    if inserter._spans:
                        inserter._spans.popleft()

        inserter._drain_operations = slow_drain_operations  # type: ignore[method-assign]
        inserter._insert_spans = slow_insert_spans  # type: ignore[method-assign,assignment]

        async with inserter as (_, enqueue_span, _enqueue_eval, enqueue_op):
            await enqueue_span(MagicMock(), "test_project")
            enqueue_op(MagicMock())
            # Wait for at least one gather iteration to complete
            await asyncio.sleep(delay * 3)

        assert "ops" in start_times and "spans" in start_times, "Both phases must have been reached"
        # If they ran concurrently, the wall-clock time for both together
        # should be < 2× the individual delay (i.e., they overlapped).
        total_wall = max(end_times["ops"], end_times["spans"]) - min(
            start_times["ops"], start_times["spans"]
        )
        assert total_wall < delay * 1.8, (
            f"Operations and spans ran sequentially (wall time {total_wall:.3f}s "
            f">= {delay * 1.8:.3f}s) — asyncio.gather may not be working"
        )
