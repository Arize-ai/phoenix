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
        if not (v := get_attribute_value(attributes, self.key)):
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
