import math
import warnings
from dataclasses import dataclass
from functools import cached_property
from typing import Callable, Union, cast

import numpy as np
import numpy.typing as npt
import pandas as pd
from scipy.spatial.distance import euclidean, jensenshannon
from scipy.stats import entropy
from sklearn.metrics import accuracy_score
from typing_extensions import TypeAlias

from .mixins import (
    BaseMetric,
    DiscreteDivergence,
    DriftOperator,
    EvaluationMetric,
    NullaryOperator,
    UnaryOperator,
    VectorOperator,
    ZeroInitialValue,
)


class Count(NullaryOperator, ZeroInitialValue, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> int:
        return len(dataframe)


class CountNotNull(UnaryOperator, ZeroInitialValue, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> int:
        return self.operand(dataframe).count()


class Sum(UnaryOperator, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        numeric_data = pd.to_numeric(data, errors="coerce")
        return cast(float, numeric_data.sum())


Vector: TypeAlias = Union[float, npt.NDArray[np.float64]]


@dataclass
class VectorSum(UnaryOperator, VectorOperator, ZeroInitialValue, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> Vector:
        data = self.operand(dataframe)
        return cast(
            Vector,
            np.sum(
                data.dropna().to_numpy(),
                initial=self.initial_value(),
            ),
        )


@dataclass
class Mean(UnaryOperator, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        numeric_data = pd.to_numeric(data, errors="coerce")
        return numeric_data.mean()


@dataclass
class VectorMean(UnaryOperator, VectorOperator, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> Vector:
        data = self.operand(dataframe)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=RuntimeWarning)
            return cast(Vector, np.mean(data.dropna()))


@dataclass
class Min(UnaryOperator, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        numeric_data = pd.to_numeric(data, errors="coerce")
        return cast(float, numeric_data.min())


@dataclass
class Max(UnaryOperator, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        numeric_data = pd.to_numeric(data, errors="coerce")
        return cast(float, numeric_data.max())


@dataclass
class Cardinality(UnaryOperator, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        if data.dtype.kind == "f":
            return float("nan")
        return cast(float, data.nunique())


@dataclass
class PercentEmpty(UnaryOperator, BaseMetric):
    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        return data.isna().mean() * 100


@dataclass
class AccuracyScore(EvaluationMetric):
    """
    AccuracyScore calculates the percentage of times that actual equals predicted.
    """

    def calc(self, dataframe: pd.DataFrame) -> float:
        predicted = self.predicted(dataframe)
        actual = self.actual(dataframe)
        return cast(float, accuracy_score(actual, predicted))


@dataclass
class EuclideanDistance(DriftOperator, VectorOperator):
    @cached_property
    def reference_value(self) -> Vector:
        data = self.operand(self.reference_data)
        return cast(Vector, np.mean(data.dropna()))

    def calc(self, dataframe: pd.DataFrame) -> float:
        if dataframe.empty or (
            isinstance(self.reference_value, float) and not math.isfinite(self.reference_value)
        ):
            return float("nan")
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


@dataclass
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


@dataclass
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


@dataclass
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
