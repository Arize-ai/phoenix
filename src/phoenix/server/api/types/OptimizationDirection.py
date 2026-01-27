from enum import Enum
from typing import Union

import strawberry


@strawberry.enum
class OptimizationDirection(Enum):
    MINIMIZE = "MINIMIZE"
    MAXIMIZE = "MAXIMIZE"
    NONE = "NONE"


def to_gql_optimization_direction(
    value: Union[str, "OptimizationDirection"],
) -> OptimizationDirection:
    """Convert a string or db enum value to the GraphQL OptimizationDirection enum."""
    if isinstance(value, OptimizationDirection):
        return value
    # Handle both string values and db enum types
    str_value = value.value if hasattr(value, "value") else str(value)
    return OptimizationDirection(str_value)
