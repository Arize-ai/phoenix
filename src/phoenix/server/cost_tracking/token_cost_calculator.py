from dataclasses import dataclass
from typing import Any, Mapping, Optional

from openinference.semconv.trace import SpanAttributes
from typing_extensions import override

from phoenix.db.types.token_price_customization import (
    ThresholdBasedTokenPriceCustomization,
    TokenPriceCustomization,
)
from phoenix.trace.attributes import get_attribute_value

_TOKEN_COUNT_KEY_ALIASES: Mapping[str, str] = {
    SpanAttributes.LLM_TOKEN_COUNT_PROMPT: SpanAttributes.DECISION_TOKEN_COUNT_INPUT,
    SpanAttributes.DECISION_TOKEN_COUNT_INPUT: SpanAttributes.LLM_TOKEN_COUNT_PROMPT,
    SpanAttributes.LLM_TOKEN_COUNT_COMPLETION: SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT,
    SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT: SpanAttributes.LLM_TOKEN_COUNT_COMPLETION,
}
"""
LLM and DECISION token count keys that mean the same count. A threshold keyed on one of them
reads the other when the span doesn't set it, so a tier keyed on `llm.token_count.prompt` (as
the LLM manifest entries are) also applies to a DECISION span that reports
`decision.token_count.input`, and the reverse for legacy DECISION spans with `llm.*` counts.
"""


@dataclass(frozen=True)
class TokenCostCalculator:
    base_rate: float

    def calculate_cost(
        self,
        attributes: Mapping[str, Any],
        tokens: int,
    ) -> float:
        return tokens * self.base_rate


@dataclass(frozen=True)
class ThresholdBasedTokenCostCalculator(TokenCostCalculator):
    key: str
    threshold: float
    new_rate: float

    @override
    def calculate_cost(
        self,
        attributes: Mapping[str, Any],
        tokens: float,
    ) -> float:
        v = get_attribute_value(attributes, self.key)
        if v is None and (alias := _TOKEN_COUNT_KEY_ALIASES.get(self.key)):
            v = get_attribute_value(attributes, alias)
        if not v:
            return tokens * self.base_rate
        if v > self.threshold:
            return tokens * self.new_rate
        return tokens * self.base_rate


def create_token_cost_calculator(
    base_rate: float,
    customization: Optional[TokenPriceCustomization] = None,
) -> TokenCostCalculator:
    if not customization:
        return TokenCostCalculator(base_rate=base_rate)
    if isinstance(customization, ThresholdBasedTokenPriceCustomization):
        return ThresholdBasedTokenCostCalculator(
            base_rate=base_rate,
            key=customization.key,
            threshold=customization.threshold,
            new_rate=customization.new_rate,
        )
    return TokenCostCalculator(base_rate=base_rate)
