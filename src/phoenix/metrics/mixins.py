from abc import ABC, abstractmethod
from typing import Any, Hashable, Optional, Protocol, Sequence, Tuple, Union

import pandas as pd
from typing_extensions import TypeAlias

ColumnName: TypeAlias = str
Shape: TypeAlias = Union[int, Tuple[int, ...]]


class Metric(Protocol):
    def __call__(self, df: pd.DataFrame) -> Tuple[Hashable, Any]:
        ...

    def input_columns(self) -> Sequence[ColumnName]:
        ...

    def empty_result(self) -> pd.DataFrame:
        ...


class IndexableContainer(Protocol):
    def __getitem__(self, key: Hashable) -> Any:
        ...


class HasId(ABC):
    id: Hashable

    def __init__(self, **kwargs: Any) -> None:
        self.id = id(self)
        super().__init__(**kwargs)

    def get_value(self, container: IndexableContainer) -> Any:
        return container[self.id]


class VectorMetric(ABC):
    shape: Shape

    def __init__(self, shape: Shape, **kwargs: Any):
        self.shape = shape
        super().__init__(**kwargs)


class SingleOperandMetric(ABC):
    operand: ColumnName

    def __init__(self, col: ColumnName, **kwargs: Any):
        self.operand = col
        super().__init__(**kwargs)

    def input_columns(self) -> Tuple[ColumnName, ...]:
        return (self.operand,) if self.operand else ()


class OptionalOperandMetric(SingleOperandMetric):
    def __init__(self, col: Optional[ColumnName] = None, **kwargs: Any):
        super().__init__(col or "", **kwargs)


class BaseMetric(HasId, ABC):
    def empty_result(self) -> pd.DataFrame:
        return pd.DataFrame(columns=(self.id,))

    @abstractmethod
    def calc(self, df: pd.DataFrame) -> Any:
        ...

    def __call__(self, df: pd.DataFrame) -> Tuple[Hashable, Any]:
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
