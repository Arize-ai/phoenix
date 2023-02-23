import strawberry

from .Dimension import Dimension


@strawberry.type
class DimensionWithValue:
    """
    Represents the dimension of the model and the string representation of that
    value for a specific event.
    """

    dimension: Dimension
    value: str
