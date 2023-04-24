import json
import math
import re
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass, field, fields, replace
from datetime import datetime, timedelta, timezone
from enum import IntEnum, auto, unique
from functools import cached_property, lru_cache
from itertools import chain, groupby, repeat, starmap
from random import random
from typing import (
    Any,
    BinaryIO,
    Callable,
    Dict,
    Iterable,
    Iterator,
    List,
    Mapping,
    NamedTuple,
    Optional,
    Sequence,
    Tuple,
    Type,
    TypeVar,
    Union,
    cast,
    get_args,
    overload,
)
from uuid import uuid4
from weakref import ProxyType, proxy

import numpy as np
import pandas as pd
from pandas.core.dtypes.common import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_datetime64tz_dtype,
    is_numeric_dtype,
)
from typing_extensions import TypeAlias, TypeGuard
from wrapt import ObjectProxy


class DimensionRole(IntEnum):
    ...


@unique
class InvalidRole(DimensionRole):
    UNASSIGNED = auto()


@unique
class SingularDimensionalRole(DimensionRole):
    """Roles that cannot be assigned to more than one dimension."""

    # The (integer) ordering here is important in that it'll be used
    # as tie-breaker when e.g. the user assigns a column to both prediction
    # label and predicton score, in which case the role with a lower
    # integer value will prevail.
    PREDICTION_ID = 1 + max(InvalidRole)
    TIMESTAMP = auto()
    PREDICTION_LABEL = auto()
    PREDICTION_SCORE = auto()
    ACTUAL_LABEL = auto()
    ACTUAL_SCORE = auto()
    # Large Language Model (LLM) prompt and response pairs
    PROMPT = auto()
    RESPONSE = auto()


@unique
class MultiDimensionalRole(DimensionRole):
    # It's important to keep the numeric values disjoint among all subclass
    # enums (hence the +1 here), because we'll use `groupby(sorted(...))` to
    # collate the dimensions. The (integer) ordering here is also important
    # in that it'll be used as tie-breaker when e.g. the user assigns a
    # column to both feature and tag, in which case the role with a lower
    # integer value will prevail.
    FEATURE = 1 + max(SingularDimensionalRole)
    TAG = auto()


# Global variables for ease of making references.
PREDICTION_ID = SingularDimensionalRole.PREDICTION_ID
TIMESTAMP = SingularDimensionalRole.TIMESTAMP

PREDICTION_LABEL = SingularDimensionalRole.PREDICTION_LABEL
PREDICTION_SCORE = SingularDimensionalRole.PREDICTION_SCORE
ACTUAL_LABEL = SingularDimensionalRole.ACTUAL_LABEL
ACTUAL_SCORE = SingularDimensionalRole.ACTUAL_SCORE

PROMPT = SingularDimensionalRole.PROMPT
RESPONSE = SingularDimensionalRole.RESPONSE

FEATURE = MultiDimensionalRole.FEATURE
TAG = MultiDimensionalRole.TAG


def _rand_str() -> str:
    """Generates a random string, useful for adding a new column to a
    dataframe, such that it won't conflict with the existing column names.
    It's intended to be short and gibberish looking.
    """
    return hex(int(random() * 1e9))


@dataclass(frozen=True)
class SchemaSpec(ABC):
    """Superclass for the Schema itself and any of its components, all of
    which share the trait that they use column names to define the model
    structure (or substructures)."""

    def __post_init__(self) -> None:
        """Ensure column names are string at run time, which may not be true
        if the user takes them directly from `pd.dataframe.columns`, which
        can contain numbers. Phoenix always uses string to refer to columns
        and dimensions, so this step is intended to eliminate any potential
        issues caused by any pd.DataFrame having numbers as column names.
        """
        for f in fields(self):
            if f.type is str or set(get_args(f.type)) == {str, type(None)}:
                # Ensure string if type is `str` or `Optional[str]` (the
                # latter being `Union[str, None]` under the hood). Use
                # `__setattr__` because `self` is read-only, i.e. frozen.
                object.__setattr__(self, f.name, _coerce_str(getattr(self, f.name)))


@dataclass(frozen=True)
class CompositeDimensionSpec(SchemaSpec, ABC):
    """A dimension referencing multiple columns (besides its primary column).
    E.x. Embedding can point to 3 columns
    """

    @abstractmethod
    def __str__(self) -> str:
        """This lets the spec behave like a string in some situations,
        because it's basically a column name, but with extra stuff.
        """
        ...

    @abstractmethod
    def __iter__(self) -> Iterator[str]:
        ...


@dataclass(frozen=True)
class Embedding(CompositeDimensionSpec):
    vector: str
    """The column name of the vector values."""
    raw_data: Optional[str] = None
    link_to_data: Optional[str] = None
    display_name: Optional[str] = None

    def __str__(self) -> str:
        return self.vector

    def __iter__(self) -> Iterator[str]:
        for value in (self.vector, self.raw_data, self.link_to_data):
            if isinstance(value, str) and value:
                yield str(value)


class DatasetRole(IntEnum):
    """A dataframe's role in a Model: primary or reference (as
    baseline for drift).
    """

    PRIMARY = auto()
    REFERENCE = auto()


PRIMARY = DatasetRole.PRIMARY
REFERENCE = DatasetRole.REFERENCE


@lru_cache(maxsize=len(DatasetRole))
def _series_nan(length: int) -> "pd.Series[float]":
    """Useful as a substitute for a non-existent column."""
    return pd.Series(np.full(length, float("nan")))


DataFrameOrSeries: TypeAlias = Union[pd.DataFrame, "pd.Series[Any]"]
"""Either a table or a single row of data. Using a series to represent one
row of data (instead of a one-row dataframe) ensures that only scalar values
are extracted (instead of getting a column back)."""


@dataclass(frozen=True)
class Column:
    """Extracts a value (i.e. scalar) from pd.Series or a series (i.e. a
    column) from pd.DataFrame. If not found, returns NaN or a series of NaNs,
    respectively.
    """

    name: str = ""
    is_dummy: bool = False
    """dummy columns are fillers for the model structure, so our functions
    can remain relatively declarative and compact, i.e. by not having to keep
    writing `if ... is not None:` everywhere. Dummy columns always return NaNs,
    because they have random column names not found in any dataframe."""

    def __post_init__(self) -> None:
        if not self.name:
            object.__setattr__(self, "is_dummy", True)
            object.__setattr__(self, "name", _rand_str())

    @overload
    def __call__(self, data: pd.DataFrame) -> "pd.Series[Any]":
        ...

    @overload
    def __call__(self, data: "pd.Series[Any]") -> Any:
        ...

    def __call__(self, data: DataFrameOrSeries) -> Any:
        """Extracts a value from series, or a series from a dataframe. If
        not found, return NaN or a series of NaNs, respectively.
        """
        if isinstance(data, pd.DataFrame):
            try:
                return data.loc[:, self.name]
            except KeyError:
                # It's important to glue the index to the NaN series, so it
                # would look like the series came from the dataframe.
                return _series_nan(len(data)).set_axis(data.index)
        if isinstance(data, pd.Series):
            try:
                return data.at[self.name]
            except KeyError:
                return float("nan")
        raise ValueError("invalid data: %s" % repr(data))

    def __iter__(self) -> Iterator[str]:
        """This is to partake in the iteration of column names by a
        larger data structure of which this object is a member.
        """
        if not self.is_dummy:
            yield self.name

    def __str__(self) -> str:
        return self.name


class DataType(IntEnum):
    UNKNOWN = auto()
    DISCRETE = auto()  # usually names, e.g. California, or Monday.
    CONTINUOUS = auto()  # usually amounts, e.g. 5 bucks, or 6.7 miles.


UNKNOWN = DataType.UNKNOWN
DISCRETE = DataType.DISCRETE
CONTINUOUS = DataType.CONTINUOUS


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


@dataclass(frozen=True)
class ScalarDimension(Dimension):
    @property
    def min_max(self) -> Tuple[Any, Any]:
        if self._model is None:
            return float("nan"), float("nan")
        model = cast(Model, self._model)
        return model.dimension_min_max_from_all_df(self.name)

    @property
    def categories(self) -> Tuple[Any, ...]:
        if self._model is None or self.data_type is CONTINUOUS:
            return ()
        model = cast(Model, self._model)
        return tuple(model.dimension_categories_from_all_df(self.name).dropna())


@dataclass(frozen=True)
class EmbeddingDimension(Dimension):
    link_to_data: Column = field(default_factory=Column)
    raw_data: Column = field(default_factory=Column)
    display_name: str = ""

    def __post_init__(self) -> None:
        super().__post_init__()
        if not self.display_name:
            object.__setattr__(self, "display_name", self.name)

    @classmethod
    def from_(cls, emb: Embedding, **kwargs: Any) -> "EmbeddingDimension":
        """Use `from_` instead of `__init__` because the latter is needed by
        replace() and we don't want to clobber the generated version.
        """
        return cls(
            _coerce_str(emb.vector),
            link_to_data=Column(_coerce_str(emb.link_to_data)),
            raw_data=Column(_coerce_str(emb.raw_data)),
            display_name=_coerce_str(emb.display_name),
            **kwargs,
        )

    def __iter__(self) -> Iterator[str]:
        """This is to partake in the iteration of column names by a
        larger data structure of which this object is a member.
        """
        yield from super().__iter__()
        if not self.raw_data.is_dummy:
            yield from self.raw_data
        if not self.link_to_data.is_dummy:
            yield from self.link_to_data


Name: TypeAlias = str
ColumnKey: TypeAlias = Union[Name, Column, SingularDimensionalRole]
MultiDimensionKey: TypeAlias = Union[MultiDimensionalRole, Sequence[DimensionRole]]
RowNumbering: TypeAlias = Union[int, List[int]]


def _is_column_key(key: Any) -> TypeGuard[ColumnKey]:
    return isinstance(key, (str, Column, SingularDimensionalRole))


def _is_multi_dimension_key(
    key: Any,
) -> TypeGuard[MultiDimensionKey]:
    if isinstance(key, str):
        return False
    try:
        for k in iter(key):
            if not isinstance(k, DimensionRole):
                return False
        return True
    except TypeError:
        return isinstance(key, MultiDimensionalRole)


def _is_dimension_type_filter(
    key: Any,
) -> TypeGuard[Tuple[MultiDimensionKey, Union[Type[ScalarDimension], Type[EmbeddingDimension]]]]:
    return (
        isinstance(key, tuple)
        and len(key) == 2
        and _is_multi_dimension_key(key[0])
        and isinstance(key[1], (Dimension, EmbeddingDimension))
    )


def _is_named_df(obj: Any) -> TypeGuard[Tuple[Name, pd.DataFrame]]:
    return (
        isinstance(obj, tuple)
        and len(obj) == 2
        and isinstance(obj[0], str)
        and isinstance(obj[1], pd.DataFrame)
    )


RowId: TypeAlias = int


class TimeRange(NamedTuple):
    start: datetime
    stop: datetime


class ModelData(ObjectProxy, ABC):  # type: ignore
    """pd.DataFrame or pd.Series wrapped with extra functions and metadata."""

    def __init__(
        self,
        data: DataFrameOrSeries,
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
        if _is_column_key(key):
            if isinstance(key, Column):
                return key(self)
            if self._self_model is None or self.empty:
                return self.null_value
            model = cast(Model, self._self_model)
            return model[key](self)
        return super().__getitem__(key)


class EventId(NamedTuple):
    """Identifies an event."""

    row_id: int = 0
    dataset_id: DatasetRole = PRIMARY

    def __str__(self) -> str:
        return ":".join(map(str, self))


class Event(ModelData):
    """pd.Series wrapped with extra functions and metadata."""

    def __init__(
        self,
        series: "pd.Series[Any]",
        /,
        event_id: EventId,
        **kwargs: Any,
    ) -> None:
        super().__init__(series, **kwargs)
        self._self_id = event_id

    @property
    def id(self) -> EventId:
        return self._self_id

    def null_value(self) -> float:
        return float("nan")

    @overload
    def __getitem__(self, key: ColumnKey) -> Any:
        ...

    @overload
    def __getitem__(self, key: Any) -> Any:
        ...

    def __getitem__(self, key: Any) -> Any:
        return super().__getitem__(key)


class Events(ModelData):
    """pd.DataFrame wrapped with extra functions and metadata."""

    def __init__(
        self,
        df: pd.DataFrame,
        /,
        role: DatasetRole,
        **kwargs: Any,
    ) -> None:
        super().__init__(df, **kwargs)
        self._self_role = role

    @property
    def null_value(self) -> "pd.Series[Any]":
        return pd.Series(dtype=object)

    @cached_property
    def time_range(self) -> TimeRange:
        if self._self_model is None or self.empty:
            # NOTE: as of Python 3.8.16, pandas 1.5.3:
            # >>> isinstance(pd.NaT, datetime.datetime)
            # True
            return TimeRange(pd.NaT, pd.NaT)  # type: ignore
        model = cast(Model, self._self_model)
        min_max = _agg_min_max(model[TIMESTAMP](self))
        start_time = cast(datetime, min_max.min())
        end_time = cast(datetime, min_max.max())
        # Add one minute to end_time, because time intervals are right
        # open and one minute is the smallest interval allowed.
        stop_time = end_time + timedelta(minutes=1)
        # Round down to the nearest minute.
        start = _floor_to_minute(start_time)
        stop = _floor_to_minute(stop_time)
        return TimeRange(start, stop)

    def __iter__(self) -> Iterator[Event]:
        for i, event in self.iterrows():
            yield Event(
                event,
                event_id=EventId(i, self._self_role),
                _model=self._self_model,
            )

    @overload
    def __getitem__(self, key: ColumnKey) -> "pd.Series[Any]":
        ...

    @overload
    def __getitem__(self, key: List[RowId]) -> "Events":
        ...

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, list):
            return Events(
                self.loc[key],
                role=self._self_role,
                _model=self._self_model,
            )
        return super().__getitem__(key)


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
                self.iloc[key].set_axis(key),
                role=self._self_role,
                _model=self._self_model,
            )
        return super().__getitem__(key)


@dataclass(frozen=True, repr=False)
class Model:
    """A Model consists of a set of dataframes and a set of Dimensions.
    Dimensions are objects that extracts columns from dataframes. Not all
    dataframe columns are Dimensions. Some are ancillary, e.g. a column of
    URLs. All Dimensions have a primary column and its name is the same as
    the Dimension's. Some Dimensions may have more than one column, but only
    one is primary. When a Dimension tries to extract a non-existent column
    from a dataframe, a default (or fallback) column will be returned, e.g.
    a column of NaNs.
    """

    _datasets: Dict[DatasetRole, Dataset]
    _dimensions: Dict[Name, Dimension]
    _dim_names_by_role: Dict[DimensionRole, List[Name]]
    _original_columns_by_role: Dict[DatasetRole, pd.Index]

    def __init__(
        self,
        dimensions: Iterable[Dimension],
        dataframes: Iterable[Union[pd.DataFrame, Tuple[Name, pd.DataFrame]]],
        /,
        treat_omitted_columns_as_features: bool = True,
        timestamps_already_normalized: bool = False,
        df_already_sorted_by_time: bool = False,
        # TODO: Consider moving validations here.
        df_already_validated: bool = False,
    ):
        df_names, dfs = cast(
            Tuple[Iterable[Name], Iterable[pd.DataFrame]],
            zip(*_coerce_tuple(dataframes)),
        )
        str_col_dfs = _coerce_str_column_names(dfs)
        padded_dfs = _add_padding(str_col_dfs, pd.DataFrame)
        padded_df_names = _add_padding(df_names, _rand_str)
        datasets = starmap(
            self._new_dataset,
            zip(padded_dfs, padded_df_names, DatasetRole),
        )
        # Store datasets by role.
        object.__setattr__(
            self,
            "_datasets",
            {dataset.role: dataset for dataset in datasets},
        )
        # Preserve originals, useful for exporting.
        object.__setattr__(
            self,
            "_original_columns_by_role",
            {role: dataset.columns for role, dataset in self._datasets.items()},
        )

        # Store dimensions by name. In general, a dimension's name is that of
        # its primary column. But dimensions with special roles, e.g.
        # `PREDICTION_ID` have names that match their roles, e.g.
        # `Prediction ID` (without underscores), and don't necessarily match
        # the names of actual underlying columns in the dataframes.
        object.__setattr__(
            self,
            "_dimensions",
            {dim.name: self._new_dimension(dim) for dim in dimensions},
        )
        if treat_omitted_columns_as_features:
            self._dimensions.update(
                (name, self._new_dimension(name, role=FEATURE))
                for name in _get_omitted_column_names(
                    self._dimensions.values(),
                    self._datasets.values(),
                )
            )

        # Group dimension names by roles. Store in a `defaultdict(list)`.
        object.__setattr__(
            self,
            "_dim_names_by_role",
            defaultdict(list, _group_names_by_dim_role(self._dimensions.values())),
        )

        # Guess the data type, i.e. continuous or discrete, for scalar
        # features and tags.
        for dim in self[ScalarDimension]:
            if dim.data_type is UNKNOWN:
                data_type = _guess_data_type(map(dim, self._datasets.values()))
                self._dimensions[dim.name] = replace(dim, data_type=data_type)

        default_timestamp = datetime.now(timezone.utc)

        # Add PREDICTION_ID if missing.
        # Add TIMESTAMP if missing.
        # If needed, normalize the timestamps values.
        # If needed, sort the dataframes by time.
        for dataset_role, dataset in list(self._datasets.items()):
            df = dataset.__wrapped__
            df_original_columns = self._original_columns_by_role[dataset_role]

            # PREDICTION_ID
            dim_pred_id = self._dimensions.get(
                next(iter(self._dim_names_by_role[PREDICTION_ID]), ""),
                self._new_dimension(PREDICTION_ID),
            )
            if dim_pred_id.name not in df_original_columns:
                df[dim_pred_id.name] = _series_uuid(len(df))
            self._dimensions[dim_pred_id.name] = dim_pred_id
            self._dim_names_by_role[PREDICTION_ID] = [dim_pred_id.name]

            # TIMESTAMP
            dim_time = self._dimensions.get(
                next(iter(self._dim_names_by_role[TIMESTAMP]), ""),
                self._new_dimension(TIMESTAMP),
            )
            if dim_time.name not in df_original_columns:
                df[dim_time.name] = _series_constant(len(df), default_timestamp)
            else:
                if not timestamps_already_normalized:
                    # Don't clobber the original (or any other column).
                    # Store as new column with a random name.
                    new_name, old_name = _rand_str(), dim_time.name
                    df[new_name] = _normalize_timestamps(df[old_name])
                    dim_time = replace(dim_time, name=new_name)
                    del self._dimensions[old_name]
                if not df_already_sorted_by_time:
                    # Sort data for faster search.
                    df = df.sort_values(dim_time.name)
            self._dimensions[dim_time.name] = dim_time
            self._dim_names_by_role[TIMESTAMP] = [dim_time.name]
            # Set time column as index for use by pd.Grouper.
            df = df.set_index(dim_time.name, drop=False)

            # Update dataset since its dataframe may have changed.
            self._datasets[dataset_role] = self._new_dataset(
                df, name=dataset.name, role=dataset_role
            )

    def export_rows_as_parquet_file(
        self,
        rows: Mapping[DatasetRole, Iterable[int]],
        parquet_file: BinaryIO,
    ) -> None:
        """
        Given row numbers, exports dataframe subset into parquet file.
        Duplicate rows are removed.

        Parameters
        ----------
        rows: Mapping[DatasetRole, Iterable[int]]
            mapping of dataset type to list of row numbers
        parquet_file: file handle
            output parquet file handle
        """
        pd.concat(
            self[dataset_role][sorted(row_numbers)].loc[
                :, self._original_columns_by_role[dataset_role]
            ]
            for dataset_role, row_numbers in rows.items()
        ).to_parquet(
            parquet_file,
            index=False,
            allow_truncated_timestamps=True,
            coerce_timestamps="ms",
        )

    @cached_property
    def scalar_dimensions(self) -> Tuple[ScalarDimension, ...]:
        """Put these in a cached sequence because currently their positions
        in this list also determine their node IDs in graphql.
        """
        return tuple(
            dim
            for dim in self._dimensions.values()
            if not dim.is_dummy
            and dim.role not in (PREDICTION_ID, TIMESTAMP)
            and isinstance(dim, ScalarDimension)
        )

    @cached_property
    def embedding_dimensions(self) -> Tuple[EmbeddingDimension, ...]:
        """Put these in a cached sequence because currently their positions
        in this list also determine their node IDs in graphql.
        """
        return tuple(
            dim
            for dim in self._dimensions.values()
            if not dim.is_dummy and isinstance(dim, EmbeddingDimension)
        )

    def dimension_categories_from_all_df(self, dimension_name: Name) -> "pd.Series[Any]":
        dim = self[dimension_name]
        categories_by_df = (dim[role].unique() for role in DatasetRole)
        all_values_combined = chain.from_iterable(categories_by_df)
        return pd.Series(all_values_combined).sort_values().drop_duplicates()

    def dimension_min_max_from_all_df(self, dimension_name: Name) -> Tuple[Any, Any]:
        dim = self[dimension_name]
        min_max_by_df = (_agg_min_max(dim[df_role]) for df_role in DatasetRole)
        all_values_combined = chain.from_iterable(min_max_by_df)
        min_max = _agg_min_max(pd.Series(all_values_combined))
        return min_max.min(), min_max.max()

    @overload
    def __getitem__(self, key: Type[Dataset]) -> Iterator[Dataset]:
        ...

    @overload
    def __getitem__(self, key: DatasetRole) -> Dataset:
        ...

    @overload
    def __getitem__(self, key: ColumnKey) -> Dimension:
        ...

    @overload
    def __getitem__(self, key: MultiDimensionKey) -> Iterator[Dimension]:
        ...

    @overload
    def __getitem__(self, key: Type[ScalarDimension]) -> Iterator[ScalarDimension]:
        ...

    @overload
    def __getitem__(self, key: Type[EmbeddingDimension]) -> Iterator[EmbeddingDimension]:
        ...

    @overload
    def __getitem__(self, key: Type[Dimension]) -> Iterator[Dimension]:
        ...

    @overload
    def __getitem__(
        self,
        key: Tuple[
            MultiDimensionKey,
            Union[Type[ScalarDimension], Type[EmbeddingDimension]],
        ],
    ) -> Iterator[Dimension]:
        ...

    def __getitem__(self, key: Any) -> Any:
        if key is Dataset:
            return self._datasets.values()
        if isinstance(key, DatasetRole):
            return self._datasets[key]
        if _is_column_key(key):
            return self._get_dim(key)
        if _is_multi_dimension_key(key):
            return self._get_multi_dims(key)
        if _is_dimension_type_filter(key):
            return self._get_multi_dims_by_type(key)
        if key is ScalarDimension:
            return filter(lambda dim: type(dim) is ScalarDimension, self._dimensions.values())
        if key is EmbeddingDimension:
            return filter(lambda dim: type(dim) is EmbeddingDimension, self._dimensions.values())
        if key is Dimension:
            return self._dimensions.values()
        raise KeyError(f"invalid key: {repr(key)}")

    def _get_dim(self, key: ColumnKey) -> Dimension:
        if isinstance(key, DimensionRole):
            key = self._dim_names_by_role[key][0]
        if isinstance(key, str):
            return self._dimensions[key]
        raise KeyError(f"invalid key: {repr(key)}")

    def _get_multi_dims(self, key: MultiDimensionKey) -> Iterator[Dimension]:
        for k in _iterate_except_str(key):
            if isinstance(k, DimensionRole):
                for name in self._dim_names_by_role[k]:
                    yield self._dimensions[name]
            elif isinstance(k, str):
                yield self._dimensions[k]
            else:
                raise KeyError(f"invalid key: {repr(key)}")

    def _get_multi_dims_by_type(
        self,
        key: Tuple[
            MultiDimensionKey,
            Union[Type[ScalarDimension], Type[EmbeddingDimension]],
        ],
    ) -> Iterator[Dimension]:
        return filter(lambda dim: type(dim) is key[1], self[key[0]])

    @overload
    def _new_dimension(
        self,
        obj: DimensionRole,
        cls: Type[Dimension] = ScalarDimension,
        **kwargs: Any,
    ) -> Dimension:
        ...

    @overload
    def _new_dimension(
        self,
        obj: Name,
        cls: Type[Dimension] = ScalarDimension,
        **kwargs: Any,
    ) -> Dimension:
        ...

    @overload
    def _new_dimension(
        self,
        obj: Dimension,
        **kwargs: Any,
    ) -> Dimension:
        ...

    def _new_dimension(
        self, obj: Any, cls: Type[Dimension] = ScalarDimension, **kwargs: Any
    ) -> Dimension:
        """Creates a new Dimension or copies an existing one, setting the
        model weak reference to the `self` Model instance.
        """
        if isinstance(obj, Name):
            return cls(obj, **kwargs, _model=proxy(self))
        if isinstance(obj, DimensionRole):
            return cls(role=obj, **kwargs, _model=proxy(self))
        if isinstance(obj, Dimension):
            return replace(obj, **kwargs, _model=proxy(self))
        raise ValueError(f"invalid argument: {repr(obj)}")

    def _new_dataset(
        self,
        df: pd.DataFrame,
        /,
        name: str,
        role: DatasetRole,
    ) -> Dataset:
        """Creates a new Dataset, setting the model weak reference to the
        `self` Model instance.
        """
        return Dataset(df, name=name, role=role, _model=proxy(self))


@dataclass(frozen=True)
class Schema(SchemaSpec):
    prediction_id: Optional[str] = None
    timestamp: Optional[str] = None
    prediction_label: Optional[str] = None
    prediction_score: Optional[str] = None
    actual_label: Optional[str] = None
    actual_score: Optional[str] = None
    prompt: Optional[Embedding] = None
    response: Optional[Embedding] = None
    features: Iterable[Union[str, CompositeDimensionSpec]] = field(default_factory=list)
    tags: Iterable[Union[str, CompositeDimensionSpec]] = field(default_factory=list)

    # internal attribute not exposed to users
    _dimensions: List[Dimension] = field(
        init=False, repr=False, hash=False, compare=False, default_factory=list
    )

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "features", tuple(_iterate_except_str(self.features)))
        object.__setattr__(self, "tags", tuple(_iterate_except_str(self.tags)))
        grouped_by_name = groupby(
            sorted(self._make_dims(), key=lambda dim: (dim.name, dim.role)),
            key=lambda dim: dim.name,
        )
        for name, group in grouped_by_name:
            self._dimensions.append(next(group))

    def _make_dims(self) -> Iterator[Dimension]:
        """Iterate over all dimensions defined by the Schema, substituting
        with dummy dimensions for ones omitted by user. The dummy dimensions
        have randomly generated names that can change for each iteration, but
        currently there's no need to iterate more than once."""
        for spec, role, data_type in chain(
            (
                (self.prediction_id, PREDICTION_ID, DISCRETE),
                (self.timestamp, TIMESTAMP, CONTINUOUS),
                (self.prediction_label, PREDICTION_LABEL, DISCRETE),
                (self.prediction_score, PREDICTION_SCORE, CONTINUOUS),
                (self.actual_label, ACTUAL_LABEL, DISCRETE),
                (self.actual_score, ACTUAL_SCORE, CONTINUOUS),
                (self.prompt, PROMPT, DISCRETE),
                (self.response, RESPONSE, DISCRETE),
            ),
            zip(self.features, repeat(FEATURE), repeat(UNKNOWN)),
            zip(self.tags, repeat(TAG), repeat(UNKNOWN)),
        ):
            if not isinstance(spec, CompositeDimensionSpec):
                spec = _coerce_str(spec)
            assert isinstance(role, DimensionRole)  # for mypy
            if isinstance(spec, str):
                if role in (PROMPT, RESPONSE):
                    yield EmbeddingDimension(spec, role=role, data_type=data_type)
                else:
                    yield ScalarDimension(spec, role=role, data_type=data_type)
            elif isinstance(spec, Embedding):
                yield EmbeddingDimension.from_(spec, role=role, data_type=data_type)
            else:
                raise TypeError(f"{role} has unrecognized type: {type(spec)}")

    def __call__(
        self,
        *dataframes: Union[pd.DataFrame, Tuple[Name, pd.DataFrame]],
        **kwargs: Any,
    ) -> Model:
        """Dimensions are the "baton" that Schema hands over to Model."""
        _raise_if_too_many_dataframes(len(dataframes))
        return Model(iter(self._dimensions), dataframes, **kwargs)

    def __iter__(self) -> Iterator[str]:
        for f in fields(self):
            if not f.init:
                continue
            value = getattr(self, f.name)
            if isinstance(value, str) and value:
                yield str(value)
                continue
            try:
                for v in iter(value):
                    if isinstance(v, CompositeDimensionSpec):
                        yield from iter(v)
                    elif isinstance(v, str) and v:
                        yield str(v)
            except TypeError:
                pass

    def to_json(self) -> str:
        return json.dumps(_jsonify(self))

    @classmethod
    def from_json(cls, input: str) -> "Schema":
        data = json.loads(input)
        try:
            return cls(**{k: _objectify(v) for k, v in data.items()})
        except ValueError as e:
            raise ValueError(f"invalid json data: {repr(data)}") from e


def _agg_min_max(series: "pd.Series[Any]") -> "pd.Series[Any]":
    return series.agg(["min", "max"])


def _get_omitted_column_names(
    dimensions: Iterable[Dimension],
    dataframes: Iterable[pd.DataFrame],
) -> Iterator[str]:
    dataframe_columns = chain.from_iterable(df.columns for df in dataframes)
    schema_columns = chain.from_iterable(dimensions)
    yield from set(dataframe_columns) - set(schema_columns)


def _group_names_by_dim_role(
    dimensions: Iterable[Dimension],
) -> Iterator[Tuple[DimensionRole, List[str]]]:
    return (
        (role, [dim.name for dim in dims])
        for role, dims in groupby(
            sorted(dimensions, key=lambda dim: dim.role),
            key=lambda dim: dim.role,
        )
    )


def _guess_data_type(series: Iterable["pd.Series[Any]"]) -> DataType:
    for s in series:
        if s.empty:
            continue
        if is_bool_dtype(s):
            break
        if is_numeric_dtype(s) or is_datetime64_any_dtype(s):
            return CONTINUOUS
    return DISCRETE


def _iterate_except_str(obj: Any) -> Iterator[Any]:
    """Strings are iterable (by character), but we don't want that because
    e.g. in the event that we asked the user for a list of strings but the
    user only had one string and just gave us the string itself (e.g. `"abc"`)
    instead of putting it into a list (i.e. `["abc"]`), we don't want to
    iterate over `"abc"` and end up with `["a", "b", "c"]`. Instead, we would
    put `"abc"` into a list on the user's behalf. Note that if `["a", "b", "c"]`
    is really what the user wanted, the user can alternatively specify it
    simply as `list("abc")`."""
    if isinstance(obj, str):
        yield obj
        return
    try:
        yield from iter(obj)
    except TypeError:
        yield obj


@lru_cache(maxsize=len(DatasetRole))
# Note that NaN can't be cached, because NaN != NaN.
def _series_constant(length: int, constant: Any) -> "pd.Series[Any]":
    return pd.Series(np.full(length, constant))


def _series_uuid(length: int) -> "pd.Series[str]":
    return pd.Series(map(lambda _: uuid4(), range(length)))


def _raise_if_too_many_dataframes(given: int) -> None:
    limit = len(DatasetRole)
    if not 0 < given <= limit:
        raise ValueError(f"expected between 1 to {limit} dataframes, but {given} were given")


def _coerce_str(obj: Optional[str]) -> str:
    return "" if obj is None else str(obj)


def _coerce_tuple(
    dataframes: Iterable[Union[pd.DataFrame, Tuple[Name, pd.DataFrame]]],
) -> Iterator[Tuple[Name, pd.DataFrame]]:
    for dataframe in dataframes:
        if isinstance(dataframe, pd.DataFrame):
            yield (_rand_str(), dataframe)
        elif _is_named_df(dataframe):
            yield dataframe
        else:
            raise ValueError(f"unexpected type: {type(dataframe)}")


def _coerce_str_column_names(
    dataframes: Iterable[pd.DataFrame],
) -> Iterator[pd.DataFrame]:
    return (df.set_axis(df.columns.astype(str), axis=1) for df in dataframes)


_T = TypeVar("_T")


def _add_padding(
    iterable: Iterable[_T],
    padding: Callable[[], _T],
) -> Iterator[_T]:
    return chain(
        (item if item is not None else padding() for item in iterable),
        repeat(padding()),
    )


def _normalize_timestamps(timestamps: "pd.Series[Any]") -> "pd.Series[Any]":
    if timestamps.empty:
        return timestamps
    data_type = timestamps.dtype
    if is_numeric_dtype(data_type) and not is_bool_dtype(data_type):
        return pd.to_datetime(timestamps, unit="s", utc=True)
    if is_datetime64tz_dtype(data_type):
        return timestamps.dt.tz_convert(timezone.utc)
    if is_datetime64_any_dtype(data_type):
        return timestamps.dt.tz_localize(timezone.utc)
    raise ValueError(
        f"When provided, the timestamps must be numeric or datetime, but found {data_type} instead."
    )


_id_pat = re.compile(r"\bid\b", re.IGNORECASE)


def _title_case_no_underscore(name: str) -> str:
    """E.g. `PREDICTION_ID` turns into `Prediction ID`"""
    return _id_pat.sub("ID", name.replace("_", " ").title())


MINUTE_DATETIME_FORMAT = "%Y-%m-%dT%H:%M:00%z"


def _floor_to_minute(dt: datetime) -> datetime:
    """Floor datetime to the minute by taking a round-trip through string
    format because there isn't always an available function to strip the
    nanoseconds if present."""
    try:
        dt_as_string = dt.astimezone(
            timezone.utc,
        ).strftime(
            MINUTE_DATETIME_FORMAT,
        )
    except ValueError:
        # NOTE: as of Python 3.8.16, pandas 1.5.3:
        # >>> isinstance(pd.NaT, datetime.datetime)
        # True
        return cast(datetime, pd.NaT)
    return datetime.strptime(
        dt_as_string,
        MINUTE_DATETIME_FORMAT,
    ).astimezone(
        timezone.utc,
    )


def _jsonify(obj: Any) -> Any:
    if getattr(obj, "__dataclass_fields__", None):
        return {
            attribute.name: _jsonify(value)
            for attribute in fields(obj)
            if attribute.init
            and (value := getattr(obj, attribute.name)) not in ("", None)
            and (not hasattr(value, "__len__") or len(value))
        }
    if isinstance(obj, str):
        return obj
    if isinstance(obj, Iterable):
        return list(map(_jsonify, iter(obj)))
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def _objectify(json_data: Any) -> Any:
    if isinstance(json_data, str):
        return json_data
    if isinstance(json_data, list):
        return list(map(_objectify, json_data))
    assert isinstance(json_data, dict)
    json_data = {key: _objectify(value) for key, value in json_data.items()}
    # Note that this looks only at the immediate subclasses.
    for cls in CompositeDimensionSpec.__subclasses__():
        try:
            return cls(**json_data)  # type: ignore
        except TypeError:
            pass
    raise ValueError(f"invalid json data: {repr(json_data)}")
