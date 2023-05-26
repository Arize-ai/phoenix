from typing import Optional

import strawberry

from ..interceptor import GqlValueMediator
from .Dimension import Dimension


@strawberry.type
class DimensionWithValue:
    """
    Represents the dimension of the model and the string representation of that
    value for a specific event.
    """

    dimension: Dimension
    value: Optional[str] = strawberry.field(
        description="The string representation of the dimension's value",
        default=GqlValueMediator(),
    )
