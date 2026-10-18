"""Calculate span costs from token usage and the current model prices."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, Optional

from phoenix.db import models
from phoenix.server.cost_tracking.cost_details_calculator import SpanCostDetailsCalculator
from phoenix.server.daemons.generative_model_store import GenerativeModelStore


class SpanCostCalculator:
    def __init__(
        self,
        model_store: GenerativeModelStore,
    ) -> None:
        self._model_store = model_store

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
