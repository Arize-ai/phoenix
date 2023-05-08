import strawberry

from .NumericRange import NumericRange


@strawberry.interface
class HistogramBin:
    """A bin in a histogram"""

    value: int
    # TODO add units support


@strawberry.interface
class NumericBin(HistogramBin):
    """A numeric bin in a histogram"""

    range: NumericRange


@strawberry.interface
class CategoricalBin(HistogramBin):
    """A categorical bin in a histogram"""

    category: str
