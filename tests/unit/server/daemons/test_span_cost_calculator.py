from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.exc import IntegrityError

from phoenix.db import models
from phoenix.server.daemons.span_cost_calculator import (
    SpanCostCalculator,
    SpanCostCalculatorQueueItem,
)

_NOW = datetime.now(timezone.utc)


def _conflict() -> IntegrityError:
    return IntegrityError(
        "INSERT", {}, Exception("UNIQUE constraint failed: span_costs.span_rowid")
    )


class _FakeSession:
    """Records every `SpanCost` added to it. `add_all` and `add` raise the
    session factory's configured exception (if any) instead of touching a
    real database, so the retry logic under test is exercised in isolation."""

    def __init__(self, added: list[models.SpanCost], fail_span_rowids: frozenset[int]) -> None:
        self._added = added
        self._fail_span_rowids = fail_span_rowids

    def add_all(self, costs: list[models.SpanCost]) -> None:
        if any(c.span_rowid in self._fail_span_rowids for c in costs):
            raise _conflict()
        self._added.extend(costs)

    def add(self, cost: models.SpanCost) -> None:
        if cost.span_rowid in self._fail_span_rowids:
            raise _conflict()
        self._added.append(cost)


def _make_db(
    added: list[models.SpanCost], fail_span_rowids: frozenset[int]
) -> Callable[[], AbstractAsyncContextManager[_FakeSession]]:
    @asynccontextmanager
    async def db() -> AsyncIterator[_FakeSession]:
        yield _FakeSession(added, fail_span_rowids)

    return db


def _item(span_rowid: int) -> SpanCostCalculatorQueueItem:
    return SpanCostCalculatorQueueItem(
        span_rowid=span_rowid,
        trace_rowid=1,
        attributes={"llm": {"token_count": {"prompt": 1}}},
        span_start_time=_NOW,
    )


@pytest.mark.parametrize("conflicting_span_rowid", [1, 2])
async def test_insert_costs_skips_only_the_conflicting_row(conflicting_span_rowid: int) -> None:
    """`span_costs.span_rowid` is unique. A batch containing a span that
    already has a cost row -- a re-queued item after a prior partial
    failure, or another writer racing to insert the same span -- must not
    also drop every other span's legitimate cost in the same batch: only
    the conflicting row is skipped (regardless of its position in the
    batch), and everything else is still committed.
    """
    added: list[models.SpanCost] = []
    calculator = SpanCostCalculator(
        db=_make_db(added, frozenset({conflicting_span_rowid})),  # type: ignore[arg-type]
        model_store=AsyncMock(),
    )
    calculator.put_nowait(_item(1))
    calculator.put_nowait(_item(2))
    calculator.calculate_cost = lambda start_time, attributes: models.SpanCost(  # type: ignore[method-assign]
        span_start_time=start_time
    )

    # Must not raise: the conflict is caught and only that row is skipped.
    await calculator._insert_costs(2)

    assert sorted(c.span_rowid for c in added) == sorted({1, 2} - {conflicting_span_rowid})


async def test_insert_costs_swallows_non_conflict_errors_per_item() -> None:
    """A non-conflict error on the per-item retry (e.g. a transient
    connection failure) must not abort the retry of the remaining items in
    the batch -- it is logged and the loop continues."""
    added: list[models.SpanCost] = []

    class _FlakySession(_FakeSession):
        def add(self, cost: models.SpanCost) -> None:
            if cost.span_rowid == 1:
                raise RuntimeError("transient failure")
            super().add(cost)

    @asynccontextmanager
    async def db() -> AsyncIterator[_FlakySession]:
        # span 1 alone is enough to force the batch add_all to fail and fall
        # into the per-item retry; span 2 must not also be in this set, or
        # its retry would hit the same simulated conflict instead of the
        # override below succeeding via super().add().
        yield _FlakySession(added, frozenset({1}))

    calculator = SpanCostCalculator(db=db, model_store=AsyncMock())  # type: ignore[arg-type]
    calculator.put_nowait(_item(1))
    calculator.put_nowait(_item(2))
    calculator.calculate_cost = lambda start_time, attributes: models.SpanCost(  # type: ignore[method-assign]
        span_start_time=start_time
    )

    await calculator._insert_costs(2)

    assert sorted(c.span_rowid for c in added) == [2]
