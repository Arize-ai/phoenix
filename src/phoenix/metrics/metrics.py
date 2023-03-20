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
    UnaryOperator,
    VectorOperator,
    ZeroInitialValue,
)


class Count(UnaryOperator, ZeroInitialValue, BaseMetric):
    def calc(self, df: pd.DataFrame) -> int:
        operand = self.operand
        return cast(int, operand(df).count() if operand else len(df))


class Sum(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, pd.to_numeric(self.operand(df), errors="coerce").sum())


Vector: TypeAlias = Union[float, npt.NDArray[np.float64]]


@dataclass
class VectorSum(UnaryOperator, VectorOperator, ZeroInitialValue, BaseMetric):
    def calc(self, df: pd.DataFrame) -> Vector:
        return cast(
            Vector,
            np.sum(
                self.operand(df).dropna().to_numpy(),
                initial=self.initial_value(),
            ),
        )


@dataclass
class Mean(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, pd.to_numeric(self.operand(df), errors="coerce").mean())


@dataclass
class VectorMean(UnaryOperator, VectorOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> Vector:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=RuntimeWarning)
            return cast(Vector, np.mean(self.operand(df).dropna()))


@dataclass
class Min(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, pd.to_numeric(self.operand(df), errors="coerce").min())


@dataclass
class Max(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, pd.to_numeric(self.operand(df), errors="coerce").max())


@dataclass
class Cardinality(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> int:
        return cast(int, self.operand(df).nunique())


@dataclass
class PercentEmpty(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, self.operand(df).isna().mean() * 100)


@dataclass
class AccuracyScore(EvaluationMetric):
    """
    AccuracyScore calculates the percentage of times that actual equals predicted.
    """

    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, accuracy_score(self.actual(df), self.predicted(df)))


@dataclass
class EuclideanDistance(DriftOperator, VectorOperator):
    @cached_property
    def ref_value(self) -> Vector:
        return cast(Vector, np.mean(self.operand(self.reference_data).dropna()))

    def calc(self, df: pd.DataFrame) -> float:
        if df.empty or (isinstance(self.ref_value, float) and not math.isfinite(self.ref_value)):
            return float("nan")
        return cast(float, euclidean(np.mean(self.operand(df).dropna()), self.ref_value))


Distribution: TypeAlias = "pd.Series[float]"
Divergence: TypeAlias = Callable[[Distribution, Distribution], float]


def symmetrized(divergence: Divergence) -> Divergence:
    """Make a divergence symmetrical by averaging it with its dual.

    See https://en.wikipedia.org/wiki/Divergence_(statistics%29"""
    return lambda pk, qk: (divergence(pk, qk) + divergence(qk, pk)) / 2


@dataclass
class PSI(DiscreteDivergence):
    r"""Population stability index (PSI)

    The population stability index (PSI) between two probability distributions
    `p` and `q` is defined as 2 times the symmetrized KL-divergence,

    .. math::
        \mathrm{PSI}(P,Q) = D_{KL}(P||Q) + D_{KL}(Q||P)
    where :math:`D_{KL}` is the KL-divergence.

    PSI is also known as Jeffreys divergence.

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
    `p` and `q` is defined as,

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
