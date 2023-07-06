from typing import Any, List, overload

import pandas as pd

from phoenix.config import GENERATED_DATASET_NAME_PREFIX
from phoenix.core.dataset_role import DatasetRole
from phoenix.core.events import Events
from phoenix.core.types import ColumnKey, RowId


class Dataset(Events):
    """pd.DataFrame wrapped with extra functions and metadata."""

    def __init__(
        self,
        df: pd.DataFrame,
        /,
        name: str,
        **kwargs: Any,
    ) -> None:
        super().__init__(df, **kwargs)
        self._self_name = name

    @property
    def name(self) -> str:
        return self._self_name

    @property
    def display_name(self) -> str:
        """
        Return a human-readable name for this dataset. If the user doesn't
        provide a name, the name is generated but this name is not human
        friendly. Falls back to the role of the dataset if no name is provided.
        """
        ds_name = self._self_name
        if ds_name.startswith(GENERATED_DATASET_NAME_PREFIX):
            # The generated names are UUIDs so use the role as the name
            return "primary" if self.role is DatasetRole.PRIMARY else "reference"
        return ds_name

    @property
    def role(self) -> DatasetRole:
        return self._self_role

    @overload
    def __getitem__(self, key: ColumnKey) -> "pd.Series[Any]":
        ...

    @overload
    def __getitem__(self, key: List[RowId]) -> Events:
        ...

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, list):
            return Events(
                self.iloc[key].set_axis(
                    key,
                    copy=False,
                ),
                role=self._self_role,
                _model=self._self_model,
            )
        return super().__getitem__(key)
