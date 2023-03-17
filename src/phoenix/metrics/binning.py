import warnings
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import partial
from itertools import starmap
from typing import Any, Generator, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
from pandas.core.dtypes.common import is_numeric_dtype
from typing_extensions import TypeAlias


def cuts_to_intervals(
    cuts: Sequence[float],
) -> Generator[Tuple[float, float], None, None]:
    if len(cuts) == 0:
        # no data => (-inf, inf)
        yield float("-inf"), float("inf")
    elif len(cuts) == 1:
        # min == c_0 == max
        #   => (-inf, c_0), (c_0, inf)
        yield float("-inf"), cuts[0]
        yield cuts[0], float("inf")
    else:
        # two scenarios for len(cuts) == k > 1
        # k == 2: min == c_0 < c_1 == max
        #   => (-inf, c_0), (c_{k-2}, inf)
        # k > 2: min == c_0 < c_1 < ... < c_{k-1} == max
        #   => (-inf, c_1), (c_1, c_2), ..., (c_{k-2}, inf)
        yield float("-inf"), cuts[0] if len(cuts) == 2 else cuts[1]
        yield from zip(cuts[1:-1], cuts[2:-1])
        yield cuts[-2], float("inf")


Data: TypeAlias = "pd.Series[Any]"
Histogram: TypeAlias = "pd.Series[int]"


@dataclass
class Binning(ABC):
    dropna: bool = False
    special_missing_values: Sequence[Any] = ()

    @staticmethod
    def _mark_missing(
        data: Data,
        values: List[Any],
        mark: Any = pd.NA,
    ) -> Data:
        if len(values) == 0 or data.empty:
            return data
        return data.replace(values, mark)

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
        values = list(self.special_missing_values)
        data = self._mark_missing(data, values, pd.NA)
        data = pd.to_numeric(data, errors="coerce")
        bins = self.numeric_bins(data) if self.bins is None else self.bins
        return pd.cut(data, bins).value_counts(dropna=self.dropna)


@dataclass
class Quantile(Interval):
    prob: Sequence[float] = ()

    def numeric_bins(self, data: Data) -> NumericBins:
        # always include min and max in quantiles
        prob = sorted({0.0, 1.0}.union(set(self.prob)))
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=RuntimeWarning)
            quantiles = np.nanquantile(data, prob)
        cuts = sorted(set(quantiles[~np.isnan(quantiles)]))
        return pd.IntervalIndex(
            tuple(
                starmap(
                    partial(pd.Interval, closed="left"),  # type: ignore
                    cuts_to_intervals(cuts),
                )
            )
        )

    def __init__(
        self,
        data: Data = pd.Series(dtype=float),
        prob: Iterable[float] = (np.arange(1, 10) / 10),
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self.prob = tuple(prob)
        if data.empty:
            return
        values = list(self.special_missing_values)
        data = self._mark_missing(data, values, pd.NA)
        data = pd.to_numeric(data, errors="coerce")
        self.bins = self.numeric_bins(data)


@dataclass
class Categorical(Binning):
    def histogram(self, data: Data) -> Histogram:
        values = [] if is_numeric_dtype(data) else [None, ""]
        values.extend(self.special_missing_values)
        data = self._mark_missing(data, values, pd.NA)
        return data.value_counts(dropna=self.dropna)


Distribution: TypeAlias = "pd.Series[float]"


@dataclass
class Normalizer(ABC):
    r"""A function that converts counts/frequencies to probabilities."""

    @abstractmethod
    def __call__(self, *counts: Distribution) -> Generator[Distribution, None, None]:
        ...


@dataclass
class AdditiveSmoothing(Normalizer):
    r"""Converts counts to probabilities with optional additive smoothing.

    Parameters
    ----------
    pseudocount : float, optional (default=1)
        The :math:`\alpha` parameter in additive smoothing. Should be
        non-negative. Setting :math:`\alpha` to 0 results in no smoothing.

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

    def __call__(self, *counts: Distribution) -> Generator[Distribution, None, None]:
        alpha = self.pseudocount
        yield from (((col + alpha) / (col.sum() + alpha * len(col))) for col in counts)
