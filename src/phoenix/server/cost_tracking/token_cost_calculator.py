from dataclasses import dataclass
from typing import Any, Mapping, Optional

from typing_extensions import override

from phoenix.db.types.token_price_customization import (
    ThresholdBasedTokenPriceCustomization,
    TokenPriceCustomization,
)
from phoenix.trace.attributes import get_attribute_value


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
        # `v` is whatever the span carried: OTLP preserves the type the client
        # sent, so a token count can arrive as a string or a list. Comparing one
        # of those against the threshold raises, which costs the span its entire
        # cost record — the callers that ingest spans swallow the error and move
        # on. Anything not numeric bills at the base rate, matching how
        # `get_aggregated_tokens` reads the same attributes. `bool` is excluded
        # because it is an `int` subclass and never a token count.
        if not isinstance(v, (int, float)) or isinstance(v, bool) or not v:
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
