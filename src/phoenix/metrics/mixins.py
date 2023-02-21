from abc import ABC, abstractmethod
from typing import (
    Any,
    Iterable,
    Mapping,
    Optional,
    Protocol,
    Tuple,
    Union,
    runtime_checkable,
)

import numpy as np
import pandas as pd
from typing_extensions import TypeAlias

ColumnName: TypeAlias = str


@runtime_checkable
class Metric(Protocol):
    def __call__(self, df: pd.DataFrame) -> Tuple[int, Any]:
        ...

    def input_columns(self) -> Iterable[ColumnName]:
        ...

    def get_value(self, result: Mapping[int, Any]) -> Any:
        ...


class ZeroInitialValue(ABC):
    def initial_value(self) -> Any:
        if isinstance(self, VectorOperator):
            return np.zeros(self.shape)
        return 0


class VectorOperator(ABC):
    shape: Union[int, Tuple[int, ...]]

    def __init__(self, shape: Union[int, Tuple[int, ...]], **kwargs: Any):
        self.shape = shape
        super().__init__(**kwargs)


class UnaryOperator(ABC):
    """
    A unary operator is a function with one operand or argument as input.
    See https://en.wikipedia.org/wiki/Arity
    """

    operand: ColumnName

    def __init__(self, column_name: ColumnName, **kwargs: Any):
        self.operand = column_name
        super().__init__(**kwargs)

    def input_columns(self) -> Tuple[ColumnName, ...]:
        return (self.operand,) if self.operand else ()


class OptionalUnaryOperator(UnaryOperator):
    def __init__(self, column_name: Optional[ColumnName] = None, **kwargs: Any):
        super().__init__(column_name or "", **kwargs)


class BaseMetric(ABC):
    id: int
    """
    id is a unique identifier for each metric instance. This is used to extract
    the metric's own value from a collective output containing results from
    other metrics.
    """

    def __init__(self, **kwargs: Any) -> None:
        self.id = id(self)
        super().__init__(**kwargs)

    def initial_value(self) -> Any:
        return float("nan")

    def get_value(self, result: Mapping[int, Any]) -> Any:
        try:
            return result[self.id]
        except KeyError:
            return self.initial_value()

    @abstractmethod
    def calc(self, df: pd.DataFrame) -> Any:
        ...

    def __call__(self, df: pd.DataFrame) -> Tuple[int, Any]:
        return (self.id, self.calc(df))


class EvaluationMetric(BaseMetric, ABC):
    predicted: ColumnName
    actual: ColumnName

    def __init__(self, predicted: ColumnName, actual: ColumnName, **kwargs: Any):
        self.predicted = predicted
        self.actual = actual
        super().__init__(**kwargs)

    def input_columns(self) -> Tuple[ColumnName, ...]:
        return (self.predicted, self.actual)
