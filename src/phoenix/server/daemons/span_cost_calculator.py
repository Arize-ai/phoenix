from __future__ import annotations

import logging
from asyncio import sleep
from collections import deque
from datetime import datetime
from typing import Any, Mapping, NamedTuple, Optional

from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.cost_tracking.cost_details_calculator import SpanCostDetailsCalculator
from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_GenerativeModelId: TypeAlias = int


class SpanCostCalculatorQueueItem(NamedTuple):
    span_rowid: int
    trace_rowid: int
    attributes: Mapping[str, Any]
    span_start_time: datetime


class SpanCostCalculator(DaemonTask):
    _SLEEP_INTERVAL = 5  # seconds

    def __init__(
        self,
        db: DbSessionFactory,
        model_store: GenerativeModelStore,
    ) -> None:
        super().__init__()
        self._db = db
        self._model_store = model_store
        self._queue: deque[SpanCostCalculatorQueueItem] = deque()
        self._max_items_per_transaction = 1000

    async def _run(self) -> None:
        while self._running:
            num_items_to_insert = min(self._max_items_per_transaction, len(self._queue))
            try:
                await self._insert_costs(num_items_to_insert)
            except Exception as e:
                logger.exception(f"Failed to insert costs: {e}")
            await sleep(self._SLEEP_INTERVAL)

    async def _insert_costs(self, num_items_to_insert: int) -> None:
        if not num_items_to_insert or not self._queue:
            return
        costs: list[models.SpanCost] = []
        while num_items_to_insert > 0:
            num_items_to_insert -= 1
            item = self._queue.popleft()
            try:
                cost = self.calculate_cost(item.span_start_time, item.attributes)
            except Exception as e:
                logger.exception(f"Failed to calculate cost for span {item.span_rowid}: {e}")
                continue
            if not cost:
                continue
            cost.span_rowid = item.span_rowid
            cost.trace_rowid = item.trace_rowid
            costs.append(cost)
        try:
            async with self._db() as session:
                session.add_all(costs)
        except Exception as e:
            logger.exception(f"Failed to insert costs: {e}")

    def put_nowait(self, item: SpanCostCalculatorQueueItem) -> None:
        self._queue.append(item)

    def calculate_cost(
        self,
        start_time: datetime,
        attributes: Mapping[str, Any],
    ) -> Optional[models.SpanCost]:
        if not attributes:
            return None
        cost_model = self._model_store.find_model(
            start_time=start_time,
            attributes=attributes,
        )
        calculator = SpanCostDetailsCalculator(cost_model.token_prices if cost_model else [])
        details = calculator.calculate_details(attributes)
        if not details:
            return None

        cost = models.SpanCost(
            model_id=cost_model.id if cost_model else None,
            span_start_time=start_time,
        )
        for detail in details:
            cost.append_detail(detail)
        return cost
