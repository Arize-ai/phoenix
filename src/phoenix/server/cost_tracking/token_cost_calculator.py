from dataclasses import dataclass
from typing import Any, Mapping, Optional

from openinference.semconv.trace import SpanAttributes
from typing_extensions import override

from phoenix.db.types.token_price_customization import (
    ThresholdBasedTokenPriceCustomization,
    TokenPriceCustomization,
)
from phoenix.server.cost_tracking.helpers import (
    get_priced_model_type,
    uses_decision_token_counts,
)
from phoenix.trace.attributes import get_attribute_value

_LLM_TO_DECISION_KEYS: Mapping[str, str] = {
    SpanAttributes.LLM_TOKEN_COUNT_PROMPT: SpanAttributes.DECISION_TOKEN_COUNT_INPUT,
    SpanAttributes.LLM_TOKEN_COUNT_COMPLETION: SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT,
}
_DECISION_TO_LLM_KEYS: Mapping[str, str] = {v: k for k, v in _LLM_TO_DECISION_KEYS.items()}


def _threshold_key(key: str, attributes: Mapping[str, Any]) -> str:
    """
    Return the attribute a threshold reads on this span.

    On DECISION spans the LLM and DECISION token count keys mean the same count, so a threshold
    reads the key of the family the span's tokens are priced from: a tier keyed on
    `llm.token_count.prompt` (as the LLM manifest entries are) reads `decision.token_count.input`
    on a DECISION span that reports it, and a tier keyed on `decision.token_count.input` reads
    `llm.token_count.prompt` on a legacy DECISION span. LLM spans read the key as is.
    """
    if uses_decision_token_counts(attributes):
        return _LLM_TO_DECISION_KEYS.get(key, key)
    if get_priced_model_type(attributes) == "DECISION":
        return _DECISION_TO_LLM_KEYS.get(key, key)
    return key


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
        if not (v := get_attribute_value(attributes, _threshold_key(self.key, attributes))):
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
