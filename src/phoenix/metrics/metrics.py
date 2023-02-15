import warnings
from typing import Any, cast

import numpy as np
import pandas as pd
import sklearn  # type: ignore

from phoenix.metrics.mixins import (
    BaseMetric,
    EvaluationMetric,
    OptionalOperandMetric,
    SingleOperandMetric,
    VectorMetric,
)


class Count(OptionalOperandMetric, BaseMetric):
    def calc(self, df: pd.DataFrame) -> int:
        return df.loc[:, self.operand].count() if self.operand else len(df)


class Sum(SingleOperandMetric, BaseMetric):
    def calc(self, df: pd.DataFrame) -> Any:
        return df.loc[:, self.operand].sum()


class VectorSum(SingleOperandMetric, VectorMetric, BaseMetric):
    def calc(self, df: pd.DataFrame) -> Any:
        return np.sum(  # type: ignore
            df.loc[:, self.operand].to_numpy(),
            initial=np.zeros(self.shape),
        )


class Mean(SingleOperandMetric, BaseMetric):
    def calc(self, df: pd.DataFrame) -> Any:
        return df.loc[:, self.operand].mean()


class VectorMean(SingleOperandMetric, VectorMetric, BaseMetric):
    def calc(self, df: pd.DataFrame) -> Any:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=RuntimeWarning)
            return np.mean(
                df.loc[:, self.operand].to_numpy(),
            )


class Cardinality(SingleOperandMetric, BaseMetric):
    def calc(self, df: pd.DataFrame) -> int:
        return df.loc[:, self.operand].nunique()


class PercentEmpty(SingleOperandMetric, BaseMetric):
    def calc(self, df: pd.DataFrame) -> float:
        return df.loc[:, self.operand].isna().mean() * 100


class AccuracyScore(EvaluationMetric):
    def calc(self, df: pd.DataFrame) -> float:
        y_true, y_pred = df.loc[:, self.actual], df.loc[:, self.predicted]
        return cast(float, sklearn.metrics.accuracy_score(y_true, y_pred))
