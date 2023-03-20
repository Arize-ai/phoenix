"""
Mixins are behavioral building blocks of metrics. All metrics inherit from
BaseMetric. Other mixins provide specialized functionalities. Mixins rely
on cooperative multiple inheritance and method resolution order in Python.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import cached_property
from itertools import takewhile
from operator import itemgetter
from typing import Any, Iterator, Mapping, Optional

import numpy as np
import pandas as pd
from typing_extensions import TypeAlias

from phoenix.metrics import Column
from phoenix.metrics.binning import AdditiveSmoothing, Binning, Categorical, Normalizer


class Operand:
    """A descriptor representing a Column operand of a metric."""

    private_name: str

    def __set_name__(self, _: Any, name: str) -> None:
        self.private_name = "_" + name

    def __set__(self, instance: object, column_name: str) -> None:
        setattr(instance, self.private_name, column_name)

    def __get__(self, instance: object, _: Any = None) -> Any:
        if instance is None:
            return self
        return Column(getattr(instance, self.private_name, None))


@dataclass
class ZeroInitialValue(ABC):
    def initial_value(self) -> Any:
        if isinstance(self, VectorOperator):
            return np.zeros(self.shape)
        return 0


@dataclass
class VectorOperator(ABC):
    shape: int = 0


@dataclass
class UnaryOperator(ABC):
    """
    A unary operator is a function with one operand or argument as input.
    See https://en.wikipedia.org/wiki/Arity
    """

    operand: Operand = Operand()

    def operands(self) -> Iterator[Column]:
        return takewhile(bool, (self.operand,))


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
    def calc(self, df: pd.DataFrame) -> Any:
        ...

    def __call__(self, df: pd.DataFrame) -> Any:
        return self.calc(df)


@dataclass
class EvaluationMetric(BaseMetric, ABC):
    predicted: Operand = Operand()
    actual: Operand = Operand()

    def operands(self) -> Iterator[Column]:
        return takewhile(bool, (self.predicted, self.actual))


Data: TypeAlias = "pd.Series[Any]"


@dataclass
class DriftOperator(UnaryOperator, BaseMetric, ABC):
    reference_data: Optional[pd.DataFrame] = None


Distribution: TypeAlias = "pd.Series[float]"
Histogram: TypeAlias = "pd.Series[int]"


@dataclass
class Discretizer(ABC):
    binning: Binning = Categorical()

    def histogram(self, data: Data) -> Histogram:
        return self.binning.histogram(data)


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
    def ref_histogram(self) -> Histogram:
        return self.histogram(self.operand(self.reference_data)).rename("ref")

    def calc(self, df: pd.DataFrame) -> float:
        return self.divergence(
            *self.normalize(
                *map(
                    itemgetter(1),
                    pd.merge(
                        self.histogram(self.operand(df)).rename("prim"),
                        self.ref_histogram,
                        left_index=True,
                        right_index=True,
                        how="outer",
                    )
                    .fillna(0)
                    .items(),
                )
            )
        )
