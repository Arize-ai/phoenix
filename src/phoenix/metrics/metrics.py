import math
import warnings
from dataclasses import dataclass, field
from functools import cached_property
from typing import Callable, Union, cast

import numpy as np
import numpy.typing as npt
import pandas as pd
from scipy.spatial.distance import euclidean, jensenshannon
from scipy.stats import entropy
from typing_extensions import TypeAlias

from phoenix.metrics import Metric

from .mixins import (
    DiscreteDivergence,
    DriftOperator,
    NullaryOperator,
    UnaryOperator,
    VectorOperator,
    ZeroInitialValue,
)


@dataclass(frozen=True)
class Count(NullaryOperator, ZeroInitialValue, Metric):
    def calc(self, dataframe: pd.DataFrame) -> int:
        return len(dataframe)


@dataclass(frozen=True)
class CountNotNull(UnaryOperator, ZeroInitialValue, Metric):
    def calc(self, dataframe: pd.DataFrame) -> int:
        return self.operand(dataframe).count()


@dataclass(frozen=True)
class Sum(UnaryOperator, Metric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        numeric_data = pd.to_numeric(data, errors="coerce")
        return cast(float, numeric_data.sum())


Vector: TypeAlias = Union[float, npt.NDArray[np.float64]]


@dataclass(frozen=True)
class VectorSum(UnaryOperator, VectorOperator, ZeroInitialValue, Metric):
    def calc(self, dataframe: pd.DataFrame) -> Vector:
        data = self.operand(dataframe)
        return cast(
            Vector,
            np.sum(
                data.dropna().to_numpy(),
                initial=self.initial_value,
            ),
        )


@dataclass(frozen=True)
class Mean(UnaryOperator, Metric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        numeric_data = pd.to_numeric(data, errors="coerce")
        return numeric_data.mean()


@dataclass(frozen=True)
class VectorMean(UnaryOperator, VectorOperator, Metric):
    def calc(self, dataframe: pd.DataFrame) -> Vector:
        data = self.operand(dataframe)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=RuntimeWarning)
            return cast(Vector, np.mean(data.dropna()))


@dataclass(frozen=True)
class Min(UnaryOperator, Metric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        numeric_data = pd.to_numeric(data, errors="coerce")
        return cast(float, numeric_data.min())


@dataclass(frozen=True)
class Max(UnaryOperator, Metric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        numeric_data = pd.to_numeric(data, errors="coerce")
        return cast(float, numeric_data.max())


@dataclass(frozen=True)
class Cardinality(UnaryOperator, Metric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        if data.dtype.kind == "f":
            return np.nan
        return cast(float, data.nunique())


@dataclass(frozen=True)
class PercentEmpty(UnaryOperator, Metric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        return data.isna().mean() * 100


@dataclass(frozen=True)
class Quantile(UnaryOperator, Metric):
    probability: float = field(default=0.5)

    def __post_init__(self) -> None:
        if not (0 <= self.probability <= 1):
            raise ValueError(
                "invalid quantile probability; "
                "must be between 0 and 1 inclusive; "
                f"got: {self.probability}"
            )

    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        numeric_data = pd.to_numeric(
            data,
            errors="coerce",
        )
        with warnings.catch_warnings():
            warnings.simplefilter(
                "ignore",
                category=RuntimeWarning,
            )
            return cast(
                float,
                np.nanquantile(
                    numeric_data,
                    self.probability,
                ),
            )


@dataclass(frozen=True)
class EuclideanDistance(DriftOperator, VectorOperator):
    @cached_property
    def reference_value(self) -> Vector:
        data = self.operand(self.reference_data)
        return cast(Vector, np.mean(data.dropna()))

    def calc(self, dataframe: pd.DataFrame) -> float:
        if dataframe.empty or (
            isinstance(self.reference_value, float) and not math.isfinite(self.reference_value)
        ):
            return np.nan
        data = self.operand(dataframe)
        return cast(
            float,
            euclidean(
                np.mean(data.dropna()),
                self.reference_value,
            ),
        )


Distribution: TypeAlias = "pd.Series[float]"
Divergence: TypeAlias = Callable[[Distribution, Distribution], float]


def symmetrized(divergence: Divergence) -> Divergence:
    """Symmetrize a divergence function by averaging it with its dual.

    See https://en.wikipedia.org/wiki/Divergence_(statistics%29"""
    return lambda pk, qk: (divergence(pk, qk) + divergence(qk, pk)) / 2


@dataclass(frozen=True)
class PSI(DiscreteDivergence):
    r"""Population stability index (PSI)

    PSI between two probability distributions :math:`p` and :math:`q` is
    defined as 2 times the symmetrized KL-divergence,

    .. math::
        \mathrm{PSI}(P,Q) = D_{KL}(P||Q) + D_{KL}(Q||P)
    where :math:`D_{KL}` is the KL-divergence.

    PSI is symmetrical and also known as Jeffreys divergence.

    See https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence#Symmetrised_divergence
    """

    def divergence(self, pk: Distribution, qk: Distribution) -> float:
        """
        Parameters
        ----------
        pk: series, shape = (d_categories,)
            (discrete) distribution of primary data
        qk: series, shape = (d_categories,)
            (discrete) distribution of reference data,
            a.k.a. the prior distribution

        Returns
        -------
        divergence: float
            Population stability index (PSI) between pk and qk
        """
        return 2 * symmetrized(entropy)(pk, qk)


@dataclass(frozen=True)
class KLDivergence(DiscreteDivergence):
    r"""Kullback–Leibler divergence

    See https://en.wikipedia.org/wiki/Kullback%E2%80%93Leibler_divergence
    """

    def divergence(self, pk: Distribution, qk: Distribution) -> float:
        """
        Parameters
        ----------
        pk: series, shape = (d_categories,)
            (discrete) distribution of primary data
        qk: series, shape = (d_categories,)
            (discrete) distribution of reference data,
            a.k.a. the prior distribution

        Returns
        -------
        divergence: float
            Kullback-Leibler divergence of pk over qk
        """
        return cast(float, entropy(pk, qk))


@dataclass(frozen=True)
class JSDistance(DiscreteDivergence):
    r"""Jensen-Shannon Distance

    The Jensen-Shannon distance between two probability distributions
    :math:`p` and :math:`q` is defined as,

    .. math::

       \sqrt{\frac{D(p||m) + D(q||m)}{2}}

    where :math:`m` is the pointwise mean of :math:`p` and :math:`q`
    and :math:`D` is the Kullback-Leibler divergence.

    The Jensen-Shannon distance is the square root of the
    Jensen-Shannon divergence.
    """

    def divergence(self, pk: Distribution, qk: Distribution) -> float:
        """
        Parameters
        ----------
        pk: series, shape = (d_categories,)
            (discrete) distribution of primary data
        qk: series, shape = (d_categories,)
            (discrete) distribution of reference data,
            a.k.a. the prior distribution

        Returns
        -------
        divergence: float
            Jensen-Shannon distance between pk and qk
        """
        return cast(float, jensenshannon(pk, qk))
