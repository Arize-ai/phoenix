"""
Mixins are behavioral building blocks of metrics. All metrics inherit from
BaseMetric. Other mixins provide specialized functionalities. Mixins rely
on cooperative multiple inheritance and method resolution order in Python.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from functools import cached_property
from typing import Any, Iterator, Mapping

import numpy as np
import pandas as pd
from typing_extensions import TypeAlias

from phoenix.core.model_schema import Column
from phoenix.metrics.binning import (
    AdditiveSmoothing,
    BinningMethod,
    CategoricalBinning,
    Normalizer,
)


@dataclass(frozen=True)
class ZeroInitialValue(ABC):
    def initial_value(self) -> Any:
        if isinstance(self, VectorOperator):
            return np.zeros(self.shape)
        return 0


@dataclass(frozen=True)
class VectorOperator(ABC):
    shape: int = 0


@dataclass(frozen=True)
class NullaryOperator(ABC):
    @staticmethod
    def input_column_names() -> Iterator[str]:
        yield from ()


@dataclass(frozen=True)
class UnaryOperator(ABC):
    """
    A unary operator is a function with one operand or argument as input.
    See https://en.wikipedia.org/wiki/Arity
    """

    operand: Column = Column()

    def input_column_names(self) -> Iterator[str]:
        yield from self.operand


@dataclass(frozen=True)
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
        try:
            return self.calc(dataframe)
        except (TypeError, ValueError):
            return float("nan")


@dataclass(frozen=True)
class EvaluationMetric(BaseMetric, ABC):
    predicted: Column = Column()
    actual: Column = Column()

    def input_column_names(self) -> Iterator[str]:
        yield from self.predicted
        yield from self.actual


@dataclass(frozen=True)
class DriftOperator(UnaryOperator, BaseMetric, ABC):
    reference_data: pd.DataFrame = field(
        default_factory=pd.DataFrame,
    )


Distribution: TypeAlias = "pd.Series[float]"
Histogram: TypeAlias = "pd.Series[int]"


@dataclass(frozen=True)
class Discretizer(ABC):
    """Ways to construct histograms from data. Numeric data are commonly
    grouped into intervals while discrete data are grouped into categories.
    This procedure is referred to as binning. Once binned, counts/frequencies
    are tabulated by group to create a histogram.
    """

    binning_method: BinningMethod = CategoricalBinning()

    def histogram(self, data: "pd.Series[Any]") -> Histogram:
        return self.binning_method.histogram(data)


@dataclass(frozen=True)
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
        data = self.operand(self.reference_data)
        return self.histogram(data).rename("reference_histogram")

    def calc(self, dataframe: pd.DataFrame) -> float:
        data = self.operand(dataframe)
        # outer-join histograms and fill in zeros for missing categories
        merged_counts = pd.merge(
            self.histogram(data).rename("primary_histogram"),
            self.reference_histogram,
            left_index=True,
            right_index=True,
            how="outer",
            copy=False,
        ).fillna(0)
        # remove rows with all zeros
        merged_counts = merged_counts.loc[(merged_counts > 0).any(axis=1)]
        primary_histogram = merged_counts.primary_histogram
        reference_histogram = merged_counts.reference_histogram
        return self.divergence(
            self.normalize(primary_histogram),
            self.normalize(reference_histogram),
        )
