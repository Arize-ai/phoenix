import warnings
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime
from functools import cached_property
from itertools import chain
from secrets import token_hex
from types import MappingProxyType
from typing import Any, Optional, cast

import pandas as pd
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import JSON, Column, Label, Select, SQLColumnExpression, and_, func, or_, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import Session
from typing_extensions import assert_never

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.trace.attributes import (
    JSON_STRING_ATTRIBUTES,
    SEMANTIC_CONVENTIONS,
    flatten,
    get_attribute_value,
    load_json_strings,
    unflatten,
)
from phoenix.trace.dsl import SpanFilter
from phoenix.trace.dsl.filter import Projector
from phoenix.trace.schemas import ATTRIBUTE_PREFIX

DEFAULT_SPAN_LIMIT = 1000

RETRIEVAL_DOCUMENTS = SpanAttributes.RETRIEVAL_DOCUMENTS

_SPAN_ID = "context.span_id"
_PRESCRIBED_POSITION_PREFIXES = {
    RETRIEVAL_DOCUMENTS: "document_",
    ATTRIBUTE_PREFIX + RETRIEVAL_DOCUMENTS: "document_",
}
_ALIASES = {
    "span_id": "context.span_id",
    "trace_id": "context.trace_id",
}


def _unalias(key: str) -> str:
    return _ALIASES.get(key, key)


@dataclass(frozen=True)
class _Base:
    """The sole purpose of this class is for `super().__post_init__()` to work"""

    def __post_init__(self) -> None:
        pass


@dataclass(frozen=True)
class Projection(_Base):
    key: str = ""
    _projector: Projector = field(init=False, repr=False)

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "key", _unalias(self.key))
        object.__setattr__(self, "_projector", Projector(self.key))

    def __bool__(self) -> bool:
        return bool(self.key)

    def __call__(self) -> SQLColumnExpression[Any]:
        return self._projector()

    def to_dict(self) -> dict[str, Any]:
        return {"key": self.key}

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "Projection":
        return cls(**({"key": cast(str, key)} if (key := obj.get("key")) else {}))


@dataclass(frozen=True)
class _HasTmpSuffix(_Base):
    _tmp_suffix: str = field(init=False, repr=False)
    """Ideally every column label should get a temporary random suffix that will
    be removed at the end. This is necessary during query construction because
    sqlalchemy is not always foolproof, e.g. we have seen `group_by` clauses that
    were incorrect or ambiguous. We should actively avoid name collisions, which
    is increasingly likely as queries get more complex.
    """

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "_tmp_suffix", _randomize())

    def _remove_tmp_suffix(self, name: str) -> str:
        if name.endswith(self._tmp_suffix):
            return name[: -len(self._tmp_suffix)]
        return name

    def _add_tmp_suffix(self, name: str) -> str:
        if name.endswith(self._tmp_suffix):
            return name
        return name + self._tmp_suffix


@dataclass(frozen=True)
class Explosion(_HasTmpSuffix, Projection):
    kwargs: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    primary_index_key: str = "context.span_id"

    _position_prefix: str = field(init=False, repr=False)
    _primary_index: Projection = field(init=False, repr=False)
    _array_tmp_col_label: str = field(init=False, repr=False)
    """For sqlite we need to store the array in a temporary column to be able
    to explode it later in pandas. `_array_tmp_col_label` is the name of this
    temporary column. The temporary column will have a unique name
    per instance.
    """

    def __post_init__(self) -> None:
        super().__post_init__()
        position_prefix = _PRESCRIBED_POSITION_PREFIXES.get(self.key, "")
        object.__setattr__(self, "_position_prefix", position_prefix)
        object.__setattr__(self, "_primary_index", Projection(self.primary_index_key))
        object.__setattr__(self, "_array_tmp_col_label", _randomize("__array_tmp_col"))

    @cached_property
    def index_keys(self) -> list[str]:
        return [self._primary_index.key, f"{self._position_prefix}position"]

    def with_primary_index_key(self, _: str) -> "Explosion":
        print("`.with_primary_index_key(...)` is deprecated and will be removed in the future.")
        return self

    def update_sql(
        self,
        stmt: Select[Any],
        dialect: SupportedSQLDialect,
    ) -> Select[Any]:
        array = self()
        if dialect is SupportedSQLDialect.SQLITE:
            # Because sqlite doesn't support `WITH ORDINALITY`, the order of
            # the returned (table) values is not guaranteed. So we resort to
            # post hoc processing using pandas.
            stmt = stmt.where(
                func.json_type(array) == "array",
            ).add_columns(
                array.label(self._array_tmp_col_label),
            )
            return stmt
        elif dialect is SupportedSQLDialect.POSTGRESQL:
            element = (
                func.jsonb_array_elements(array)
                .table_valued(
                    Column("obj", JSON),
                    with_ordinality="position",
                    joins_implicitly=True,
                )
                .render_derived()
            )
            obj, position = element.c.obj, element.c.position
            # Use zero-based indexing for backward-compatibility.
            position_label = (position - 1).label(f"{self._position_prefix}position")
            if self.kwargs:
                columns: Iterable[Label[Any]] = (
                    obj[key.split(".")].label(self._add_tmp_suffix(name))
                    for name, key in self.kwargs.items()
                )
            else:
                columns = (obj.label(self._array_tmp_col_label),)
            stmt = (
                stmt.where(func.jsonb_typeof(array) == "array")
                .where(func.jsonb_typeof(obj) == "object")
                .add_columns(position_label, *columns)
            )
            return stmt
        else:
            assert_never(dialect)

    def update_df(
        self,
        df: pd.DataFrame,
        dialect: SupportedSQLDialect,
    ) -> pd.DataFrame:
        df = df.rename(self._remove_tmp_suffix, axis=1)
        if df.empty:
            columns = list(
                set(
                    chain(
                        self.index_keys,
                        df.drop(self._array_tmp_col_label, axis=1, errors="ignore").columns,
                        self.kwargs.keys(),
                    )
                )
            )
            df = pd.DataFrame(columns=columns).set_index(self.index_keys)
            return df
        if dialect != SupportedSQLDialect.SQLITE and self.kwargs:
            df = df.set_index(self.index_keys)
            return df
        if dialect is SupportedSQLDialect.SQLITE:
            # Because sqlite doesn't support `WITH ORDINALITY`, the order of
            # the returned (table) values is not guaranteed. So we resort to
            # post hoc processing using pandas.
            def _extract_values(array: list[Any]) -> list[dict[str, Any]]:
                if not isinstance(array, Iterable):
                    return []
                if not self.kwargs:
                    return [
                        {
                            **dict(flatten(obj)),
                            f"{self._position_prefix}position": i,
                        }
                        for i, obj in enumerate(array)
                        if isinstance(obj, Mapping)
                    ]
                res: list[dict[str, Any]] = []
                for i, obj in enumerate(array):
                    if not isinstance(obj, Mapping):
                        continue
                    values: dict[str, Any] = {f"{self._position_prefix}position": i}
                    for name, key in self.kwargs.items():
                        if (value := get_attribute_value(obj, key)) is not None:
                            values[name] = value
                    res.append(values)
                return res

            records = df.loc[:, self._array_tmp_col_label].dropna().map(_extract_values).explode()
        elif dialect is SupportedSQLDialect.POSTGRESQL:
            records = df.loc[:, self._array_tmp_col_label].dropna().map(flatten).map(dict)
        else:
            assert_never(dialect)
        df = df.drop(self._array_tmp_col_label, axis=1)
        if records.empty:
            df = df.set_index(self.index_keys[0])
            return df
        not_na = records.notna()
        df_explode = pd.DataFrame.from_records(
            records.loc[not_na].to_list(),
            index=records.index[not_na],
        )
        if dialect is SupportedSQLDialect.SQLITE:
            df = _outer_join(df, df_explode)
        elif dialect is SupportedSQLDialect.POSTGRESQL:
            df = pd.concat([df, df_explode], axis=1)
        else:
            assert_never(dialect)
        df = df.set_index(self.index_keys)
        return df

    def to_dict(self) -> dict[str, Any]:
        return {
            **super().to_dict(),
            **({"kwargs": dict(self.kwargs)} if self.kwargs else {}),
            "primary_index_key": self.primary_index_key,
        }

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "Explosion":
        return cls(
            **({"key": cast(str, key)} if (key := obj.get("key")) else {}),  # type: ignore
            **(
                {"kwargs": MappingProxyType(dict(cast(Mapping[str, str], kwargs)))}  # type: ignore
                if (kwargs := obj.get("kwargs"))
                else {}
            ),
            **(
                {"primary_index_key": cast(str, primary_index_key)}  # type: ignore
                if (primary_index_key := obj.get("primary_index_key"))
                else {}
            ),
        )


@dataclass(frozen=True)
class Concatenation(_HasTmpSuffix, Projection):
    kwargs: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    separator: str = "\n\n"

    _array_tmp_col_label: str = field(init=False, repr=False)
    """For SQLite we need to store the array in a temporary column to be able
    to concatenate it later in pandas. `_array_tmp_col_label` is the name of
    this temporary column. The temporary column will have a unique name
    per instance.
    """

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "_array_tmp_col_label", _randomize("__array_tmp_col"))

    def with_separator(self, separator: str = "\n\n") -> "Concatenation":
        return replace(self, separator=separator)

    def update_sql(
        self,
        stmt: Select[Any],
        dialect: SupportedSQLDialect,
    ) -> Select[Any]:
        array = self()
        if dialect is SupportedSQLDialect.SQLITE:
            # Because SQLite doesn't support `WITH ORDINALITY`, the order of
            # the returned table-values is not guaranteed. So we resort to
            # post hoc processing using pandas.
            stmt = stmt.where(
                func.json_type(array) == "array",
            ).add_columns(
                array.label(self._array_tmp_col_label),
            )
            return stmt
        elif dialect is SupportedSQLDialect.POSTGRESQL:
            element = (
                (
                    func.jsonb_array_elements(array)
                    if self.kwargs
                    else func.jsonb_array_elements_text(array)
                )
                .table_valued(
                    Column("obj", JSON),
                    with_ordinality="position",
                    joins_implicitly=True,
                )
                .render_derived()
            )
            obj, position = element.c.obj, element.c.position
            if self.kwargs:
                columns: Iterable[Label[Any]] = (
                    func.string_agg(
                        obj[key.split(".")].as_string(),
                        aggregate_order_by(self.separator, position),  # type: ignore
                    ).label(self._add_tmp_suffix(label))
                    for label, key in self.kwargs.items()
                )
            else:
                columns = (
                    func.string_agg(
                        obj,
                        aggregate_order_by(self.separator, position),  # type: ignore
                    ).label(self.key),
                )
            stmt = (
                stmt.where(
                    and_(
                        func.jsonb_typeof(array) == "array",
                        *((func.jsonb_typeof(obj) == "object",) if self.kwargs else ()),
                    )
                )
                .add_columns(*columns)
                .group_by(*stmt.columns.keys())
            )
            return stmt
        else:
            assert_never(dialect)

    def update_df(
        self,
        df: pd.DataFrame,
        dialect: SupportedSQLDialect,
    ) -> pd.DataFrame:
        df = df.rename(self._remove_tmp_suffix, axis=1)
        if df.empty:
            columns = list(
                set(
                    chain(
                        df.drop(self._array_tmp_col_label, axis=1, errors="ignore").columns,
                        self.kwargs.keys(),
                    )
                )
            )
            return pd.DataFrame(columns=columns, index=df.index)
        if dialect is SupportedSQLDialect.SQLITE:
            # Because SQLite doesn't support `WITH ORDINALITY`, the order of
            # the returned table-values is not guaranteed. So we resort to
            # post hoc processing using pandas.
            def _concat_values(array: list[Any]) -> dict[str, Any]:
                if not isinstance(array, Iterable):
                    return {}
                if not self.kwargs:
                    return {self.key: self.separator.join(str(obj) for obj in array)}
                values: defaultdict[str, list[str]] = defaultdict(list)
                for i, obj in enumerate(array):
                    if not isinstance(obj, Mapping):
                        continue
                    for label, key in self.kwargs.items():
                        if (value := get_attribute_value(obj, key)) is not None:
                            values[label].append(str(value))
                return {label: self.separator.join(vs) for label, vs in values.items()}

            records = df.loc[:, self._array_tmp_col_label].map(_concat_values)
            df_concat = pd.DataFrame.from_records(records.to_list(), index=records.index)
            return df.drop(self._array_tmp_col_label, axis=1).join(df_concat, how="outer")
        elif dialect is SupportedSQLDialect.POSTGRESQL:
            pass
        else:
            assert_never(dialect)
        return df

    def to_dict(self) -> dict[str, Any]:
        return {
            **super().to_dict(),
            **({"kwargs": dict(self.kwargs)} if self.kwargs else {}),
            "separator": self.separator,
        }

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "Concatenation":
        return cls(
            **({"key": cast(str, key)} if (key := obj.get("key")) else {}),  # type: ignore
            **(
                {"kwargs": MappingProxyType(dict(cast(Mapping[str, str], kwargs)))}  # type: ignore
                if (kwargs := obj.get("kwargs"))
                else {}
            ),
            **(
                {"separator": cast(str, separator)}  # type: ignore
                if (separator := obj.get("separator"))
                else {}
            ),
        )


@dataclass(frozen=True)
class SpanQuery(_HasTmpSuffix):
    _select: Mapping[str, Projection] = field(default_factory=lambda: MappingProxyType({}))
    _concat: Optional[Concatenation] = field(default=None)
    _explode: Optional[Explosion] = field(default=None)
    _filter: Optional[SpanFilter] = field(default=None)
    _rename: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    _index: Projection = field(default_factory=lambda: Projection("context.span_id"))
    _concat_separator: str = field(default="\n\n", repr=False)
    _pk_tmp_col_label: str = field(init=False, repr=False)
    """We use `_pk_tmp_col_label` as a temporary column for storing
    the row id, i.e. the primary key, of the spans table. This will help
    us with joins without the risk of naming conflicts. The temporary
    column will have a unique name per instance.
    """

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "_pk_tmp_col_label", _randomize("__pk_tmp_col"))

    def __bool__(self) -> bool:
        return bool(self._select) or bool(self._filter) or bool(self._explode) or bool(self._concat)

    def select(self, *args: str, **kwargs: str) -> "SpanQuery":
        _select = {
            _unalias(name): Projection(key) for name, key in (*zip(args, args), *kwargs.items())
        }
        return replace(self, _select=MappingProxyType(_select))

    def where(self, condition: str) -> "SpanQuery":
        _filter = SpanFilter(condition)
        return replace(self, _filter=_filter)

    def explode(self, key: str, **kwargs: str) -> "SpanQuery":
        assert (
            isinstance(key, str) and key
        ), "The field name for explosion must be a non-empty string."
        _explode = Explosion(key=key, kwargs=kwargs, primary_index_key=self._index.key)
        return replace(self, _explode=_explode)

    def concat(self, key: str, **kwargs: str) -> "SpanQuery":
        assert (
            isinstance(key, str) and key
        ), "The field name for concatenation must be a non-empty string."
        _concat = (
            Concatenation(key=key, kwargs=kwargs, separator=self._concat.separator)
            if self._concat
            else Concatenation(key=key, kwargs=kwargs, separator=self._concat_separator)
        )
        return replace(self, _concat=_concat)

    def rename(self, **kwargs: str) -> "SpanQuery":
        _rename = MappingProxyType(kwargs)
        return replace(self, _rename=_rename)

    def with_index(self, key: str = "context.span_id") -> "SpanQuery":
        _index = Projection(key=key)
        return (
            replace(self, _index=_index, _explode=replace(self._explode, primary_index_key=key))
            if self._explode
            else replace(self, _index=_index)
        )

    def with_concat_separator(self, separator: str = "\n\n") -> "SpanQuery":
        if not self._concat:
            return replace(self, _concat_separator=separator)
        _concat = self._concat.with_separator(separator)
        return replace(self, _concat=_concat)

    def with_explode_primary_index_key(self, _: str) -> "SpanQuery":
        print(
            "`.with_explode_primary_index_key(...)` is deprecated and will be "
            "removed in the future. Use `.with_index(...)` instead."
        )
        return self

    def __call__(
        self,
        session: Session,
        project_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = DEFAULT_SPAN_LIMIT,
        root_spans_only: Optional[bool] = None,
        # Deprecated
        stop_time: Optional[datetime] = None,
        *,
        orphan_span_as_root_span: bool = True,
    ) -> pd.DataFrame:
        """Execute the span query and return results as a pandas DataFrame.

        This method executes the configured span query against the database and returns
        the results as a pandas DataFrame. The query can include projections, filters,
        explosions, and concatenations of span data.

        Args:
            session (Session): The SQLAlchemy database session to use for the query.
            project_name (str, optional): The name of the project to query spans for.
                If not provided, uses the default project name. Default None.
            start_time (datetime, optional): The start time for the query range. Default None.
            end_time (datetime, optional): The end time for the query range. Default None.
            limit (int, optional): Maximum number of spans to return. Defaults to DEFAULT_SPAN_LIMIT.
            root_spans_only (bool, optional): If True, only root spans are returned. Default None.
            stop_time (datetime, optional): Deprecated. Use end_time instead. Default None.
            orphan_span_as_root_span (bool): If True, orphan spans are treated as root spans. An
                orphan span has a non-null `parent_id` but a span with that ID is currently not
                found in the database. Default True.

        Returns:
            pd.DataFrame: A DataFrame containing the query results. The structure of the DataFrame
                depends on the query configuration:
                - If no projections are specified, returns all span fields
                - If projections are specified, returns only the requested fields
                - If explosion is configured, returns exploded array fields as separate rows
                - If concatenation is configured, returns concatenated array fields as strings
                - The index is set to the configured index field (default: context.span_id)

        Note:
            The query execution is optimized based on the database dialect (SQLite or PostgreSQL).
            Some operations may be performed in pandas after fetching the data from SQLite.
        """  # noqa: E501
        if not project_name:
            project_name = DEFAULT_PROJECT_NAME
        if stop_time:
            # Deprecated. Raise a warning
            warnings.warn(
                "stop_time is deprecated. Use end_time instead.",
                DeprecationWarning,
            )
            end_time = end_time or stop_time
        if not (self._select or self._explode or self._concat):
            return _get_spans_dataframe(
                session,
                project_name,
                span_filter=self._filter,
                start_time=start_time,
                end_time=end_time,
                limit=limit,
                root_spans_only=root_spans_only,
                orphan_span_as_root_span=orphan_span_as_root_span,
            )
        assert session.bind is not None
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        row_id = models.Span.id.label(self._pk_tmp_col_label)
        stmt: Select[Any] = (
            # We do not allow `group_by` anything other than `row_id` because otherwise
            # it's too complex for the post hoc processing step in pandas.
            select(row_id)
            .join(models.Trace)
            .join(models.Project)
            .where(models.Project.name == project_name)
        )
        if start_time:
            stmt = stmt.where(start_time <= models.Span.start_time)
        if end_time:
            stmt = stmt.where(models.Span.start_time < end_time)
        if limit is not None:
            stmt = stmt.limit(limit)
        if root_spans_only:
            # A root span is either a span with no parent_id or an orphan span
            # (a span whose parent_id references a span that doesn't exist in the database)
            if orphan_span_as_root_span:
                # Include both types of root spans:
                parent_spans = select(models.Span.span_id).alias("parent_spans")
                stmt = stmt.where(
                    ~select(1).where(models.Span.parent_id == parent_spans.c.span_id).exists(),
                    # Note: We avoid using an OR clause with Span.parent_id.is_(None) here
                    # because it significantly degraded PostgreSQL performance (>10x worse)
                    # during testing.
                )
            else:
                # Only include explicit root spans (spans with parent_id = NULL)
                stmt = stmt.where(models.Span.parent_id.is_(None))
        stmt0_orig: Select[Any] = stmt
        stmt1_filter: Optional[Select[Any]] = None
        if self._filter:
            stmt = stmt1_filter = self._filter(stmt)
        stmt2_select: Optional[Select[Any]] = None
        if self._select:
            columns: Iterable[Label[Any]] = (
                proj().label(self._add_tmp_suffix(label)) for label, proj in self._select.items()
            )
            stmt = stmt2_select = stmt.add_columns(*columns)
        stmt3_explode: Optional[Select[Any]] = None
        if self._explode:
            stmt = stmt3_explode = self._explode.update_sql(stmt, dialect)
        index: Label[Any] = self._index().label(self._add_tmp_suffix(self._index.key))
        df: Optional[pd.DataFrame] = None
        # `concat` is done separately because it has `group_by` but we can't
        # always join to it as a subquery because it may require post hoc
        # processing in pandas. It's kept separate for simplicity.
        df_concat: Optional[pd.DataFrame] = None
        conn = session.connection()
        if self._explode or not self._concat:
            if index.name not in stmt.selected_columns.keys():
                stmt = stmt.add_columns(index)
            df = pd.read_sql_query(stmt, conn, self._pk_tmp_col_label)
        if self._concat:
            if df is not None:
                assert stmt3_explode is not None
                # We can't include stmt3_explode because it may be trying to
                # explode the same column that we're trying to concatenate,
                # resulting in duplicated joins.
                stmt_no_explode = (
                    stmt2_select
                    if stmt2_select is not None
                    else (stmt1_filter if stmt1_filter is not None else stmt0_orig)
                )
                stmt4_concat = stmt_no_explode.with_only_columns(row_id)
            else:
                assert stmt3_explode is None
                stmt4_concat = stmt
            if (df is None or df.empty) and index.name not in stmt4_concat.selected_columns.keys():
                stmt4_concat = stmt4_concat.add_columns(index)
            stmt4_concat = self._concat.update_sql(stmt4_concat, dialect)
            df_concat = pd.read_sql_query(stmt4_concat, conn, self._pk_tmp_col_label)
            df_concat = self._concat.update_df(df_concat, dialect)
        assert df is not None or df_concat is not None
        if df is None:
            df = df_concat
        elif df_concat is not None:
            df = _outer_join(df, df_concat)
        assert df is not None and self._pk_tmp_col_label not in df.columns
        df = df.rename(self._remove_tmp_suffix, axis=1)
        if self._explode:
            df = self._explode.update_df(df, dialect)
        else:
            df = df.set_index(self._index.key)
        df = df.rename(_ALIASES, axis=1, errors="ignore")
        df = df.rename(self._rename, axis=1, errors="ignore")
        return df

    def to_dict(self) -> dict[str, Any]:
        return {
            **(
                {"select": {name: proj.to_dict() for name, proj in self._select.items()}}
                if self._select
                else {}
            ),
            **({"filter": self._filter.to_dict()} if self._filter else {}),
            **({"explode": self._explode.to_dict()} if self._explode else {}),
            **({"concat": self._concat.to_dict()} if self._concat else {}),
            **({"rename": dict(self._rename)} if self._rename else {}),
            "index": self._index.to_dict(),
        }

    @classmethod
    def from_dict(
        cls,
        obj: Mapping[str, Any],
        valid_eval_names: Optional[Sequence[str]] = None,
    ) -> "SpanQuery":
        return cls(
            **(
                {
                    "_select": MappingProxyType(
                        {
                            name: Projection.from_dict(proj)
                            for name, proj in cast(Mapping[str, Any], select).items()
                        }
                    )
                }  # type: ignore
                if (select := obj.get("select"))
                else {}
            ),
            **(
                {
                    "_filter": SpanFilter.from_dict(
                        cast(Mapping[str, Any], filter),
                        valid_eval_names=valid_eval_names,
                    )
                }  # type: ignore
                if (filter := obj.get("filter"))
                else {}
            ),
            **(
                {"_explode": Explosion.from_dict(cast(Mapping[str, Any], explode))}  # type: ignore
                if (explode := obj.get("explode"))
                and explode.get("key")  # check `key` for backward-compatible truthiness
                else {}
            ),
            **(
                {"_concat": Concatenation.from_dict(cast(Mapping[str, Any], concat))}  # type: ignore
                if (concat := obj.get("concat"))
                and concat.get("key")  # check `key` for backward-compatible truthiness
                else {}
            ),
            **(
                {"_rename": MappingProxyType(dict(cast(Mapping[str, str], rename)))}  # type: ignore
                if (rename := obj.get("rename"))
                else {}
            ),
            **(
                {"_index": Projection.from_dict(cast(Mapping[str, Any], index))}  # type: ignore
                if (index := obj.get("index"))
                else {}
            ),
        )


def _get_spans_dataframe(
    session: Session,
    project_name: str,
    /,
    *,
    span_filter: Optional[SpanFilter] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: Optional[int] = DEFAULT_SPAN_LIMIT,
    root_spans_only: Optional[bool] = None,
    orphan_span_as_root_span: bool = True,
    # Deprecated
    stop_time: Optional[datetime] = None,
) -> pd.DataFrame:
    """Retrieve spans from the database and return them as a pandas DataFrame.

    This function queries the database for spans matching the specified criteria and returns
    them as a pandas DataFrame. The spans are joined with their associated traces and projects,
    and their attributes are flattened into columns.

    Args:
        session (Session): The SQLAlchemy database session to use for the query.
        project_name (str): The name of the project to query spans for.
        span_filter (SpanFilter, optional): A filter to apply to the spans query. Default None.
        start_time (datetime, optional): The start time for the query range. Default None.
        end_time (datetime, optional): The end time for the query range. Default None.
        limit (int, optional): Maximum number of spans to return. Defaults to DEFAULT_SPAN_LIMIT.
        root_spans_only (bool, optional): If True, only root spans are returned. Default None.
        orphan_span_as_root_span (bool): If True, orphan spans are treated as root spans. An
            orphan span has a non-null `parent_id` but a span with that ID is currently not
            found in the database. Default True.
        stop_time (datetime, optional): Deprecated. Use end_time instead. Default None.

    Returns:
        pd.DataFrame: A DataFrame containing the spans data with the following columns:
            - name: The span name
            - span_kind: The kind of span
            - parent_id: The ID of the parent span
            - start_time: When the span started
            - end_time: When the span ended
            - status_code: The status code of the span
            - status_message: The status message of the span
            - events: The events associated with the span
            - context.span_id: The span ID
            - context.trace_id: The trace ID
            - attributes.*: Flattened span attributes

    Note:
        The function flattens semantic conventions in the span attributes and adds them as
        prefixed columns to the DataFrame. Custom attributes are preserved as is.
    """  # noqa: E501
    # use legacy labels for backward-compatibility
    span_id_label = "context.span_id"
    trace_id_label = "context.trace_id"
    if stop_time:
        # Deprecated. Raise a warning
        warnings.warn(
            "stop_time is deprecated. Use end_time instead.",
            DeprecationWarning,
        )
        end_time = end_time or stop_time
    stmt: Select[Any] = (
        select(
            models.Span.name,
            models.Span.span_kind,
            models.Span.parent_id,
            models.Span.start_time,
            models.Span.end_time,
            models.Span.status_code,
            models.Span.status_message,
            models.Span.events,
            models.Span.span_id.label(span_id_label),
            models.Trace.trace_id.label(trace_id_label),
            models.Span.attributes,
        )
        .join(models.Trace)
        .join(models.Project)
        .where(models.Project.name == project_name)
    )
    if span_filter:
        stmt = span_filter(stmt)
    if start_time:
        stmt = stmt.where(start_time <= models.Span.start_time)
    if end_time:
        stmt = stmt.where(models.Span.start_time < end_time)
    if root_spans_only:
        # A root span is either a span with no parent_id or an orphan span
        # (a span whose parent_id references a span that doesn't exist in the database)
        if orphan_span_as_root_span:
            # Include both types of root spans
            parent_spans = select(models.Span.span_id).alias("parent_spans")
            candidate_spans = stmt.cte("candidate_spans")
            stmt = select(candidate_spans).where(
                or_(
                    candidate_spans.c.parent_id.is_(None),
                    ~select(1)
                    .where(candidate_spans.c.parent_id == parent_spans.c.span_id)
                    .exists(),
                ),
            )
        else:
            # Only include explicit root spans (spans with parent_id = NULL)
            stmt = stmt.where(models.Span.parent_id.is_(None))
    if limit is not None:
        stmt = stmt.limit(limit)
    conn = session.connection()
    # set `drop=False` for backward-compatibility
    df = pd.read_sql_query(stmt, conn).set_index(span_id_label, drop=False)
    if df.empty:
        return df.drop("attributes", axis=1)
    df_attributes = pd.DataFrame.from_records(
        df.attributes.map(_flatten_semantic_conventions),
    ).set_axis(df.index, axis=0)
    df = pd.concat(
        [
            df.drop("attributes", axis=1),
            df_attributes.add_prefix("attributes" + "."),
        ],
        axis=1,
    )
    return df


def _outer_join(left: pd.DataFrame, right: pd.DataFrame) -> pd.DataFrame:
    if (columns_intersection := left.columns.intersection(right.columns)).empty:
        df = left.join(right, how="outer")
    else:
        df = left.join(right, how="outer", lsuffix="_L", rsuffix="_R")
        for col in columns_intersection:
            df.loc[:, col] = df.loc[:, f"{col}_L"].fillna(df.loc[:, f"{col}_R"])
            df = df.drop([f"{col}_L", f"{col}_R"], axis=1)
    return df


def _flatten_semantic_conventions(attributes: Mapping[str, Any]) -> dict[str, Any]:
    # This may be inefficient, but is needed to preserve backward-compatibility.
    # For example, custom attributes do not get flattened.
    ans = unflatten(
        load_json_strings(
            flatten(
                attributes,
                recurse_on_sequence=True,
                json_string_attributes=JSON_STRING_ATTRIBUTES,
            ),
        ),
        prefix_exclusions=SEMANTIC_CONVENTIONS,
    )
    return ans


def _randomize(name: str = "") -> str:
    """Append a short random suffix for a column name to avoid name collisions. The suffix
    should be short because PostgreSQL has a limit of 63 characters for column names.
    """  # noqa: E501
    return f"{name}_{token_hex(3)}"
