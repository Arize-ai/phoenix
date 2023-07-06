import re
from abc import ABC
from dataclasses import dataclass, field
from typing import Any, Optional, Protocol, Tuple, Union, cast
from weakref import ProxyType

import pandas as pd

from phoenix.core.column import Column
from phoenix.core.data_type import UNKNOWN, DataType
from phoenix.core.dataset_role import DatasetRole
from phoenix.core.dimension_role import DimensionRole
from phoenix.core.invalid_role import InvalidRole
from phoenix.core.singular_dimensional_role import SingularDimensionalRole


class Model(Protocol):
    def __getitem__(
        self,
        key: DatasetRole,
    ) -> Union[pd.DataFrame, "pd.Series[Any]"]:
        ...

    def dimension_min_max_from_all_df(
        self,
        name: str,
    ) -> Tuple[Any, Any]:
        ...

    def dimension_categories_from_all_datasets(
        self,
        name: str,
    ) -> Tuple[str, ...]:
        ...


@dataclass(frozen=True)
class Dimension(Column, ABC):
    """All Dimensions are Columns (i.e. dataframe column) but not all Columns
    are Dimensions, e.g. some are just ancillary, like a column of URLs.
    """

    role: DimensionRole = InvalidRole.UNASSIGNED
    """The dimension's role in the Model, e.g. FEATURE, TIME, or PREDICTION_ID.
    Must not be unassigned at initialization."""
    data_type: DataType = UNKNOWN
    """Denotes whether the dimension values are continuous or discrete, useful
    for binning."""
    _model: Optional["ProxyType[Model]"] = field(repr=False, default=None)
    """Holds a weak reference to the parent Model, if any. This is the channel
    for talking to actual data, and the Model can help out if needed."""

    def __post_init__(self) -> None:
        super().__post_init__()
        if isinstance(self.role, InvalidRole):
            # This is to let the superclass be initialized without arguments.
            # But we really want the role to be specified for a Dimension.
            raise ValueError("role must be assigned")

    def __getitem__(self, df_role: DatasetRole) -> "pd.Series[Any]":
        if self._model is None:
            return pd.Series(dtype=object)
        model = cast(Model, self._model)
        return self(model[df_role])

    @property
    def display_name(self) -> str:
        """In general, a dimension's name is that of its primary column. But
        dimensions with special roles, e.g. `PREDICTION_ID` have names
        that match their roles, e.g. `Prediction ID` (without underscores),
        and don't necessarily match the names of the actual underlying columns
        in the dataframes, which e.g. could be a derived column with a random
        name such as in the case of the TIME dimension, which refers to a
        normalized version of the actual timestamps column (if it existed).
        """
        if isinstance(self.role, SingularDimensionalRole):
            return _title_case_no_underscore(self.role.name)
        return self.name


def _title_case_no_underscore(name: str) -> str:
    """E.g. `PREDICTION_ID` turns into `Prediction ID`"""
    return _id_pat.sub("ID", name.replace("_", " ").title())


_id_pat = re.compile(r"\bid\b", re.IGNORECASE)
