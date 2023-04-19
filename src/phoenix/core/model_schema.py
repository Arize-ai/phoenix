import json
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
    Hashable,
    Iterable,
    Iterator,
    List,
    Mapping,
    NamedTuple,
    Optional,
    Sequence,
    Set,
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
    is_datetime64_any_dtype,
    is_datetime64tz_dtype,
    is_numeric_dtype,
)
from typing_extensions import TypeAlias, TypeGuard
from wrapt import ObjectProxy


class DimensionRole(IntEnum):
    ...


@unique
class SingularDimensionalRole(DimensionRole):
    UNASSIGNED = auto()
    PREDICTION_ID = auto()
    TIME = auto()
    PREDICTION_LABEL = auto()
    PREDICTION_SCORE = auto()
    ACTUAL_LABEL = auto()
    ACTUAL_SCORE = auto()


@unique
class MultiDimensionalRole(DimensionRole):
    FEATURE = 1 + len(SingularDimensionalRole)
    TAG = auto()


# global vars for ease of reference
UNASSIGNED = SingularDimensionalRole.UNASSIGNED
PREDICTION_ID = SingularDimensionalRole.PREDICTION_ID
TIME = SingularDimensionalRole.TIME
PREDICTION_LABEL = SingularDimensionalRole.PREDICTION_LABEL
PREDICTION_SCORE = SingularDimensionalRole.PREDICTION_SCORE
ACTUAL_LABEL = SingularDimensionalRole.ACTUAL_LABEL
ACTUAL_SCORE = SingularDimensionalRole.ACTUAL_SCORE
FEATURE = MultiDimensionalRole.FEATURE
TAG = MultiDimensionalRole.TAG


def _rand_str() -> str:
    """Generates a random string, useful for adding a new column to a
    dataframe, such that it won't conflict with the existing column names.
    """
    return hex(int(random() * 1e9))


@dataclass(frozen=True)
class SchemaSpec(ABC):
    def __post_init__(self) -> None:
        """Ensure column names are string at run time, which may not be true
        if the user takes them directly from `pd.dataframe.columns`, which
        can contain numbers. Phoenix always uses string to refer to columns
        and dimensions, so this step is intended to eliminate any potential
        issues caused by any pd.dataframe having numbers as column names.
        """
        for f in fields(self):
            if f.type is str or set(get_args(f.type)) <= {str, type(None)}:
                # Ensure string if type is `str` or `Optional[str]` (the
                # latter being `Union[str, None]` under the hood). Use
                # `__setattr__` because `self` is read-only.
                object.__setattr__(self, f.name, _ensure_str(getattr(self, f.name)))


@dataclass(frozen=True)
class CompositeDimensionSpec(SchemaSpec, ABC):
    """A dimension referencing multiple columns (besides its primary column)."""


@dataclass(frozen=True)
class Embedding(CompositeDimensionSpec):
    vector: str
    vector_length: Optional[int] = None
    raw_data: Optional[str] = None
    link: Optional[str] = None
    display_name: Optional[str] = None


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


@dataclass(frozen=True)
class Column:
    """Extracts value from pd.Series or series from pd.DataFrame. If not
    found, returns NaN or a series of NaNs, respectively.
    """

    name: str = ""
    is_dummy: bool = False

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

    def __call__(self, data: Any) -> Any:
        """Extracts series from dataframe, or value from series,
        returning NaN if not found.
        """
        if isinstance(data, pd.DataFrame):
            try:
                return data.loc[:, self.name]
            except KeyError:
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
        yield self.name

    def __str__(self) -> str:
        return self.name


class DataType(IntEnum):
    UNKNOWN = auto()
    DISCRETE = auto()
    CONTINUOUS = auto()


UNKNOWN = DataType.UNKNOWN
DISCRETE = DataType.DISCRETE
CONTINUOUS = DataType.CONTINUOUS


@dataclass(frozen=True)
class Dimension(Column, ABC):
    """All Dimensions are Columns (i.e. dataframe column) but not all Columns
    are Dimensions, e.g. some are just ancillary, like a column of URLs.
    """

    role: DimensionRole = UNASSIGNED
    """The dimension's role in the Model, e.g. FEATURE, TIME, or PREDICTION_ID.
    Must not be unassigned at initialization."""
    data_type: DataType = UNKNOWN
    """Denotes whether the dimension values are continuous or discrete, useful
    for binning."""
    _model: Optional["ProxyType[Model]"] = field(repr=False, default=None)
    """Holds a weak reference to the parent model, if any. This is the channel
    for talking to actual data, so the model can also help out if needed."""

    def __post_init__(self) -> None:
        super().__post_init__()
        if self.role is UNASSIGNED:
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
        return self._min_max

    @cached_property
    def _min_max(self) -> Tuple[Any, Any]:
        assert self._model is not None
        model = cast(Model, self._model)
        return model.dimension_min_max_from_all_df(self.name)

    @property
    def categories(self) -> Iterator[str]:
        if self._model is None or self.data_type is CONTINUOUS:
            return iter(pd.Series(dtype=object))
        # Don't return the cached value directly lest it be mutated by others.
        return iter(self._categories)

    @cached_property
    def _categories(self) -> "pd.Series[Any]":
        assert self._model is not None
        model = cast(Model, self._model)
        return model.dimension_categories_from_all_df(self.name).dropna()


@dataclass(frozen=True)
class EmbeddingDimension(Dimension):
    link: Column = field(default_factory=Column)
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
            _ensure_str(emb.vector),
            link=Column(_ensure_str(emb.link)),
            raw_data=Column(_ensure_str(emb.raw_data)),
            display_name=_ensure_str(emb.display_name),
            **kwargs,
        )

    def __iter__(self) -> Iterator[str]:
        """This is to partake in the iteration of column names by a
        larger data structure of which this object is a member.
        """
        yield from super().__iter__()
        yield from self.raw_data
        yield from self.link


Name: TypeAlias = str
ColumnKey: TypeAlias = Union[Name, Column, SingularDimensionalRole]
MultiDimensionKey: TypeAlias = Union[MultiDimensionalRole, Sequence[DimensionRole]]
RowNumbering: TypeAlias = Union[int, List[int]]


def _is_column_key(key: Any) -> TypeGuard[ColumnKey]:
    return isinstance(key, (str, Column, SingularDimensionalRole))


def _is_multi_dimension_key(
    key: Any,
) -> TypeGuard[MultiDimensionKey]:
    if isinstance(key, Sequence):
        for k in key:
            if not isinstance(k, DimensionRole):
                return False
        return True
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
    def null_value(self) -> Any:
        return pd.Series(dtype=object)

    @property
    def time_range(self) -> TimeRange:
        if self._self_model is None or self.empty:
            # NOTE: as of Python 3.8.16, pandas 1.5.3:
            # >>> isinstance(pd.NaT, datetime.datetime)
            # True
            return TimeRange(pd.NaT, pd.NaT)  # type: ignore
        return self._time_range

    @cached_property
    def _time_range(self) -> TimeRange:
        model = cast(Model, self._self_model)
        min_max = _agg_min_max(model[TIME](self))
        start_time = cast(datetime, min_max.min())
        end_time = cast(datetime, min_max.max())
        # Add one minute to end_time, because time intervals are right
        # open and one minute is the smallest interval allowed.
        stop_time = end_time + timedelta(minutes=1)
        # Round down to the nearest minute.
        start = start_time.replace(second=0, microsecond=0)
        stop = stop_time.replace(second=0, microsecond=0)
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
    _dim_roles: Dict[DimensionRole, List[Name]]
    _original_columns: Dict[DatasetRole, pd.Index]
    # now is used as the substitute for dataframes without timestamps.
    _now: datetime

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
            zip(*_ensure_tuple(dataframes)),
        )
        str_col_dfs = _ensure_str_column_names(dfs)
        padded_dfs = _pad(str_col_dfs, pd.DataFrame)
        padded_df_names = _pad(df_names, _rand_str)
        datasets = starmap(
            self._new_dataset,
            zip(padded_dfs, padded_df_names, DatasetRole),
        )
        # Store datasets by role.
        object.__setattr__(
            self,
            "_datasets",
            {ds.role: ds for ds in datasets},
        )
        # Preserve originals, useful for exporting.
        object.__setattr__(
            self,
            "_original_columns",
            {role: ds.columns for role, ds in self._datasets.items()},
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
            "_dim_roles",
            defaultdict(list, _group_names_by_dim_role(self._dimensions.values())),
        )

        # Guess the data type, i.e. continuous or discrete, for scalar
        # features and tags.
        for dim in self[ScalarDimension]:
            if dim.data_type is UNKNOWN:
                data_type = _guess_data_type(map(dim, self._datasets.values()))
                self._dimensions[dim.name] = replace(dim, data_type=data_type)

        object.__setattr__(self, "_now", datetime.now(timezone.utc))

        # Add PREDICTION_ID if missing.
        # Add TIMESTAMP if missing.
        # If needed, normalize the timestamps values.
        # If needed, sort the dataframes by time.
        for dataset_role, dataset in list(self._datasets.items()):
            df = dataset.__wrapped__
            df_original_columns = self._original_columns[dataset_role]

            # PREDICTION_ID
            dim_pred_id = self._dimensions.get(
                next(iter(self._dim_roles[PREDICTION_ID]), ""),
                self._new_dimension(PREDICTION_ID),
            )
            if dim_pred_id.name not in df_original_columns:
                df[dim_pred_id.name] = _series_uuid(len(df))
            self._dimensions[dim_pred_id.name] = dim_pred_id
            self._dim_roles[PREDICTION_ID] = [dim_pred_id.name]

            # TIMESTAMP
            dim_time = self._dimensions.get(
                next(iter(self._dim_roles[TIME]), ""),
                self._new_dimension(TIME),
            )
            if dim_time.name not in df_original_columns:
                df[dim_time.name] = _series_constant(len(df), self._now)
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
            self._dim_roles[TIME] = [dim_time.name]
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
            self[dataset_role][sorted(row_numbers)].loc[:, self._original_columns[dataset_role]]
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
            and dim.role not in (PREDICTION_ID, TIME)
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
        raise KeyError("invalid key: %s" % repr(key))

    def _get_dim(self, key: ColumnKey) -> Dimension:
        if isinstance(key, DimensionRole):
            key = self._dim_roles[key][0]
        if isinstance(key, str):
            return self._dimensions[key]
        raise KeyError("invalid key: %s" % repr(key))

    def _get_multi_dims(self, key: MultiDimensionKey) -> Iterator[Dimension]:
        for k in _dedup(key) if isinstance(key, Sequence) else (key,):
            if isinstance(k, DimensionRole):
                for name in self._dim_roles[k]:
                    yield self._dimensions[name]
            elif isinstance(k, str):
                yield self._dimensions[k]
            raise KeyError("invalid key: %s" % repr(key))

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
        self, obj: Name, cls: Type[Dimension] = ScalarDimension, **kwargs: Any
    ) -> Dimension:
        ...

    @overload
    def _new_dimension(self, obj: Dimension, **kwargs: Any) -> Dimension:
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
        raise ValueError("invalid argument: %s" % repr(obj))

    def _new_dataset(self, df: pd.DataFrame, /, name: str, role: DatasetRole) -> Dataset:
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

    features: Iterable[Union[str, CompositeDimensionSpec]] = field(default_factory=list)
    tags: Iterable[Union[str, CompositeDimensionSpec]] = field(default_factory=list)

    # internal attribute not exposed to users
    _dimensions: List[Dimension] = field(
        init=False, repr=False, hash=False, compare=False, default_factory=list
    )

    def __post_init__(self) -> None:
        # Deduplicate using set().
        object.__setattr__(self, "features", set(self.features))
        object.__setattr__(self, "tags", set(self.tags))
        # Raise ValueError if one column name is assigned to two different
        # roles, e.g. as both features and tags.
        for name, group in groupby(sorted(self._make_dims(), key=str), key=str):
            if len(dims := list(group)) > 1:
                raise ValueError(
                    "`%s` is specified as both `%s` and `%s`"
                    % (
                        name,
                        dims[0].role.name,
                        dims[1].role.name,
                    )
                )
            self._dimensions.append(dims[0])
        super().__post_init__()

    def _make_dims(self) -> Iterator[Dimension]:
        """Iterate over all dimensions defined by the Schema, substituting
        with dummy dimensions for ones omitted by user. The dummy dimensions
        have randomly generated names that can change for each iteration, but
        currently there's no need to iterate more than once."""
        for spec, role, data_type in chain(
            (
                (self.prediction_id, PREDICTION_ID, DISCRETE),
                (self.timestamp, TIME, CONTINUOUS),
                (self.prediction_label, PREDICTION_LABEL, DISCRETE),
                (self.prediction_score, PREDICTION_SCORE, CONTINUOUS),
                (self.actual_label, ACTUAL_LABEL, DISCRETE),
                (self.actual_score, ACTUAL_SCORE, CONTINUOUS),
            ),
            zip(self.features, repeat(FEATURE), repeat(UNKNOWN)),
            zip(self.tags, repeat(TAG), repeat(UNKNOWN)),
        ):
            if not isinstance(spec, CompositeDimensionSpec):
                spec = _ensure_str(spec)
            assert isinstance(role, DimensionRole)  # for mypy
            if isinstance(spec, str):
                yield ScalarDimension(spec, role=role, data_type=data_type)
            elif isinstance(spec, Embedding):
                yield EmbeddingDimension.from_(spec, role=role, data_type=data_type)
            else:
                raise TypeError("%s has unrecognized type: %s" % (role, type(spec)))

    def __call__(
        self,
        *dataframes: Union[pd.DataFrame, Tuple[Name, pd.DataFrame]],
        **kwargs: Any,
    ) -> Model:
        """Dimensions are the "baton" that Schema hands over to Model."""
        _raise_if_too_many_dataframes(len(dataframes))
        return Model(iter(self._dimensions), dataframes, **kwargs)

    def to_json(self, **kwargs: Any) -> str:
        return json.dumps(_jsonify(self), **kwargs)

    @classmethod
    def from_json(cls, json_string: str) -> Any:
        json_data = json.loads(json_string)
        return cls(**_objectify(json_data))


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
    for role, dims in groupby(sorted(dimensions, key=_dim_role), key=_dim_role):
        yield role, list(map(str, dims))


def _guess_data_type(series: Iterable["pd.Series[Any]"]) -> DataType:
    for s in series:
        if is_numeric_dtype(s) or is_datetime64_any_dtype(s):
            return CONTINUOUS
    return DISCRETE


_H = TypeVar("_H", bound=Hashable)


def _dedup(it: Iterable[_H]) -> Iterator[_H]:
    seen: Set[_H] = set()
    for item in it:
        if item not in seen:
            seen.add(item)
            yield item


@lru_cache(maxsize=len(DatasetRole))
# Note that NaN can't be cached, because NaN != NaN.
def _series_constant(length: int, constant: Any) -> "pd.Series[Any]":
    return pd.Series(np.full(length, constant))


def _series_uuid(length: int) -> "pd.Series[str]":
    return pd.Series(map(lambda _: uuid4(), range(length)))


def _raise_if_too_many_dataframes(given: int) -> None:
    if not 0 < given <= (limit := len(DatasetRole)):
        raise ValueError("expected between 1 to %s dataframes, but %s were given" % (limit, given))


def _ensure_str(obj: Optional[str]) -> str:
    return "" if obj is None else str(obj)


def _ensure_tuple(
    dataframes: Iterable[Union[pd.DataFrame, Tuple[Name, pd.DataFrame]]],
) -> Iterator[Tuple[Name, pd.DataFrame]]:
    for df in dataframes:
        if type(df) is pd.DataFrame:
            yield (_rand_str(), df)
        elif _is_named_df(df):
            yield df
        else:
            raise ValueError("unexpected type: %s" % type(df))


def _ensure_str_column_names(
    dataframes: Iterable[pd.DataFrame],
) -> Iterator[pd.DataFrame]:
    for df in dataframes:
        yield df.set_axis(df.columns.astype(str), axis=1)


_T = TypeVar("_T")


def _pad(
    it: Iterable[_T],
    padding: Callable[[], _T],
) -> Iterator[_T]:
    for item in it:
        yield item if item is not None else padding()
    while True:
        yield padding()


def _normalize_timestamps(timestamps: "pd.Series[Any]") -> "pd.Series[Any]":
    data_type = timestamps.dtype
    if is_numeric_dtype(data_type):
        return pd.to_datetime(timestamps, unit="s", utc=True)
    elif is_datetime64tz_dtype(data_type):
        return timestamps.dt.tz_convert(timezone.utc)
    elif is_datetime64_any_dtype(data_type):
        return timestamps.dt.tz_localize(timezone.utc)
    raise ValueError(
        "When provided, the timestamps must be numeric or datetime, "
        "but found %s instead." % data_type
    )


def _dim_role(dim: Dimension) -> DimensionRole:
    return dim.role


def _jsonify(obj: Any) -> Any:
    if type(obj) is str:
        return str
    if getattr(obj, "__dataclass_fields__", None):
        return {
            attribute.name: _jsonify(
                getattr(obj, attribute.name),
            )
            for attribute in fields(obj)
            if attribute.init
        }
    if isinstance(obj, Iterable):
        return list(map(_jsonify, iter(obj)))
    return obj


def _objectify(json_data: Any) -> Any:
    if isinstance(json_data, str):
        return json_data
    if isinstance(json_data, list):
        return list(map(_objectify, json_data))
    assert isinstance(json_data, dict)
    json_data = {key: _objectify(value) for key, value in json_data.items()}
    # Note that this Looks only at the immediate subclasses (for now).
    for cls in CompositeDimensionSpec.__subclasses__():
        try:
            return cls(**json_data)
        except TypeError:
            pass
    raise ValueError("invalid json data: %s" % json_data)


_id_pat = re.compile(r"\bid\b", re.IGNORECASE)


def _title_case_no_underscore(name: str) -> str:
    """E.g. `PREDICTION_ID` turns into `Prediction ID`"""
    return _id_pat.sub("ID", name.replace("_", " ").title())
