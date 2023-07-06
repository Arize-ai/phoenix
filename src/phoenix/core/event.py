from typing import Any, overload

import numpy as np
import pandas as pd

from phoenix.core.model_data import ModelData
from phoenix.core.record_id import RecordId
from phoenix.core.types import ColumnKey


class Event(ModelData):
    """pd.Series wrapped with extra functions and metadata."""

    def __init__(
        self,
        series: "pd.Series[Any]",
        /,
        event_id: RecordId,
        **kwargs: Any,
    ) -> None:
        super().__init__(series, **kwargs)
        self._self_id = event_id

    @property
    def id(self) -> RecordId:
        return self._self_id

    def null_value(self) -> float:
        return np.nan

    @overload
    def __getitem__(self, key: ColumnKey) -> Any:
        ...

    @overload
    def __getitem__(self, key: Any) -> Any:
        ...

    def __getitem__(self, key: Any) -> Any:
        return super().__getitem__(key)
