import math
import warnings
from functools import cached_property
from typing import Union, cast

import numpy as np
import numpy.typing as npt
import pandas as pd
import sklearn  # type: ignore
from scipy.spatial.distance import euclidean  # type: ignore

from .mixins import (
    BaseMetric,
    DriftOperator,
    EvaluationMetric,
    OptionalUnaryOperator,
    UnaryOperator,
    VectorOperator,
    ZeroInitialValue,
)


class Count(OptionalUnaryOperator, ZeroInitialValue, BaseMetric):
    def calc(self, df: pd.DataFrame) -> int:
        return df.loc[:, self.operand].count() if self.operand else df.size


class Sum(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, df.loc[:, self.operand].sum())


class VectorSum(UnaryOperator, VectorOperator, ZeroInitialValue, BaseMetric):
    def calc(self, df: pd.DataFrame) -> Union[float, npt.NDArray[np.float64]]:
        return np.sum(  # type: ignore
            df.loc[:, self.operand].dropna().to_numpy(),
            initial=self.initial_value(),
        )


class Mean(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return df.loc[:, self.operand].mean()


class VectorMean(UnaryOperator, VectorOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> Union[float, npt.NDArray[np.float64]]:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=RuntimeWarning)
            return cast(
                Union[float, npt.NDArray[np.float64]],
                np.mean(df.loc[:, self.operand].dropna()),
            )


class Min(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, df.loc[:, self.operand].min())


class Max(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, df.loc[:, self.operand].max())


class Cardinality(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> int:
        return df.loc[:, self.operand].nunique()


class PercentEmpty(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return df.loc[:, self.operand].isna().mean() * 100


class AccuracyScore(EvaluationMetric):
    """
    AccuracyScore calculates the percentage of times that actual equals predicted.
    """

    def calc(self, df: pd.DataFrame) -> float:
        return cast(
            float, sklearn.metrics.accuracy_score(df.loc[:, self.actual], df.loc[:, self.predicted])
        )


class EuclideanDistance(DriftOperator, VectorOperator):
    @cached_property
    def ref_value(self) -> Union[float, npt.NDArray[np.float64]]:
        if self.reference_data is None or self.reference_data.empty:
            return float("nan")
        return cast(
            Union[float, npt.NDArray[np.float64]],
            np.mean(self.reference_data.loc[:, self.operand].dropna()),
        )

    def calc(self, df: pd.DataFrame) -> float:
        if df.empty or (isinstance(self.ref_value, float) and not math.isfinite(self.ref_value)):
            return float("nan")
        return cast(
            float,
            euclidean(
                np.mean(df.loc[:, self.operand].dropna()),
                self.ref_value,
            ),
        )
