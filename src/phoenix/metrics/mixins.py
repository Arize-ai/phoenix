"""
Mixins are behavioral building blocks of metrics. All metrics inherit from
BaseMetric. Other mixins provide specialized functionalities. Mixins rely
on cooperative multiple inheritance and method resolution order in Python.
"""
import collections
import inspect
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, fields
from functools import cached_property
from typing import TYPE_CHECKING, Any, Callable, Dict, Iterator, List, Mapping, Optional

import numpy as np
import pandas as pd
from typing_extensions import TypeAlias

from phoenix.core.model_schema import Column
from phoenix.metrics import Metric
from phoenix.metrics.binning import (
    AdditiveSmoothing,
    BinningMethod,
    CategoricalBinning,
    Normalizer,
)


@dataclass(frozen=True)
class ZeroInitialValue(ABC):
    @property
    def initial_value(self) -> Any:
        if isinstance(self, VectorOperator):
            return np.zeros(self.shape)
        return 0


@dataclass(frozen=True)
class VectorOperator(ABC):
    shape: int = 0


@dataclass(frozen=True)
class NullaryOperator(Metric, ABC):
    def operands(self) -> List[Column]:
        return []


@dataclass(frozen=True)
class UnaryOperator(Metric, ABC):
    """
    A unary operator is a function with one operand or argument as input.
    See https://en.wikipedia.org/wiki/Arity
    """

    operand: Column = Column()

    def operands(self) -> List[Column]:
        return [self.operand]


Actual: TypeAlias = "pd.Series[Any]"
Predicted: TypeAlias = "pd.Series[Any]"

# workaround for type checker
# https://github.com/python/mypy/issues/5446#issuecomment-412043677
if TYPE_CHECKING:
    _BaseMapping = Mapping[str, Any]
else:
    _BaseMapping = collections.abc.Mapping


@dataclass(frozen=True)
class EvaluationMetricKeywordParameters(_BaseMapping):
    pos_label: Optional[Any] = None
    sample_weight: Optional[Column] = None

    def __getitem__(self, key: str) -> Any:
        return getattr(self, key)

    def __iter__(self) -> Iterator[str]:
        return (f.name for f in fields(self) if getattr(self, f.name) is not None)

    def __len__(self) -> int:
        return sum(1 for _ in self)

    @property
    def columns(self) -> List[Column]:
        return [v for v in self.values() if isinstance(v, Column)]

    def __call__(self, df: pd.DataFrame) -> Dict[str, Any]:
        return {k: v(df) if isinstance(v, Column) else v for k, v in self.items()}


def dummy_eval(*args: Any, **kwargs: Any) -> float:
    return np.nan


@dataclass(frozen=True)
class EvaluationMetric(Metric, ABC):
    actual: Column = Column()
    predicted: Column = Column()
    eval: Callable[[Actual, Predicted], float] = dummy_eval
    parameters: EvaluationMetricKeywordParameters = field(
        default_factory=EvaluationMetricKeywordParameters,
    )

    def __post_init__(self) -> None:
        valid = inspect.signature(self.eval).parameters.keys()
        if invalid := self.parameters.keys() - valid:
            raise ValueError(f"invalid parameters: {invalid}")

    def operands(self) -> List[Column]:
        return [self.actual, self.predicted] + self.parameters.columns

    def calc(self, df: pd.DataFrame) -> float:
        return self.eval(
            self.actual(df),
            self.predicted(df),
            **self.parameters(df),
        )


@dataclass(frozen=True)
class DriftOperator(UnaryOperator, ABC):
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
class DiscreteDivergence(Discretizer, DriftOperator, ABC):
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
