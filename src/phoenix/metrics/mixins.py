"""
Mixins are behavioral building blocks of metrics. All metrics inherit from
BaseMetric. Other mixins provide specialized functionalities. Mixins rely
on cooperative multiple inheritance and method resolution order in Python.
"""

import collections
import inspect
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, fields, replace
from functools import cached_property
from itertools import repeat
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
    """Parameters not compatible with the evaluation function are ignored. For
    example, specifying the positive label for a regression evaluation has no
    effect."""

    pos_label: Optional[Any] = None
    """For classification models, specifying a positive label turns the
    predictions binary. That is, predictions are reassigned a value of True
    when their labels match the positive label, and False otherwise. Missing
    values remain missing and are assigned neither True or False."""
    sample_weight: Optional[Column] = None
    """When applicable for the eval function, a sample weight column is used to
    add weight each observation. E.g., a credit model may give more weight to
    the accuracy of the predictions for loans with higher dollar amounts. Since
    most evaluation metrics are arithmetic averages, the addition of weights to
    each data point turns the calculations into weighted averages."""

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


def _dummy_eval(*args: Any, **kwargs: Any) -> float:
    return np.nan


@dataclass(frozen=True)
class EvaluationMetric(Metric, ABC):
    actual: Column = Column()
    predicted: Column = Column()
    eval: Callable[..., float] = _dummy_eval
    parameters: EvaluationMetricKeywordParameters = field(
        default_factory=EvaluationMetricKeywordParameters,
    )

    def __post_init__(self) -> None:
        # Ignore (i.e. remove) parameters not compatible with the eval
        # function. Note that some metrics, e.g. max_error, doesn't have
        # sample_weight as a parameter, but that's because it doesn't change
        # the result, not because of any inherent incompatibility in meaning,
        # i.e. samples can still be weighted, but max_error will be the same.
        if (
            invalid_parameter_keys := self.parameters.keys()
            - inspect.signature(self.eval).parameters.keys()
        ):
            object.__setattr__(
                self,
                "parameters",
                replace(
                    self.parameters,
                    **dict(
                        zip(
                            invalid_parameter_keys,
                            repeat(None),
                        )
                    ),
                ),
            )

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
