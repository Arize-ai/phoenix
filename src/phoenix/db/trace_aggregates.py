"""Single source for per-trace aggregate SQL."""

from collections.abc import Collection
from dataclasses import dataclass
from typing import Any, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.sql.elements import KeyedColumnElement
from sqlalchemy.sql.expression import ColumnElement, Select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models

TRACE_ROWID = "trace_rowid"
SPAN_ROWID = "span_rowid"
VALUE = "value"
_ROOT_SPAN_RANK = "rank"

__all__ = [
    "TRACE_ROWID",
    "SPAN_ROWID",
    "TraceAggregate",
    "cost_summary_by_trace",
    "error_count_by_trace",
    "num_spans_by_trace",
    "representative_root_span_by_trace",
    "span_kind_count_by_trace",
    "token_counts_by_trace",
]


@dataclass(frozen=True)
class TraceAggregate:
    """A per-trace aggregate adaptable to grouped and correlated SQL shapes."""

    group_key: Any
    values: tuple[KeyedColumnElement[Any], ...]
    source: Any
    joins: tuple[Any, ...] = ()
    where: tuple[ColumnElement[bool], ...] = ()

    def _base(self, columns: tuple[Any, ...]) -> Select[Any]:
        stmt = select(*columns).select_from(self.source)
        for target in self.joins:
            stmt = stmt.join(target)
        if self.where:
            stmt = stmt.where(*self.where)
        return stmt

    def as_grouped_subquery(
        self,
        keys: Optional[Collection[int]] = None,
        project_rowids: Optional[Collection[int]] = None,
        start_time: Optional[Any] = None,
        end_time: Optional[Any] = None,
        values: Optional[Collection[str]] = None,
    ) -> Select[Any]:
        """Return one aggregate row per trace, keyed by ``trace_rowid``."""
        projected = self.values if values is None else tuple(self._value(name) for name in values)
        stmt = self._base((self.group_key.label(TRACE_ROWID), *projected))
        if keys is not None:
            stmt = stmt.where(self.group_key.in_(keys))
        stmt = _apply_scope(stmt, self.group_key, project_rowids, start_time, end_time)
        return stmt.group_by(self.group_key)

    def as_correlated_scalar(
        self,
        trace_col: Any,
        value: Optional[str] = None,
        project_rowids: Optional[Collection[int]] = None,
        start_time: Optional[Any] = None,
        end_time: Optional[Any] = None,
    ) -> ScalarSelect[Any]:
        """Return one aggregate value correlated to ``trace_col``."""
        column = self.values[0] if value is None else self._value(value)
        stmt = self._base((column,)).where(self.group_key == trace_col)
        stmt = _apply_scope(stmt, self.group_key, project_rowids, start_time, end_time)
        return stmt.scalar_subquery()

    def _value(self, name: str) -> KeyedColumnElement[Any]:
        for column in self.values:
            if column.name == name:
                return column
        raise KeyError(f"{name!r} is not a value of this aggregate")


def num_spans_by_trace() -> TraceAggregate:
    """Number of spans per trace, exposed as ``num_spans``."""
    return TraceAggregate(
        group_key=models.Span.trace_rowid,
        values=(func.count(models.Span.id).label("num_spans"),),
        source=models.Span,
    )


def error_count_by_trace() -> TraceAggregate:
    """Number of explicitly errored spans per trace, exposed as ``error_count``."""
    return TraceAggregate(
        group_key=models.Span.trace_rowid,
        values=(func.count(models.Span.id).label("error_count"),),
        source=models.Span,
        where=(models.Span.status_code == "ERROR",),
    )


def token_counts_by_trace() -> TraceAggregate:
    """Leaf LLM token totals per trace, exposed as prompt, completion, and total."""
    return TraceAggregate(
        group_key=models.Span.trace_rowid,
        values=(
            func.sum(func.coalesce(models.Span.llm_token_count_prompt, 0)).label("prompt"),
            func.sum(func.coalesce(models.Span.llm_token_count_completion, 0)).label("completion"),
            func.sum(models.Span.llm_token_count_total).label("total"),
        ),
        source=models.Span,
        where=(func.upper(models.Span.span_kind) == "LLM",),
    )


def cost_summary_by_trace() -> TraceAggregate:
    """Span-cost totals per trace."""
    return TraceAggregate(
        group_key=models.SpanCost.trace_rowid,
        values=(
            func.coalesce(func.sum(models.SpanCost.prompt_cost), 0).label("prompt_cost"),
            func.coalesce(func.sum(models.SpanCost.completion_cost), 0).label("completion_cost"),
            func.coalesce(func.sum(models.SpanCost.total_cost), 0).label("total_cost"),
        ),
        source=models.SpanCost,
    )


def span_kind_count_by_trace(span_kind: str) -> TraceAggregate:
    """Number of spans of ``span_kind`` per trace, exposed as ``span_kind_count``."""
    return TraceAggregate(
        group_key=models.Span.trace_rowid,
        values=(func.count(models.Span.id).label("span_kind_count"),),
        source=models.Span,
        where=(func.upper(models.Span.span_kind) == span_kind.upper(),),
    )


def representative_root_span_by_trace(
    keys: Optional[Any] = None,
    project_rowids: Optional[Collection[int]] = None,
    start_time: Optional[Any] = None,
    end_time: Optional[Any] = None,
    orphan_span_as_root_span: bool = True,
) -> Select[Any]:
    """Select the displayed representative root span for each trace."""
    parent_spans = models.Span.__table__.alias("parent_spans")
    root_predicate: ColumnElement[bool] = models.Span.parent_id.is_(None)
    if orphan_span_as_root_span:
        root_predicate = or_(
            root_predicate,
            ~select(1)
            .select_from(parent_spans)
            .where(
                models.Span.parent_id == parent_spans.c.span_id,
                models.Span.trace_rowid == parent_spans.c.trace_rowid,
            )
            .exists(),
        )
    ranked = select(
        models.Span.trace_rowid.label(TRACE_ROWID),
        models.Span.id.label(SPAN_ROWID),
        func.row_number()
        .over(
            partition_by=models.Span.trace_rowid,
            order_by=(models.Span.start_time.asc(), models.Span.id.desc()),
        )
        .label(_ROOT_SPAN_RANK),
    ).where(root_predicate)
    if keys is not None:
        ranked = ranked.where(models.Span.trace_rowid.in_(keys))
    ranked = _apply_scope(ranked, models.Span.trace_rowid, project_rowids, start_time, end_time)
    ranked_subquery = ranked.subquery()
    return select(
        ranked_subquery.c[TRACE_ROWID],
        ranked_subquery.c[SPAN_ROWID],
    ).where(ranked_subquery.c[_ROOT_SPAN_RANK] == 1)


def _apply_scope(
    stmt: Select[Any],
    trace_key: Any,
    project_rowids: Optional[Collection[int]],
    start_time: Optional[Any],
    end_time: Optional[Any],
) -> Select[Any]:
    if project_rowids is None and start_time is None and end_time is None:
        return stmt
    trace_scope = models.Trace.__table__.alias("trace_scope")
    stmt = stmt.join(trace_scope, trace_scope.c.id == trace_key)
    if project_rowids is not None:
        stmt = stmt.where(trace_scope.c.project_rowid.in_(project_rowids))
    if start_time is not None:
        stmt = stmt.where(trace_scope.c.start_time >= start_time)
    if end_time is not None:
        stmt = stmt.where(trace_scope.c.start_time < end_time)
    return stmt
