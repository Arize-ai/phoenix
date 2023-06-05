from typing import List, Optional

import strawberry
from strawberry import UNSET

from phoenix.core.model_schema import Dimension
from phoenix.server.api.helpers import ensure_list
from phoenix.server.api.types.DimensionDataType import DimensionDataType
from phoenix.server.api.types.DimensionShape import DimensionShape
from phoenix.server.api.types.DimensionType import DimensionType


@strawberry.input
class DimensionFilter:
    """Returns False if and only if a dimension fails to match one of the
    specified attributes. For example,
    DimensionFilter(types=["feature", "tag"], shapes=["discrete"])
    is True for any feature or tag that is discrete. In other words, while
    each non-empty (list) attribute represents a standalone OR condition, all
    non-empty (list) attributes taken together represents an AND condition.

    Example
    -------

    Dimensions

    A: Dimension(type=actual,  shape=discrete)
    B: Dimension(type=actual,  shape=continuous)
    C: Dimension(type=feature, shape=discrete)
    D: Dimension(type=feature, shape=continuous)
    E: Dimension(type=tag,     shape=discrete)
    F: Dimension(type=tag,     shape=continuous)

    Truth Table (✓ = True, otherwise False)

    +--------------------+----------------+---+---+---+---+---+---+
    | types              | shapes         | A | B | C | D | E | F |
    +====================+================+===+===+===+===+===+===+
    | UNSET or []        | UNSET or []    | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
    | UNSET or []        | ["discrete"]   | ✓ |   | ✓ |   | ✓ |   |
    | UNSET or []        | ["continuous"] |   | ✓ |   | ✓ |   | ✓ |
    | ["actual"]         | UNSET or []    | ✓ | ✓ |   |   |   |   |
    | ["actual"]         | ["discrete"]   | ✓ |   |   |   |   |   |
    | ["actual"]         | ["continuous"] |   | ✓ |   |   |   |   |
    | ["actual", "tag"]  | UNSET or []    | ✓ | ✓ |   |   | ✓ | ✓ |
    | ["actual", "tag"]  | ["discrete"]   | ✓ |   |   |   | ✓ |   |
    | ["actual", "tag"]  | ["continuous"] |   | ✓ |   |   |   | ✓ |
    | ["tag", "feature"] | UNSET or []    |   |   | ✓ | ✓ | ✓ | ✓ |
    | ["tag", "feature"] | ["discrete"]   |   |   | ✓ |   | ✓ |   |
    | ["tag", "feature"] | ["continuous"] |   |   |   | ✓ |   | ✓ |
    +--------------------+----------------+---+---+---+---+---+---+

    """

    types: Optional[List[DimensionType]] = UNSET
    shapes: Optional[List[DimensionShape]] = UNSET
    data_types: Optional[List[DimensionDataType]] = UNSET

    def __post_init__(self) -> None:
        self.types = ensure_list(self.types)
        self.shapes = ensure_list(self.shapes)
        self.data_types = ensure_list(self.data_types)

    def matches(self, dimension: Dimension) -> bool:
        if self.types and DimensionType.from_dimension(dimension) not in self.types:
            return False
        if self.shapes and DimensionShape.from_dimension(dimension) not in self.shapes:
            return False
        if self.data_types and DimensionDataType.from_dimension(dimension) not in self.data_types:
            return False
        return True
