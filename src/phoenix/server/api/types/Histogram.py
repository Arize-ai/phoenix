from typing import List

import strawberry

from .NumericRange import NumericRange


@strawberry.interface
class HistogramBin:
    """A bin in a histogram"""

    value: int
    # TODO add units support


@strawberry.type
class NumericBin(HistogramBin):
    """A numeric bin in a histogram"""

    range: NumericRange


@strawberry.type
class CategoricalBin(HistogramBin):
    """A categorical bin in a histogram"""

    category: str


@strawberry.type
class NumericHistogram:
    """A numeric histogram"""

    bins: List[NumericBin]


@strawberry.type
class CategoricalHistogram:
    """A categorical histogram"""

    bins: List[CategoricalBin]
