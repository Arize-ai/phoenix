import threading
from collections import defaultdict
from contextlib import contextmanager
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from functools import cached_property
from itertools import chain, groupby, repeat, starmap
from typing import (
    Any,
    BinaryIO,
    Callable,
    Dict,
    Generic,
    Hashable,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Tuple,
    Type,
    TypeVar,
    Union,
    cast,
    overload,
)
from uuid import uuid4
from weakref import proxy

import numpy as np
import pandas as pd
from pandas.core.dtypes.common import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_datetime64tz_dtype,
    is_numeric_dtype,
)

from phoenix.core.data_type import CONTINUOUS, DISCRETE, UNKNOWN, DataType
from phoenix.core.dataset import Dataset
from phoenix.core.dataset_role import DatasetRole
from phoenix.core.dimension import Dimension
from phoenix.core.dimension_role import DimensionRole
from phoenix.core.embedding_dimension import EmbeddingDimension
from phoenix.core.helpers import (
    ConstantValueSeriesFactory,
    agg_min_max,
    iterate_except_str,
    random_string,
)
from phoenix.core.multi_dimensional_role import FEATURE
from phoenix.core.scalar_dimension import ScalarDimension
from phoenix.core.singular_dimensional_role import PREDICTION_ID, TIMESTAMP
from phoenix.core.types import (
    ColumnKey,
    MultiDimensionKey,
    Name,
    is_column_key,
    is_dimension_type_filter,
    is_multi_dimension_key,
    is_named_df,
)

_Key = TypeVar("_Key", bound=Hashable)
_Value = TypeVar("_Value")


@dataclass(frozen=True, repr=False, eq=False)
class _Cache(Generic[_Key, _Value]):
    """A thread-safe type-safe generic cache backed by a dictionary.

    Example
    -------
    >>> c = _Cache[str, int]()
    >>> with c() as cache:
    >>>     cache["1"] = 2
    >>> with c() as cache:
    >>>     print(cache["1"])
    2
    """

    _cache: Dict[_Key, _Value] = field(
        init=False,
        default_factory=dict,
    )
    _lock: threading.Lock = field(
        init=False,
        default_factory=threading.Lock,
    )

    @contextmanager
    def __call__(self) -> Iterator[Dict[_Key, _Value]]:
        with self._lock:
            yield self._cache


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
    _default_timestamps_factory: ConstantValueSeriesFactory
    _nan_series_factory: ConstantValueSeriesFactory
    _dimension_categories_from_all_datasets: _Cache[Name, Tuple[str, ...]]
    _dimension_min_max_from_all_datasets: _Cache[Name, Tuple[float, float]]

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
        # memoization
        object.__setattr__(
            self,
            "_dimension_categories_from_all_datasets",
            _Cache[Name, "pd.Series[Any]"](),
        )
        object.__setattr__(
            self,
            "_dimension_min_max_from_all_datasets",
            _Cache[Name, Tuple[float, float]](),
        )

        df_names, dfs = cast(
            Tuple[Iterable[Name], Iterable[pd.DataFrame]],
            zip(*_coerce_tuple(dataframes)),
        )
        str_col_dfs = _coerce_str_column_names(dfs)
        padded_dfs = _add_padding(str_col_dfs, pd.DataFrame)
        padded_df_names = _add_padding(df_names, random_string)
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

        object.__setattr__(
            self,
            "_nan_series_factory",
            ConstantValueSeriesFactory(np.nan),
        )
        object.__setattr__(
            self,
            "_default_timestamps_factory",
            ConstantValueSeriesFactory(datetime.now(timezone.utc)),
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
            if dim.data_type is not UNKNOWN:
                continue
            self._dimensions[dim.name] = replace(
                dim,
                data_type=(
                    _guess_data_type(
                        dataset.loc[:, dim.name]
                        for dataset in self._datasets.values()
                        if dim.name in dataset.columns
                    )
                ),
            )

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
                df[dim_time.name] = self._default_timestamps_factory(len(df))
            else:
                if not timestamps_already_normalized:
                    # Don't clobber the original (or any other column).
                    # Store as new column with a random name.
                    new_name, old_name = random_string(), dim_time.name
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
        row_numbers: Mapping[DatasetRole, Iterable[int]],
        parquet_file: BinaryIO,
        cluster_ids: Optional[Mapping[DatasetRole, Mapping[int, str]]] = None,
    ) -> None:
        """
        Given row numbers, exports dataframe subset into parquet file.
        Duplicate rows are removed. If the model hase more than one dataset, a
        new column is added to the dataframe containing the dataset name of
        each row in the exported data. The name of the added column will be
        `__phoenix_dataset_name__`.

        Parameters
        ----------
        row_numbers: Mapping[DatasetRole, Iterable[int]]
            mapping of dataset role to list of row numbers
        parquet_file: file handle
            output parquet file handle
        cluster_ids: Optional[Mapping[DatasetRole, Mapping[int, str]]]
            mapping of dataset role to mapping of row number to cluster id.
            If cluster_ids is non-empty, a new column is inserted to the
            dataframe containing the cluster IDs of each row in the exported
            data. The name of the added column name is `__phoenix_cluster_id__`.
        """
        export_dataframes = [pd.DataFrame()]
        model_has_multiple_datasets = sum(not df.empty for df in self._datasets.values()) > 1
        for dataset_role, numbers in row_numbers.items():
            df = self._datasets[dataset_role]
            columns = [
                df.columns.get_loc(column_name)
                for column_name in self._original_columns_by_role[dataset_role]
            ]
            rows = pd.Series(sorted(set(numbers)))
            filtered_df = df.iloc[rows, columns].reset_index(drop=True)
            if model_has_multiple_datasets:
                filtered_df["__phoenix_dataset_name__"] = df.display_name
            if cluster_ids and (ids := cluster_ids.get(dataset_role)):
                filtered_df["__phoenix_cluster_id__"] = rows.apply(ids.get)
            export_dataframes.append(filtered_df)
        pd.concat(export_dataframes).to_parquet(
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

    def dimension_categories_from_all_datasets(
        self,
        dimension_name: Name,
    ) -> Tuple[str, ...]:
        dim = self[dimension_name]
        if dim.data_type is CONTINUOUS:
            return cast(Tuple[str, ...], ())
        with self._dimension_categories_from_all_datasets() as cache:
            try:
                return cache[dimension_name]
            except KeyError:
                pass
        categories_by_dataset = (
            pd.Series(dim[role].unique()).dropna().astype(str) for role in DatasetRole
        )
        all_values_combined = chain.from_iterable(categories_by_dataset)
        ans = tuple(np.sort(pd.Series(all_values_combined).unique()))
        with self._dimension_categories_from_all_datasets() as cache:
            cache[dimension_name] = ans
        return ans

    def dimension_min_max_from_all_df(
        self,
        dimension_name: Name,
    ) -> Tuple[float, float]:
        dim = self[dimension_name]
        if dim.data_type is not CONTINUOUS:
            return (np.nan, np.nan)
        with self._dimension_min_max_from_all_datasets() as cache:
            try:
                return cache[dimension_name]
            except KeyError:
                pass
        min_max_by_df = (agg_min_max(dim[df_role]) for df_role in DatasetRole)
        all_values_combined = chain.from_iterable(min_max_by_df)
        min_max = agg_min_max(pd.Series(all_values_combined))
        ans = (min_max.min(), min_max.max())
        with self._dimension_min_max_from_all_datasets() as cache:
            cache[dimension_name] = ans
        return ans

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
        if is_column_key(key):
            return self._get_dim(key)
        if is_multi_dimension_key(key):
            return self._get_multi_dims(key)
        if is_dimension_type_filter(key):
            return self._get_multi_dims_by_type(key)
        if key is ScalarDimension:
            return filter(
                lambda dim: type(dim) is ScalarDimension,
                self._dimensions.values(),
            )
        if key is EmbeddingDimension:
            return filter(
                lambda dim: type(dim) is EmbeddingDimension,
                self._dimensions.values(),
            )
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
        for k in iterate_except_str(key):
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
        model weak reference to the `self` Model instance, and sharing the
        NaN series factory as an optimization.
        """
        if isinstance(obj, Name):
            return cls(
                obj,
                **kwargs,
                _model=proxy(self),
                _default=self._nan_series_factory,
            )
        if isinstance(obj, DimensionRole):
            return cls(
                role=obj,
                **kwargs,
                _model=proxy(self),
                _default=self._nan_series_factory,
            )
        if isinstance(obj, Dimension):
            return replace(
                obj,
                **kwargs,
                _model=proxy(self),
                _default=self._nan_series_factory,
            )
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


_T = TypeVar("_T")


def _add_padding(
    iterable: Iterable[_T],
    padding: Callable[[], _T],
) -> Iterator[_T]:
    return chain(
        (item if item is not None else padding() for item in iterable),
        repeat(padding()),
    )


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


def _series_uuid(length: int) -> "pd.Series[str]":
    return pd.Series(map(lambda _: uuid4(), range(length)))


def _coerce_tuple(
    dataframes: Iterable[Union[pd.DataFrame, Tuple[Name, pd.DataFrame]]],
) -> Iterator[Tuple[Name, pd.DataFrame]]:
    for dataframe in dataframes:
        if isinstance(dataframe, pd.DataFrame):
            yield (random_string(), dataframe)
        elif is_named_df(dataframe):
            yield dataframe
        else:
            raise ValueError(f"unexpected type: {type(dataframe)}")


def _coerce_str_column_names(
    dataframes: Iterable[pd.DataFrame],
) -> Iterator[pd.DataFrame]:
    return (
        df.set_axis(
            df.columns.astype(str),
            axis=1,
            copy=False,
        )
        for df in dataframes
    )
