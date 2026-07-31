"""Single source for per-trace aggregate SQL."""

from collections.abc import Collection
from dataclasses import dataclass
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.sql.elements import KeyedColumnElement
from sqlalchemy.sql.expression import ColumnElement, Select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models

TRACE_ROWID = "trace_rowid"
VALUE = "value"

__all__ = [
    "TRACE_ROWID",
    "TraceAggregate",
    "cost_summary_by_trace",
    "error_count_by_trace",
    "num_spans_by_trace",
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
        values: Optional[Collection[str]] = None,
    ) -> Select[Any]:
        """Return one aggregate row per trace, keyed by ``trace_rowid``."""
        projected = self.values if values is None else tuple(self._value(name) for name in values)
        stmt = self._base((self.group_key.label(TRACE_ROWID), *projected))
        if keys is not None:
            stmt = stmt.where(self.group_key.in_(keys))
        return stmt.group_by(self.group_key)

    def as_correlated_scalar(
        self,
        trace_col: Any,
        value: Optional[str] = None,
    ) -> ScalarSelect[Any]:
        """Return one aggregate value correlated to ``trace_col``."""
        column = self.values[0] if value is None else self._value(value)
        return self._base((column,)).where(self.group_key == trace_col).scalar_subquery()

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
        where=(func.upper(models.Span.status_code) == "ERROR",),
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
