"""
Mixins are behavioral building blocks of metrics. All metrics inherit from
BaseMetric. Other mixins provide specialized functionalities. Mixins rely
on cooperative multiple inheritance and method resolution order in Python.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import cached_property
from itertools import takewhile
from typing import Any, Iterator, Mapping, Optional

import numpy as np
import pandas as pd
from typing_extensions import TypeAlias

from phoenix.metrics.binning import (
    AdditiveSmoothing,
    BinningMethod,
    CategoricalBinning,
    Normalizer,
)


@dataclass
class ZeroInitialValue(ABC):
    def initial_value(self) -> Any:
        if isinstance(self, VectorOperator):
            return np.zeros(self.shape)
        return 0


@dataclass
class VectorOperator(ABC):
    shape: int = 0


def _get_column_from_dataframe(
    name: str,
    dataframe: Optional[pd.DataFrame] = None,
) -> "pd.Series[Any]":
    if name and isinstance(dataframe, pd.DataFrame) and name in dataframe.columns:
        return dataframe.loc[:, name]
    return pd.Series(dtype=object)


@dataclass
class UnaryOperator(ABC):
    """
    A unary operator is a function with one operand or argument as input.
    See https://en.wikipedia.org/wiki/Arity
    """

    operand_column_name: str = ""

    def get_operand_column(
        self,
        dataframe: Optional[pd.DataFrame] = None,
    ) -> "pd.Series[Any]":
        return _get_column_from_dataframe(
            self.operand_column_name,
            dataframe,
        )

    def operands(self) -> Iterator[str]:
        return takewhile(bool, (self.operand_column_name,))


@dataclass
class BaseMetric(ABC):
    def id(self) -> int:
        """
        id is a unique identifier for each metric instance. This is used to
        extract the metric's own value from a collective output containing
        results from other metrics.
        """
        return id(self)

    def initial_value(self) -> Any:
        return float("nan")

    def get_value(self, result: Mapping[int, Any]) -> Any:
        try:
            return result[self.id()]
        except KeyError:
            return self.initial_value()

    @abstractmethod
    def calc(self, dataframe: pd.DataFrame) -> Any:
        ...

    def __call__(self, dataframe: pd.DataFrame) -> Any:
        return self.calc(dataframe)


@dataclass
class EvaluationMetric(BaseMetric, ABC):
    predicted_column_name: str = ""
    actual_column_name: str = ""

    def get_predicted_column(
        self,
        dataframe: Optional[pd.DataFrame] = None,
    ) -> "pd.Series[Any]":
        return _get_column_from_dataframe(
            self.predicted_column_name,
            dataframe,
        )

    def get_actual_column(
        self,
        dataframe: Optional[pd.DataFrame] = None,
    ) -> "pd.Series[Any]":
        return _get_column_from_dataframe(
            self.actual_column_name,
            dataframe,
        )

    def operands(self) -> Iterator[str]:
        return takewhile(
            bool,
            (
                self.predicted_column_name,
                self.actual_column_name,
            ),
        )


Data: TypeAlias = "pd.Series[Any]"


@dataclass
class DriftOperator(UnaryOperator, BaseMetric, ABC):
    reference_data: Optional[pd.DataFrame] = None


Distribution: TypeAlias = "pd.Series[float]"
Histogram: TypeAlias = "pd.Series[int]"


@dataclass
class Discretizer(ABC):
    binning_method: BinningMethod = CategoricalBinning()

    def histogram(self, series: Data) -> Histogram:
        return self.binning_method.histogram(series)


@dataclass
class DiscreteDivergence(Discretizer, DriftOperator):
    """See https://en.wikipedia.org/wiki/Divergence_(statistics%29"""

    normalize: Normalizer = AdditiveSmoothing(pseudocount=1)
    """Converts frequencies to probabilities (i.e. normalized to 1)."""

    @abstractmethod
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
            divergence of pk over qk
        """

    @cached_property
    def reference_histogram(self) -> Histogram:
        series = self.get_operand_column(self.reference_data)
        return self.histogram(series).rename("reference_histogram")

    def calc(self, dataframe: pd.DataFrame) -> float:
        series = self.get_operand_column(dataframe)
        # outer-join histograms and fill in zeros for missing categories
        merged_counts = pd.merge(
            self.histogram(series).rename("primary_histogram"),
            self.reference_histogram,
            left_index=True,
            right_index=True,
            how="outer",
        ).fillna(0)
        # remove rows with all zeros
        merged_counts = merged_counts.loc[(merged_counts > 0).any(axis=1)]  # type: ignore
        primary_histogram = merged_counts.primary_histogram
        reference_histogram = merged_counts.reference_histogram
        return self.divergence(
            self.normalize(primary_histogram),
            self.normalize(reference_histogram),
        )
