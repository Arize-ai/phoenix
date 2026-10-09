"""
Cost calculation for Mistral AI token prices as synced from LiteLLM.

The sync's provider-prefix and filtering behavior for ``mistral/*`` IDs is covered by
``scripts/cost_tracking/test_sync_models.py``. See Arize-ai/phoenix#16878.
"""

import pytest

from phoenix.db import models
from phoenix.server.cost_tracking.cost_details_calculator import SpanCostDetailsCalculator


class TestMistralCostCalculation:
    def test_input_and_output_token_costs(self) -> None:
        calculator = SpanCostDetailsCalculator(
            [
                models.TokenPrice(token_type="input", is_prompt=True, base_rate=5e-7),
                models.TokenPrice(token_type="output", is_prompt=False, base_rate=1.5e-6),
            ]
        )
        details = calculator.calculate_details(
            {"llm": {"token_count": {"prompt": 1000, "completion": 500}}}
        )
        prompt = {detail.token_type: detail for detail in details if detail.is_prompt}
        completion = {detail.token_type: detail for detail in details if not detail.is_prompt}
        assert prompt["input"].cost == pytest.approx(1000 * 5e-7)
        assert completion["output"].cost == pytest.approx(500 * 1.5e-6)

    def test_missing_completion_usage_bills_prompt_only(self) -> None:
        calculator = SpanCostDetailsCalculator(
            [
                models.TokenPrice(token_type="input", is_prompt=True, base_rate=5e-7),
                models.TokenPrice(token_type="output", is_prompt=False, base_rate=1.5e-6),
            ]
        )
        details = calculator.calculate_details({"llm": {"token_count": {"prompt": 1000}}})
        prompt = {detail.token_type: detail for detail in details if detail.is_prompt}
        completion = {detail.token_type: detail for detail in details if not detail.is_prompt}
        assert prompt["input"].cost == pytest.approx(1000 * 5e-7)
        assert "output" not in completion

    def test_missing_usage_metadata_yields_no_cost_details(self) -> None:
        calculator = SpanCostDetailsCalculator(
            [
                models.TokenPrice(token_type="input", is_prompt=True, base_rate=5e-7),
                models.TokenPrice(token_type="output", is_prompt=False, base_rate=1.5e-6),
            ]
        )
        assert calculator.calculate_details({}) == []
        assert calculator.calculate_details({"llm": {}}) == []
