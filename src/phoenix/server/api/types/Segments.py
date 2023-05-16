import math
from dataclasses import dataclass
from typing import Any, List, Optional, Union, overload

import pandas as pd
import strawberry
from strawberry import UNSET

from ..interceptor import NoneIfNan
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
    numeric_lbound: float = float("-inf")
    numeric_ubound: float = float("inf")

    @overload
    def __call__(self, bin: "pd.Interval[float]") -> IntervalBin:
        ...

    @overload
    def __call__(self, bin: Union[str, int, float]) -> Union[NominalBin, MissingValueBin]:
        ...

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
class DatasetValues:
    """Numeric values per dataset role"""

    primary_value: Optional[float] = strawberry.field(default=NoneIfNan())
    reference_value: Optional[float] = strawberry.field(default=NoneIfNan())

    def __iadd__(self, other: "DatasetValues") -> "DatasetValues":
        # TODO: right now NaN is ignored due to the logic of the NoneIfNan
        # descriptor, i.e. adding NaN to a non-NaN existing value doesn't make
        # it NaN, or if the existing value is NaN, then adding a non-NaN value
        # to it will make it non-NaN.
        if self.primary_value is None:
            self.primary_value = other.primary_value
        elif other.primary_value is not None:
            self.primary_value += other.primary_value
        if self.reference_value is None:
            self.reference_value = other.reference_value
        elif other.reference_value is not None:
            self.reference_value += other.reference_value
        return self


@strawberry.type
class Segment:
    """A segment of the parent's data, split out using a heuristic"""

    bin: strawberry.union(  # type: ignore
        "Bin",
        types=(
            NominalBin,
            IntervalBin,
            MissingValueBin,
        ),
    )
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

    def append(self, other: Segment) -> "Segments":
        self.segments.append(other)
        self.total_counts += other.counts
        return self
