from typing import List, Optional, Union

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
class Segment:
    """A segment of the parent's data, split out using a heuristic"""

    bin: strawberry.union("Bin", types=(NominalBin, IntervalBin))  # type: ignore
    values: List[Optional[float]]
