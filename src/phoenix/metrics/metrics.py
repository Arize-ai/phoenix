import warnings
from typing import Union, cast

import numpy as np
import numpy.typing as npt
import pandas as pd
import sklearn  # type: ignore

from .mixins import (
    BaseMetric,
    EvaluationMetric,
    OptionalUnaryOperator,
    UnaryOperator,
    VectorOperator,
    ZeroInitialValue,
)


class Count(OptionalUnaryOperator, ZeroInitialValue, BaseMetric):
    def calc(self, df: pd.DataFrame) -> int:
        return df.loc[:, self.operand].count() if self.operand else len(df)


class Sum(UnaryOperator, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return cast(float, df.loc[:, self.operand].sum())


class VectorSum(UnaryOperator, VectorOperator, ZeroInitialValue, BaseMetric):
    def calc(self, df: pd.DataFrame) -> Union[float, npt.NDArray[np.float64]]:
        return np.sum(  # type: ignore
            df.loc[:, self.operand].to_numpy(),
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
                np.mean(
                    df.loc[:, self.operand].to_numpy(),
                ),
            )


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
