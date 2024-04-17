from collections import defaultdict
from dataclasses import dataclass, field, replace
from datetime import datetime
from functools import cached_property
from itertools import chain
from random import randint, random
from types import MappingProxyType
from typing import (
    Any,
    DefaultDict,
    Dict,
    List,
    Mapping,
    Optional,
    Sequence,
    cast,
)

import pandas as pd
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import JSON, Column, Select, and_, func, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import Session, aliased

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.trace.dsl import SpanFilter
from phoenix.trace.dsl.filter import _NAMES, SupportsGetSpanEvaluation
from phoenix.trace.schemas import ATTRIBUTE_PREFIX
from phoenix.utilities.attributes import (
    JSON_STRING_ATTRIBUTES,
    SEMANTIC_CONVENTIONS,
    flatten,
    get_attribute_value,
    load_json_strings,
    unflatten,
)

# supported dialects
_SQLITE = "sqlite"
_POSTGRESQL = "postgresql"

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

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "key", _unalias(self.key))

    def __bool__(self) -> bool:
        return bool(self.key)

    def to_dict(self) -> Dict[str, Any]:
        return {"key": self.key}

    @classmethod
    def from_dict(cls, obj: Mapping[str, Any]) -> "Projection":
        return cls(
            **({"key": cast(str, key)} if (key := obj.get("key")) else {}),
        )


@dataclass(frozen=True)
class _HasTmpSuffix(_Base):
    _tmp_suffix: str = field(init=False, repr=False)
    """Ideally every column name should get a temporary random suffix that will
    be removed at the end. This is necessary during query construction because
    sqlalchemy is not always foolproof, so we should actively avoid name
    collisions, which is increasingly likely as queries get more complex. The
    suffix is randomized per instance.
    """

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "_tmp_suffix", f"{randint(0, 10**6):06d}")

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
        object.__setattr__(self, "_array_tmp_col_label", f"__array_tmp_col_{random()}")

    @cached_property
    def index_keys(self) -> List[str]:
        return [self._primary_index.key, f"{self._position_prefix}position"]

    def with_primary_index_key(self, _: str) -> "Explosion":
        print("`.with_primary_index_key(...)` is deprecated and wil be removed in the future.")
        return self

    def update_sql(self, sql: Select[Any], dialect: str) -> Select[Any]:
        array = models.Span.attributes[self.key.split(".")]
        if dialect == _SQLITE:
            # Because sqlite doesn't support `WITH ORDINALITY`, the order of
            # the returned (table) values is not guaranteed. So we resort to
            # post hoc processing using pandas.
            return sql.where(
                func.json_type(array) == "array",
            ).add_columns(
                array.label(self._array_tmp_col_label),
            )
        elif dialect == _POSTGRESQL:
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
            return sql.where(
                and_(
                    func.jsonb_typeof(array) == "array",
                    func.jsonb_typeof(obj) == "object",
                )
            ).add_columns(
                # Use zero-based indexing for backward-compatibility.
                (position - 1).label(f"{self._position_prefix}position"),
                *(
                    (
                        obj[key.split(".")].label(self._add_tmp_suffix(name))
                        for name, key in self.kwargs.items()
                    )
                    if self.kwargs
                    else (obj.label(self._array_tmp_col_label),)
                ),
            )
        raise NotImplementedError(f"Unsupported dialect: {dialect}")

    def update_df(self, df: pd.DataFrame, dialect: str) -> pd.DataFrame:
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
            return pd.DataFrame(columns=columns).set_index(self.index_keys)
        if dialect == _POSTGRESQL and not self.kwargs:
            records = df.loc[:, self._array_tmp_col_label].map(flatten).map(dict).dropna()
            return pd.concat(
                [
                    df.drop(self._array_tmp_col_label, axis=1),
                    pd.DataFrame.from_records(records.to_list(), index=records.index),
                ],
                axis=1,
            ).set_index(self.index_keys)
        if dialect == _SQLITE:
            # Because sqlite doesn't support `WITH ORDINALITY`, the order of
            # the returned (table) values is not guaranteed. So we resort to
            # post hoc processing using pandas.
            def _extract_values(array: List[Any]) -> List[Dict[str, Any]]:
                if not self.kwargs:
                    return [
                        {
                            **dict(flatten(obj)),
                            f"{self._position_prefix}position": i,
                        }
                        for i, obj in enumerate(array)
                        if isinstance(obj, Mapping)
                    ]
                res: List[Dict[str, Any]] = []
                for i, obj in enumerate(array):
                    if not isinstance(obj, Mapping):
                        continue
                    values: Dict[str, Any] = {f"{self._position_prefix}position": i}
                    for name, key in self.kwargs.items():
                        if (value := get_attribute_value(obj, key)) is not None:
                            values[name] = value
                    res.append(values)
                return res

            records = df.loc[:, self._array_tmp_col_label].map(_extract_values).explode().dropna()
            df_explode = pd.DataFrame.from_records(records.to_list(), index=records.index)
            return (
                df.drop(self._array_tmp_col_label, axis=1)
                .join(df_explode, how="outer")
                .set_index(self.index_keys)
            )
        return df.set_index(self.index_keys)

    def to_dict(self) -> Dict[str, Any]:
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
    """For sqlite we need to store the array in a temporary column to be able
    to concatenate it later in pandas. `_array_tmp_col_label` is the name of
    this temporary column. The temporary column will have a unique name
    per instance.
    """

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "_array_tmp_col_label", f"__array_tmp_col_{random()}")

    def with_separator(self, separator: str = "\n\n") -> "Concatenation":
        return replace(self, separator=separator)

    def update_sql(self, stmt: Select[Any], dialect: str) -> Select[Any]:
        array = models.Span.attributes[self.key.split(".")]
        if dialect == _SQLITE:
            # Because sqlite doesn't support WITH ORDINALITY, the order of
            # the returned (table) values is not guaranteed. So we resort to
            # post-processing using pandas.
            return stmt.where(
                func.json_type(array) == "array",
            ).add_columns(
                array.label(self._array_tmp_col_label),
            )
        if dialect == _POSTGRESQL:
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
            return (
                stmt.where(
                    and_(
                        func.jsonb_typeof(array) == "array",
                        *((func.jsonb_typeof(obj) == "object",) if self.kwargs else ()),
                    )
                )
                .add_columns(
                    *(
                        (
                            func.string_agg(
                                obj[key.split(".")].as_string(),
                                aggregate_order_by(self.separator, position),  # type: ignore
                            ).label(self._add_tmp_suffix(name))
                            for name, key in self.kwargs.items()
                        )
                        if self.kwargs
                        else (
                            func.string_agg(
                                obj,
                                aggregate_order_by(self.separator, position),  # type: ignore
                            ).label(self.key),
                        )
                    ),
                )
                .group_by(*stmt.columns.keys())
            )
        raise NotImplementedError(f"Unsupported dialect: {dialect}")

    def update_df(self, df: pd.DataFrame, dialect: str) -> pd.DataFrame:
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
        if dialect == _SQLITE:
            # Because sqlite doesn't support WITH ORDINALITY, the order of
            # the returned (table) values is not guaranteed. So we resort to
            # post-processing using pandas.
            def _concat_values(array: List[Any]) -> Dict[str, Any]:
                if not self.kwargs:
                    return {self.key: self.separator.join(str(obj) for obj in array)}
                values: DefaultDict[str, List[str]] = defaultdict(list)
                for i, obj in enumerate(array):
                    if not isinstance(obj, Mapping):
                        continue
                    for name, key in self.kwargs.items():
                        if (value := get_attribute_value(obj, key)) is not None:
                            values[name].append(str(value))
                return {k: self.separator.join(v) for k, v in values.items()}

            records = df.loc[:, self._array_tmp_col_label].map(_concat_values)
            df_concat = pd.DataFrame.from_records(records.to_list(), index=records.index)
            return df.drop(self._array_tmp_col_label, axis=1).join(df_concat, how="outer")
        return df

    def to_dict(self) -> Dict[str, Any]:
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
    _concat: Concatenation = field(default_factory=Concatenation)
    _explode: Explosion = field(default_factory=Explosion)
    _filter: SpanFilter = field(default_factory=SpanFilter)
    _rename: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    _index: Projection = field(default_factory=lambda: Projection("context.span_id"))

    _pk_tmp_col_label: str = field(init=False, repr=False)
    """We use `_pk_tmp_col_label` as a temporary column for storing
    the row id, i.e. the primary key, of the spans table. This will help
    us with joins without the risk of naming conflicts. The temporary
    column will have a unique name per instance.
    """

    def __post_init__(self) -> None:
        super().__post_init__()
        object.__setattr__(self, "_pk_tmp_col_label", f"__pk_tmp_col_{random()}")

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
        _explode = Explosion(key=key, kwargs=kwargs, primary_index_key=self._index.key)
        return replace(self, _explode=_explode)

    def concat(self, key: str, **kwargs: str) -> "SpanQuery":
        _concat = Concatenation(key=key, kwargs=kwargs, separator=self._concat.separator)
        return replace(self, _concat=_concat)

    def rename(self, **kwargs: str) -> "SpanQuery":
        _rename = MappingProxyType(kwargs)
        return replace(self, _rename=_rename)

    def with_index(self, key: str = "context.span_id") -> "SpanQuery":
        _index = Projection(key=key)
        return replace(self, _index=_index, _explode=replace(self._explode, primary_index_key=key))

    def with_concat_separator(self, separator: str = "\n\n") -> "SpanQuery":
        _concat = self._concat.with_separator(separator)
        return replace(self, _concat=_concat)

    def with_explode_primary_index_key(self, _: str) -> "SpanQuery":
        print(
            "`.with_explode_primary_index_key(...)` is deprecated and wil be "
            "removed in the future. Use `.with_index(...)` instead."
        )
        return self

    def __call__(
        self,
        session: Session,
        project_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        stop_time: Optional[datetime] = None,
        root_spans_only: Optional[bool] = None,
    ) -> pd.DataFrame:
        if not project_name:
            project_name = DEFAULT_PROJECT_NAME
        if not (self._select or self._explode or self._concat):
            return _get_spans_dataframe(
                session,
                self._filter,
                project_name,
                start_time,
                stop_time,
                root_spans_only,
            )
        assert session.bind is not None
        dialect = session.bind.dialect.name
        conn = session.connection()
        index = _NAMES[self._index.key].label(self._add_tmp_suffix(self._index.key))
        row_id = models.Span.id.label(self._pk_tmp_col_label)
        stmt = (
            # We do not allow `group_by` anything other than `row_id` because otherwise
            # it's too complex for the post hoc processing step in pandas.
            select(row_id)
            .join_from(models.Span, models.Trace)
            .join(models.Project)
            .where(models.Project.name == project_name)
        )
        if start_time:
            stmt = stmt.where(start_time <= models.Span.start_time)
        if stop_time:
            stmt = stmt.where(models.Span.start_time < stop_time)
        if root_spans_only:
            parent = aliased(models.Span)
            stmt = stmt.outerjoin(
                parent,
                models.Span.parent_id == parent.span_id,
            ).where(parent.span_id == None)  # noqa E711
        stmt0_orig = stmt
        stmt1_filter = None
        if self._filter:
            stmt = stmt1_filter = self._filter(stmt)
        stmt2_select = None
        if self._select:
            stmt = stmt2_select = stmt.add_columns(
                *(
                    (
                        models.Span.attributes[proj.key.split(".")]
                        if proj.key not in _NAMES
                        else _NAMES[proj.key]
                    ).label(self._add_tmp_suffix(name))
                    for name, proj in self._select.items()
                )
            )
        stmt3_explode = None
        if self._explode:
            stmt = stmt3_explode = self._explode.update_sql(stmt, dialect)
        df: Optional[pd.DataFrame] = None
        # `concat` is separate because it has `group_by` but we can't always
        # join to it as a subquery because it may require post hoc processing
        # in pandas, so it's kept separate for simplicity.
        df_concat: Optional[pd.DataFrame] = None
        if self._explode or not self._concat:
            if index.name not in stmt.selected_columns.keys():
                stmt = stmt.add_columns(index)
            df = pd.read_sql(stmt, conn)
        if self._concat:
            if df is not None:
                # We can't include stmt3_explode because it may be trying to
                # explode the same column that we're trying to concatenate,
                # resulting in duplicates.
                stmt_no_explode = (
                    stmt2_select
                    if stmt2_select is not None
                    else (stmt1_filter if stmt1_filter is not None else stmt0_orig)
                )
                stmt4_concat = stmt_no_explode.with_only_columns(row_id)
            else:
                assert stmt3_explode is None
                stmt4_concat = (
                    stmt.add_columns(index)
                    if index.name not in stmt.selected_columns.keys()
                    else stmt
                )
            stmt4_concat = self._concat.update_sql(stmt4_concat, dialect)
            df_concat = pd.read_sql(stmt4_concat, conn)
            df_concat = self._concat.update_df(df_concat, dialect)
            assert df_concat is not None
            if df is not None:
                df_concat = df_concat.set_index(self._pk_tmp_col_label)
        assert df is not None or df_concat is not None
        if df is None:
            assert df_concat is not None
            df = df_concat.drop(self._pk_tmp_col_label, axis=1)
        elif df_concat is not None:
            df = df.set_index(self._pk_tmp_col_label)
            df = df.join(df_concat, how="inner")
        else:
            df = df.drop(self._pk_tmp_col_label, axis=1)
        df = df.rename(self._remove_tmp_suffix, axis=1)
        if self._explode:
            df = self._explode.update_df(df, dialect)
        else:
            df = df.set_index(self._index.key)
        df = df.rename(_ALIASES, axis=1, errors="ignore")
        return df.rename(self._rename, axis=1, errors="ignore")

    def to_dict(self) -> Dict[str, Any]:
        return {
            **(
                {"select": {name: proj.to_dict() for name, proj in self._select.items()}}
                if self._select
                else {}
            ),
            "filter": self._filter.to_dict(),
            "explode": self._explode.to_dict(),
            "concat": self._concat.to_dict(),
            **({"rename": dict(self._rename)} if self._rename else {}),
            "index": self._index.to_dict(),
        }

    @classmethod
    def from_dict(
        cls,
        obj: Mapping[str, Any],
        evals: Optional[SupportsGetSpanEvaluation] = None,
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
                        evals=evals,
                        valid_eval_names=valid_eval_names,
                    )
                }  # type: ignore
                if (filter := obj.get("filter"))
                else {}
            ),
            **(
                {"_explode": Explosion.from_dict(cast(Mapping[str, Any], explode))}  # type: ignore
                if (explode := obj.get("explode"))
                else {}
            ),
            **(
                {"_concat": Concatenation.from_dict(cast(Mapping[str, Any], concat))}  # type: ignore
                if (concat := obj.get("concat"))
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
    span_filter: SpanFilter,
    project_name: str,
    start_time: Optional[datetime] = None,
    stop_time: Optional[datetime] = None,
    root_spans_only: Optional[bool] = None,
) -> pd.DataFrame:
    # legacy labels for backward-compatibility
    span_id_label = "context.span_id"
    trace_id_label = "context.trace_id"
    stmt = (
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
    stmt = span_filter(stmt)
    if start_time:
        stmt = stmt.where(start_time <= models.Span.start_time)
    if stop_time:
        stmt = stmt.where(models.Span.start_time < stop_time)
    if root_spans_only:
        parent = aliased(models.Span)
        stmt = stmt.outerjoin(
            parent,
            models.Span.parent_id == parent.span_id,
        ).where(parent.span_id == None)  # noqa E711
    df = pd.read_sql(stmt, session.connection()).set_index(span_id_label, drop=False)
    if (attrs_label := "attributes") in df.columns:
        df_attributes = pd.DataFrame.from_records(
            df.attributes.map(_flatten_semantic_conventions),
        ).set_axis(df.index, axis=0)
        df = pd.concat(
            [
                df.drop(attrs_label, axis=1),
                df_attributes.add_prefix(attrs_label + "."),
            ],
            axis=1,
        )
    return df


def _flatten_semantic_conventions(attributes: Mapping[str, Any]) -> Dict[str, Any]:
    # This may be inefficient, but is needed to preserve backward-compatibility.
    # Custom attributes do not get flattened.
    return unflatten(
        load_json_strings(
            flatten(
                attributes,
                recurse_on_sequence=True,
                json_string_attributes=JSON_STRING_ATTRIBUTES,
            ),
        ),
        prefix_exclusions=SEMANTIC_CONVENTIONS,
    )
