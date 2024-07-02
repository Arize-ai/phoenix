import warnings
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import partial
from typing import Any, Iterable, Optional, Sequence, cast

import numpy as np
import pandas as pd
from typing_extensions import TypeAlias

from phoenix.core.model_schema import Column
from phoenix.metrics import Metric, multi_calculate

Histogram: TypeAlias = "pd.Series[int]"


@dataclass(frozen=True)
class BinningMethod(ABC):
    """Ways to construct histograms from data, e.g. we can treat each distinct
    value as a discrete category, or group an interval of numeric values
    together as a category."""

    dropna: bool = False
    """whether the missing values should be dropped (default is False and
    missing values will be grouped into a bin of their own)"""

    @abstractmethod
    def histogram(self, data: "pd.Series[Any]") -> Histogram: ...

    @abstractmethod
    def segmented_summary(
        self,
        group_by: Column,
        dataframe: pd.DataFrame,
        metrics: Iterable[Metric],
    ) -> pd.DataFrame: ...


NumericBin: TypeAlias = "pd.Interval[float]"
NumericBins: TypeAlias = "pd.IntervalIndex[NumericBin]"


@dataclass(frozen=True)
class IntervalBinning(BinningMethod):
    """Ways to construct histograms on numeric data by specifying the exact
    bins in the form of a `pandas.IntervalIndex`. Values outside the intervals
    are grouped as missing values. By default, missing values are grouped and
    counted. Setting `dropna=True` removes the missing value category from the
    output.

    Example
    -------

    >>> import pandas as pd
    >>> bins = pd.IntervalIndex.from_breaks(range(3))
    >>> bins
    IntervalIndex([(0, 1], (1, 2]], dtype='interval[int64, right]')
    >>> data = pd.Series(range(4), dtype=int)
    >>> data
    0    0
    1    1
    2    2
    3    3
    dtype: int64
    >>> binning.IntervalBinning(bins=bins).histogram(data)
    NaN           2
    (0.0, 1.0]    1
    (1.0, 2.0]    1
    dtype: int64
    """

    bins: Optional[NumericBins] = None

    def numeric_bins(self, _: "pd.Series[Any]") -> NumericBins:
        return (
            self.bins
            if self.bins is not None
            else pd.IntervalIndex(
                (
                    pd.Interval(
                        -np.inf,
                        np.inf,
                        closed="neither",
                    ),
                )
            )
        )

    def histogram(self, data: "pd.Series[Any]") -> Histogram:
        numeric_data = pd.to_numeric(data, errors="coerce")
        bins = self.numeric_bins(numeric_data)
        cut = pd.cut(numeric_data, bins)
        return cut.value_counts(dropna=self.dropna)

    def segmented_summary(
        self,
        segment_column: Column,
        dataframe: pd.DataFrame,
        metrics: Iterable[Metric],
    ) -> pd.DataFrame:
        """Outputs a dataframe similar to the example below, with IntervalBins
        as row indices and metric.id() as columns (for zero, one, or more
        metrics). NaN represents the missing value bin when dropna=False.
        Similar to SQL, unobserved bins are excluded and the output is not
        sorted.

        +-----------------+-----+-----+
        | IntervalBin     | 123 | 456 | <- metric.id()
        +=================+=====+=====+
        | NaN             |   2 |   5 | <- NaN as bin for missing values
        +-----------------+-----+-----+
        | [-2.0, 2.0)     |   3 |   6 |
        +-----------------+-----+-----+
        | [-inf, -2000.0) |   1 |   1 |
        +-----------------+-----+-----+
        """
        segment_data = pd.to_numeric(
            segment_column(dataframe),
            errors="coerce",
        )
        calculate_metrics = partial(
            multi_calculate,
            calcs=metrics,
        )
        cut = pd.cut(
            segment_data,
            self.numeric_bins(segment_data),
        )
        if self.dropna:
            return dataframe.groupby(
                cut,
                dropna=self.dropna,
                observed=True,
                group_keys=True,
                sort=False,
            ).apply(calculate_metrics)
        # As of pandas 1.5.3, `dropna=False` has no effect for our use case
        # below (i.e. NaN always gets dropped), so we resort to grouping by
        # `cut.cat.codes first, and reconstituting the `cut.cat.categories`
        # afterward.
        summary = dataframe.groupby(
            cut.cat.codes,
            dropna=self.dropna,
            observed=True,
            group_keys=True,
            sort=False,
        ).apply(calculate_metrics)
        categories = pd.Categorical.from_codes(
            cast(Sequence[int], summary.index.values),
            cut.cat.categories,
        )
        return summary.set_axis(
            categories,
            axis=0,
        )


@dataclass(frozen=True)
class QuantileBinning(IntervalBinning):
    """Ways to construct histograms on numeric data using the quantiles
    of a reference data as the breaks (i.e. the left and right bounds of each
    bin interval) between each contiguous bin. Each bin is left-closed and
    right-open. Quantiles are specified as a sequence of probabilities (i.e.
    values between 0 and 1 inclusive). Min and max (i.e. quantiles 0 and 1) are
    added and will be replaced by -inf and +inf as the left- and right-most bin
    boundaries. By default, missing values are grouped and counted. Setting
    `dropna=True` removes the missing value category from the output.

    Example
    -------
    Using the quantiles of reference_data as breaks for constructing the
    histogram on another dataset. (Note that -inf and +inf are the left-
    and right-most bin boundaries in the output histogram):

    >>> import pandas as pd
    >>> import numpy as np
    >>> from phoenix.metrics import binning
    >>> reference_series = pd.Series(range(1, 5), dtype=int)
    >>> probabilities=(0.25, 0.5, 0.75)
    >>> np.nanquantile(reference_series, probabilities)
    array([1.75, 2.5 , 3.25])
    >>> new_data = pd.Series(range(6), dtype=int)
    >>> binning.QuantileBinning(reference_series=reference_series,
    ... probabilities=probabilities).histogram(new_data).sort_index()
    [-inf, 1.75)    2
    [1.75, 2.5)     1
    [2.5, 3.25)     1
    [3.25, inf)     2
    dtype: int64
    """

    probabilities: Sequence[float] = ()
    """Values between 0 and 1 inclusive to create quantiles as the boundaries
    between contiguous bins. Each bin is left-closed and right-open. Min and
    max (i.e. quantiles 0 and 1) are added and will be replaced by -inf and
    +inf as the left- and right-most bin boundaries. Default values are the
    decile probabilities."""

    def numeric_bins(self, data: "pd.Series[Any]") -> NumericBins:
        if self.bins is not None:
            return self.bins
        # Always include min and max in quantiles.
        probabilities = sorted({0.0, 1.0}.union(set(self.probabilities)))
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=RuntimeWarning)
            quantiles = np.nanquantile(data, probabilities)
        breaks = sorted(set(quantiles[~np.isnan(quantiles)]))
        # Extend min and max to infinities, unless len(breaks) < 3,
        # in which case the min is kept and two bins are created.
        breaks = breaks[1:-1] if len(breaks) > 2 else breaks[:1]
        breaks = [-np.inf] + breaks + [np.inf]
        return pd.IntervalIndex.from_breaks(
            breaks,
            closed="left",
        )

    def __init__(
        self,
        reference_series: "pd.Series[Any]" = pd.Series(dtype=float),
        probabilities: Iterable[float] = (np.arange(1, 10) / 10),
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        object.__setattr__(
            self,
            "probabilities",
            tuple(probabilities),
        )
        if reference_series.empty:
            return
        numeric_series = pd.to_numeric(
            reference_series,
            errors="coerce",
        )
        object.__setattr__(
            self,
            "bins",
            self.numeric_bins(
                numeric_series,
            ),
        )


@dataclass(frozen=True)
class CategoricalBinning(BinningMethod):
    """Ways to construct histograms by treating each distinct value a separate
    category. By default, missing values are grouped and counted. Setting
    `dropna=True` removes the missing value category from the output.

    Example
    -------
    >>> import pandas as pd
    >>> series = pd.CategoricalBinning(["A"]*99+[None], categories=list("AB"))
    >>> binning.CategoricalBinning().histogram(series)
    A      99
    B       0
    NaN     1
    dtype: int64
    >>> binning.CategoricalBinning(dropna=True).histogram(series)
    A      99
    B       0
    dtype: int64
    """

    def histogram(self, data: "pd.Series[Any]") -> Histogram:
        return data.value_counts(
            dropna=self.dropna,
        )

    def segmented_summary(
        self,
        segment_column: Column,
        dataframe: pd.DataFrame,
        metrics: Iterable[Metric],
    ) -> pd.DataFrame:
        calculate_metrics = partial(
            multi_calculate,
            calcs=metrics,
        )
        return dataframe.groupby(
            segment_column(dataframe),
            dropna=self.dropna,
            observed=True,
            group_keys=True,
            sort=False,
        ).apply(calculate_metrics)


Distribution: TypeAlias = "pd.Series[float]"


@dataclass(frozen=True)
class Normalizer(ABC):
    """A function that normalizes counts/frequencies to probabilities."""

    @abstractmethod
    def __call__(self, counts: Histogram) -> Distribution: ...


@dataclass(frozen=True)
class AdditiveSmoothing(Normalizer):
    r"""A function that normalizes counts/frequencies to probabilities with
    additive smoothing. Defaults to Laplace smoothing with `pseudocount=1`.
    Smoothing can be disabled by setting `pseudocount=0`. Smoothing can be
    used when there is a (discretized) bin where one distribution has zero
    empirical mass (e.g. count) while another distribution has non-zero mass
    at the same bin. In that case, divergences such as KL and PSI will
    output infinities. To avoid getting infinities from these divergences,
    a small amount of mass can be added to the zero-mass bin, and that's
    what smoothing is used for.

    Parameters
    ----------
    pseudocount: float, optional, default=1
        The :math:`\alpha` parameter in additive smoothing. Must be
        non-negative. Setting :math:`\alpha` to 0 results in no smoothing.
        The default value of 1 is also known as "add-1", Laplace or
        Lidstone smoothing. Value of 1/2 is known as Jeffreys smoothing.

    Examples
    --------
    Jeffreys smoothing, i.e. `pseudocount=0.5`:

    >>> import pandas as pd
    >>> counts = pd.CategoricalBinning([0]*99+[1], categories=range(3)).value_counts()
    >>> counts
    0    99
    1     1
    2     0
    dtype: int64
    >>> normalize = binning.AdditiveSmoothing(pseudocount=0.5)
    >>> normalize(counts)
    0    0.980296
    1    0.014778
    2    0.004926
    dtype: float64

    Notes
    -----
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
    r"""The :math:`\alpha` parameter in additive smoothing. Must be
    non-negative, but not necessarily an integer. Common values are: 1, which
    is known as "add-1", Laplace or Lidstone smoothing; 1/2, which is known as
    Jeffreys smoothing. Setting :math:`\alpha` to 0 results in no
    smoothing.
    """

    def __call__(self, counts: Histogram) -> Distribution:
        alpha = self.pseudocount
        return (counts + alpha) / (counts.sum() + alpha * len(counts))
