from typing import List, Optional

import strawberry

from .NumericRange import NumericRange


@strawberry.type
class NominalBin:
    """A bin that contains a discrete value"""

    name: str


@strawberry.type
class IntervalBin:
    """A bin that contains a discrete value"""

    # TODO figure out the empty case
    range: NumericRange


@strawberry.type
class DatasetValues:
    """Numeric values per dataset role"""

    primary_value: Optional[float]
    reference_value: Optional[float]


@strawberry.type
class Segment:
    """A segment of the parent's data, split out using a heuristic"""

    bin: strawberry.union("Bin", types=(NominalBin, IntervalBin))  # type: ignore
    counts: DatasetValues
    # TODO add support for a "z" metric list
    # values: List[Optional[float]]


@strawberry.type
class Segments:
    segments: List[Segment]
    total_counts: DatasetValues
