import warnings
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable, Iterator, Optional, Sequence

import numpy as np
import pandas as pd
from pandas.core.dtypes.common import is_numeric_dtype
from typing_extensions import TypeAlias

Data: TypeAlias = "pd.Series[Any]"
Histogram: TypeAlias = "pd.Series[int]"


@dataclass
class Binning(ABC):
    dropna: bool = False
    special_missing_values: Sequence[Any] = ()

    @abstractmethod
    def histogram(self, data: Data) -> Histogram:
        ...


NumericBin: TypeAlias = "pd.Interval[float]"
NumericBins: TypeAlias = "pd.IntervalIndex[NumericBin]"


@dataclass
class Interval(Binning):
    bins: Optional[NumericBins] = None

    def numeric_bins(self, _: Data) -> NumericBins:
        return (
            self.bins
            if self.bins is not None
            else pd.IntervalIndex(
                (
                    pd.Interval(
                        float("-inf"),
                        float("inf"),
                        closed="neither",
                    ),
                )
            )
        )

    def histogram(self, data: Data) -> Histogram:
        if len(special_values := list(self.special_missing_values)):
            data = data.replace(special_values, pd.NA)
        data = pd.to_numeric(data, errors="coerce")
        bins = self.numeric_bins(data) if self.bins is None else self.bins
        return pd.cut(data, bins).value_counts(dropna=self.dropna)


@dataclass
class Quantile(Interval):
    probabilities: Sequence[float] = ()

    def numeric_bins(self, data: Data) -> NumericBins:
        # always include min and max in quantiles
        prob = sorted({0.0, 1.0}.union(set(self.probabilities)))
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=RuntimeWarning)
            quantiles = np.nanquantile(data, prob)
        breaks = sorted(set(quantiles[~np.isnan(quantiles)]))
        # extend min and max to inifinties, unless len(breaks) < 3,
        # in which case the min is kept.
        breaks = breaks[1:-1] if len(breaks) > 2 else breaks[:1]
        breaks = [float("-inf")] + breaks + [float("inf")]
        return pd.IntervalIndex.from_breaks(breaks, closed="left")

    def __init__(
        self,
        data: Data = pd.Series(dtype=float),
        probabilities: Iterable[float] = (np.arange(1, 10) / 10),
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self.probabilities = tuple(probabilities)
        if data.empty:
            return
        if len(special_values := list(self.special_missing_values)):
            data = data.replace(special_values, pd.NA)
        data = pd.to_numeric(data, errors="coerce")
        self.bins = self.numeric_bins(data)


@dataclass
class Categorical(Binning):
    def histogram(self, data: Data) -> Histogram:
        if len(
            special_values := ([] if is_numeric_dtype(data) else [None, ""])
            + list(self.special_missing_values)
        ):
            data = data.replace(special_values, pd.NA)
        return data.value_counts(dropna=self.dropna)


Distribution: TypeAlias = "pd.Series[float]"


@dataclass
class Normalizer(ABC):
    """A function that converts counts/frequencies to probabilities."""

    @abstractmethod
    def __call__(self, *counts: Distribution) -> Iterator[Distribution]:
        ...


@dataclass
class AdditiveSmoothing(Normalizer):
    r"""Converts counts to probabilities with optional additive smoothing.

    Parameters
    ----------
    pseudocount : float, default=1
        The :math:`\alpha` parameter in additive smoothing. Should be
        non-negative. Setting :math:`\alpha` to 0 results in no smoothing.
        The default value of 1 is also known as "add-1", Laplace or
        Lidstone smoothing.

    Notes
    -------
    The empirical probability of event :math:`i` is

    .. math::
        p_{i, \text{empirical}} = \frac{x_{i}}{N}

    where :math:`x_{i}` is the count in category :math:`i`,
    :math:`N = \sum^{d}_{i}x_{i}`, and :math:`d` is the number of categories.
    Additive smoothing, also called Laplace or Lidstone smoothing, adds a
    pseudocount :math:`\alpha` per category so that no category has zero
    frequency. The result corresponds to the expected value of the posterior
    distribution, using a symmetric Dirichlet distribution with parameter
    :math:`\alpha` as a prior distribution. In the special case where the
    number of categories is 2, this is equivalent to using a Beta distribution
    as the conjugate prior for the parameters of Binomial distribution. We have

    .. math::
        p_{i, \text{\alpha-smoothed}} = \frac{x_{i}+\alpha}{N+\alpha\times d}

    See https://en.wikipedia.org/wiki/Additive_smoothing

    """
    pseudocount: float = 1

    def __call__(self, *counts: Distribution) -> Iterator[Distribution]:
        alpha = self.pseudocount
        return ((col + alpha) / (col.sum() + alpha * len(col)) for col in counts)
