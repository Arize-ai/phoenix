from abc import ABC, abstractmethod
from typing import Any, Optional, Protocol, Union, cast
from weakref import ProxyType

import pandas as pd
from wrapt import ObjectProxy

from phoenix.core.column import Column
from phoenix.core.types import is_column_key


class Model(Protocol):
    def __getitem__(self, key: Any) -> Column:
        ...


class ModelData(ObjectProxy, ABC):  # type: ignore
    """pd.DataFrame or pd.Series wrapped with extra functions and metadata."""

    def __init__(
        self,
        data: Union[pd.DataFrame, "pd.Series[Any]"],
        /,
        _model: Optional["ProxyType[Model]"] = None,
    ) -> None:
        super().__init__(data)
        self._self_model = _model

    @property
    @abstractmethod
    def null_value(self) -> Any:
        ...

    def __getitem__(self, key: Any) -> Any:
        if is_column_key(key):
            if isinstance(key, Column):
                return key(self)
            if self._self_model is None or self.empty:
                return self.null_value
            model = cast(Model, self._self_model)
            return model[key](self)
        return super().__getitem__(key)
