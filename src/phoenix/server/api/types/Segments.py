import math
from dataclasses import dataclass
from typing import Any, List, Optional, Union, overload

import numpy as np
import pandas as pd
import strawberry
from strawberry import UNSET
from typing_extensions import Annotated

from .DatasetValues import DatasetValues
from .NumericRange import NumericRange


@strawberry.type
class NominalBin:
    """A bin that contains a discrete value"""

    name: str


@strawberry.type
class MissingValueBin:
    name: Optional[str] = UNSET


@strawberry.type
class IntervalBin:
    """A bin that contains a discrete value"""

    # TODO figure out the empty case
    range: NumericRange


@dataclass(frozen=True)
class GqlBinFactory:
    numeric_lbound: float = -np.inf
    numeric_ubound: float = np.inf

    @overload
    def __call__(self, bin: "pd.Interval[float]") -> IntervalBin: ...

    @overload
    def __call__(self, bin: Union[str, int, float]) -> Union[NominalBin, MissingValueBin]: ...

    def __call__(self, bin: Any) -> Union[NominalBin, IntervalBin, MissingValueBin]:
        if isinstance(bin, pd.Interval):
            return IntervalBin(
                range=NumericRange(
                    start=max(bin.left, self.numeric_lbound),
                    end=min(bin.right, self.numeric_ubound),
                )
            )
        if isinstance(bin, float) and math.isnan(bin):
            return MissingValueBin()
        return NominalBin(name=str(bin))


@strawberry.type
class Segment:
    """A segment of the parent's data, split out using a heuristic"""

    bin: Annotated[
        Union[
            NominalBin,
            IntervalBin,
            MissingValueBin,
        ],
        strawberry.union("Bin"),
    ]
    counts: DatasetValues = strawberry.field(
        default_factory=DatasetValues,
    )
    # TODO add support for a "z" metric list
    # values: List[Optional[float]]


@strawberry.type
class Segments:
    segments: List[Segment] = strawberry.field(default_factory=list)
    total_counts: DatasetValues = strawberry.field(
        default_factory=DatasetValues,
    )

    def append(self, other: Segment) -> None:
        if (
            isinstance(other.bin, IntervalBin)
            and not math.isfinite(other.bin.range.start)
            and not math.isfinite(other.bin.range.end)
            and other.counts.primary_value == 0
            and other.counts.reference_value == 0
        ):
            # Skip the interval bin with zero counts if it has -inf and +inf
            # as the endpoints, as it could occur due to all values being
            # missing. Because such bin can exist a priori, the caller may
            # still try to append it, but the bin has no real value at this
            # point (and can cause problems for graphql because of the end
            # points are not serializable to JSON).
            return
        self.segments.append(other)
        self.total_counts += other.counts
