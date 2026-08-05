from typing import Any

import pytest

from phoenix.db.types.token_price_customization import (
    ThresholdBasedTokenPriceCustomization,
    TokenPriceCustomization,
)
from phoenix.server.cost_tracking.token_cost_calculator import (
    ThresholdBasedTokenCostCalculator,
    TokenCostCalculator,
    create_token_cost_calculator,
)

PROMPT_KEY = "llm.token_count.prompt"
BASE_RATE = 1.25e-06
NEW_RATE = 2.5e-06
THRESHOLD = 200_000.0
TOKENS = 500


def _attributes(prompt_tokens: Any) -> dict[str, Any]:
    """Span attributes carrying `prompt_tokens` at `llm.token_count.prompt`.

    Nested, because that is how spans store attributes and how
    `get_attribute_value` reads them — it walks the dotted key through nested
    dicts and finds nothing in a flat `{"llm.token_count.prompt": ...}` mapping.
    A test written flat would fall back to the base rate for the wrong reason
    and assert nothing about the threshold.
    """
    return {"llm": {"token_count": {"prompt": prompt_tokens}}}


def _calculator() -> ThresholdBasedTokenCostCalculator:
    """A tier-priced calculator shaped like the ones the manifest now ships.

    Every flagship model in `model_cost_manifest.json` (claude-sonnet-4*,
    gemini-2.5-pro, gpt-5.*) carries this customization on all four of its token
    prices, keyed on the prompt token count.
    """
    return ThresholdBasedTokenCostCalculator(
        base_rate=BASE_RATE,
        key=PROMPT_KEY,
        threshold=THRESHOLD,
        new_rate=NEW_RATE,
    )


class TestThresholdBasedTokenCostCalculator:
    def test_bills_base_rate_below_threshold(self) -> None:
        cost = _calculator().calculate_cost(_attributes(1_000), TOKENS)
        assert cost == pytest.approx(TOKENS * BASE_RATE)

    def test_bills_new_rate_above_threshold(self) -> None:
        cost = _calculator().calculate_cost(_attributes(250_000), TOKENS)
        assert cost == pytest.approx(TOKENS * NEW_RATE)

    def test_threshold_is_exclusive(self) -> None:
        """Exactly at the threshold still bills at the base rate."""
        cost = _calculator().calculate_cost(_attributes(int(THRESHOLD)), TOKENS)
        assert cost == pytest.approx(TOKENS * BASE_RATE)

    def test_float_token_count_above_threshold(self) -> None:
        cost = _calculator().calculate_cost(_attributes(200_000.5), TOKENS)
        assert cost == pytest.approx(TOKENS * NEW_RATE)

    @pytest.mark.parametrize(
        "value",
        [
            pytest.param("250000", id="numeric_string"),
            pytest.param("not-a-number", id="non_numeric_string"),
            pytest.param([250_000], id="list"),
            pytest.param({"value": 250_000}, id="dict"),
            pytest.param(b"250000", id="bytes"),
            pytest.param(True, id="bool"),
        ],
    )
    def test_non_numeric_token_count_bills_base_rate(self, value: Any) -> None:
        """A token count of the wrong type must not raise.

        OTLP preserves whatever type the client sent, so this attribute can
        arrive as a string, a list, or anything else. Comparing one of those
        against the threshold used to raise `TypeError`, and because every span
        ingestion path catches and logs per span, the span silently lost its
        whole cost record. `get_aggregated_tokens` reads the same attribute and
        falls back the same way.
        """
        cost = _calculator().calculate_cost(_attributes(value), TOKENS)
        assert cost == pytest.approx(TOKENS * BASE_RATE)

    @pytest.mark.parametrize(
        "attributes",
        [
            pytest.param({}, id="missing"),
            pytest.param(_attributes(0), id="zero"),
            pytest.param(_attributes(None), id="none"),
            pytest.param({"llm": {}}, id="empty_branch"),
            pytest.param({"llm": "not-a-dict"}, id="non_dict_branch"),
        ],
    )
    def test_absent_token_count_bills_base_rate(self, attributes: dict[str, Any]) -> None:
        cost = _calculator().calculate_cost(attributes, TOKENS)
        assert cost == pytest.approx(TOKENS * BASE_RATE)

    def test_output_price_tiers_on_the_prompt_count(self) -> None:
        """The output rate escalates on prompt size, not on the tokens billed.

        This is what the manifest encodes: an `output` token price whose
        customization is keyed on `llm.token_count.prompt`. A long prompt
        therefore raises the price of a short completion.
        """
        cost = _calculator().calculate_cost(_attributes(250_000), 10)
        assert cost == pytest.approx(10 * NEW_RATE)


class TestCreateTokenCostCalculator:
    def test_no_customization_yields_flat_calculator(self) -> None:
        calculator = create_token_cost_calculator(BASE_RATE)
        assert type(calculator) is TokenCostCalculator
        assert calculator.calculate_cost(_attributes(250_000), TOKENS) == pytest.approx(
            TOKENS * BASE_RATE
        )

    def test_threshold_customization_yields_threshold_calculator(self) -> None:
        calculator = create_token_cost_calculator(
            BASE_RATE,
            ThresholdBasedTokenPriceCustomization(
                key=PROMPT_KEY,
                threshold=THRESHOLD,
                new_rate=NEW_RATE,
            ),
        )
        assert isinstance(calculator, ThresholdBasedTokenCostCalculator)
        assert calculator.calculate_cost(_attributes(250_000), TOKENS) == pytest.approx(
            TOKENS * NEW_RATE
        )

    def test_unrecognized_customization_falls_back_to_flat_calculator(self) -> None:
        """A forward-compatible customization Phoenix does not implement yet."""
        calculator = create_token_cost_calculator(
            BASE_RATE,
            TokenPriceCustomization.model_validate({"type": "something_new"}),
        )
        assert type(calculator) is TokenCostCalculator
