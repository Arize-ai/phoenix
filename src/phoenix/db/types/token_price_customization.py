from abc import ABC
from typing import Any, Literal, Optional

from pydantic import BaseModel, ValidationError


class TokenPriceCustomization(BaseModel, ABC):
    model_config = {"extra": "allow"}


class ThresholdBasedTokenPriceCustomization(TokenPriceCustomization):
    type: Literal["threshold_based"] = "threshold_based"
    key: str
    threshold: float
    new_rate: float


class TokenPriceCustomizationParser:
    """Intended to be forward-compatible while maintaining the ability to round-trip."""

    @staticmethod
    def parse(data: Optional[dict[str, Any]]) -> Optional[TokenPriceCustomization]:
        if not data:
            return None
        try:
            return ThresholdBasedTokenPriceCustomization.model_validate(data)
        except ValidationError:
            pass
        return TokenPriceCustomization.model_validate(data)
