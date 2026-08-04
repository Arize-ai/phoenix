"""Single source for per-session aggregate SQL.

Every session metric (``num_traces``, token totals, cost, tool/LLM span-kind counts) is a
grain-shift aggregation over ``Trace.project_session_rowid``, defined once here and consumed by
session sorting, the display dataloaders, and the session filter DSL.
"""

from collections.abc import Collection, Sequence
from dataclasses import dataclass
from typing import Any, Literal, Optional

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import distinct, func, select
from sqlalchemy.sql.elements import KeyedColumnElement
from sqlalchemy.sql.expression import ColumnElement, Select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models

SESSION_ROWID = "project_session_rowid"
SPAN_ROWID = "span_rowid"
VALUE = "value"
_ROOT_SPAN_RANK = "rank"

_GROUP_KEY = models.Trace.project_session_rowid

__all__ = [
    "SESSION_ROWID",
    "SPAN_ROWID",
    "SessionAggregate",
    "apply_session_scope",
    "num_traces_by_session",
    "num_traces_with_error_by_session",
    "token_counts_by_session",
    "cost_summary_by_session",
    "span_kind_count_by_session",
    "earliest_root_span_by_session",
    "root_span_io_value_by_session",
    "root_span_attribute_case_insensitive_contains_by_session",
]

RootSpanIOKind = Literal["first_input", "last_output"]


@dataclass(frozen=True)
class SessionAggregate:
    """A per-session aggregate defined once, adaptable to two SQL shapes."""

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
        """One GROUP BY scan yielding a row per session, keyed ``project_session_rowid``.

        ``values`` names the value columns to project; it defaults to all of them.
        """
        projected = self.values if values is None else tuple(self._value(name) for name in values)
        stmt = self._base((_GROUP_KEY.label(SESSION_ROWID), *projected))
        if keys is not None:
            stmt = stmt.where(_GROUP_KEY.in_(keys))
        stmt = _apply_scope(stmt, project_rowids, start_time, end_time)
        return stmt.group_by(_GROUP_KEY)

    def as_correlated_scalar(
        self,
        session_col: Any,
        value: Optional[str] = None,
        project_rowids: Optional[Collection[int]] = None,
        start_time: Optional[Any] = None,
        end_time: Optional[Any] = None,
    ) -> ScalarSelect[Any]:
        """The aggregate for a single session as a correlated scalar subquery.

        ``value`` names the labeled value column to return; it defaults to the first.
        """
        column = self.values[0] if value is None else self._value(value)
        stmt = self._base((column,)).where(_GROUP_KEY == session_col)
        stmt = _apply_scope(stmt, project_rowids, start_time, end_time)
        return stmt.scalar_subquery()

    def _value(self, name: str) -> KeyedColumnElement[Any]:
        for column in self.values:
            if column.name == name:
                return column
        raise KeyError(f"{name!r} is not a value of this aggregate")


def num_traces_by_session() -> SessionAggregate:
    """Number of traces per session — value column ``num_traces``."""
    return SessionAggregate(
        values=(func.count(models.Trace.id).label("num_traces"),),
        source=models.Trace,
    )


def num_traces_with_error_by_session() -> SessionAggregate:
    """Number of traces containing an errored span per session — value column
    ``num_traces_with_error``."""
    return SessionAggregate(
        values=(func.count(distinct(models.Trace.id)).label("num_traces_with_error"),),
        source=models.Trace,
        joins=(models.Span,),
        where=(models.Span.cumulative_error_count > 0,),
    )


def token_counts_by_session() -> SessionAggregate:
    """LLM token totals per session — value columns ``prompt``, ``completion``, ``total``.

    Sums the per-span token counts of every ``LLM`` span rather than root-span cumulative counts,
    which multi-count tokens when a framework propagates LLM token attributes up through wrapping
    agent/tool spans (#12768).
    """
    return SessionAggregate(
        values=(
            func.sum(func.coalesce(models.Span.llm_token_count_prompt, 0)).label("prompt"),
            func.sum(func.coalesce(models.Span.llm_token_count_completion, 0)).label("completion"),
            func.sum(models.Span.llm_token_count_total).label("total"),
        ),
        source=models.Span,
        joins=(models.Trace,),
        where=(models.Span.span_kind == "LLM",),
    )


def cost_summary_by_session() -> SessionAggregate:
    """Span-cost totals per session — value columns ``prompt_cost``, ``completion_cost``,
    ``total_cost``, ``prompt_tokens``, ``completion_tokens``, ``total_tokens``."""
    return SessionAggregate(
        values=(
            func.coalesce(func.sum(models.SpanCost.prompt_cost), 0).label("prompt_cost"),
            func.coalesce(func.sum(models.SpanCost.completion_cost), 0).label("completion_cost"),
            func.coalesce(func.sum(models.SpanCost.total_cost), 0).label("total_cost"),
            func.coalesce(func.sum(models.SpanCost.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(models.SpanCost.completion_tokens), 0).label(
                "completion_tokens"
            ),
            func.coalesce(func.sum(models.SpanCost.total_tokens), 0).label("total_tokens"),
        ),
        source=models.SpanCost,
        joins=(models.Trace,),
    )


def span_kind_count_by_session(span_kind: str) -> SessionAggregate:
    """Number of spans of a given kind per session — value column ``span_kind_count``."""
    return SessionAggregate(
        values=(func.count(models.Span.id).label("span_kind_count"),),
        source=models.Span,
        joins=(models.Trace,),
        where=(models.Span.span_kind == span_kind.upper(),),
    )


def root_span_attribute_case_insensitive_contains_by_session(
    attribute_path: tuple[str, ...],
    substring: Any,
    session_col: Any,
    keys: Optional[Collection[int]] = None,
    project_rowids: Optional[Collection[int]] = None,
    start_time: Optional[Any] = None,
    end_time: Optional[Any] = None,
) -> ColumnElement[bool]:
    """Whether any root span in a session contains ``substring``, ignoring case, at
    ``attribute_path``."""
    stmt = (
        select(models.Span.id)
        .join_from(models.Span, models.Trace)
        .where(_GROUP_KEY == session_col)
        .where(models.Span.parent_id.is_(None))
        .where(
            models.CaseInsensitiveContains(
                models.Span.attributes[list(attribute_path)].as_string(),
                substring,
            )
        )
    )
    if keys is not None:
        stmt = stmt.where(_GROUP_KEY.in_(keys))
    stmt = _apply_scope(stmt, project_rowids, start_time, end_time)
    return stmt.exists()


def apply_session_scope(
    stmt: Select[Any],
    session_key: Any,
    project_key: Optional[Any] = None,
    keys: Optional[Collection[int]] = None,
    project_rowids: Optional[Collection[int]] = None,
    start_time: Optional[Any] = None,
    end_time: Optional[Any] = None,
) -> Select[Any]:
    """Restrict a per-session query to a candidate set, a project set, and a time window.

    ``session_key`` is the column identifying the session a row belongs to, and ``project_key``
    the column carrying its project; the latter is optional because a table keyed directly on the
    session (annotations) reaches no project column of its own.
    """
    if keys is not None:
        stmt = stmt.where(session_key.in_(keys))
    if project_rowids is not None and project_key is not None:
        stmt = stmt.where(project_key.in_(project_rowids))
    if start_time is None and end_time is None:
        return stmt
    session_scope = models.ProjectSession.__table__.alias("session_scope")
    stmt = stmt.join(session_scope, session_scope.c.id == session_key)
    # Interval-overlap time scoping, matching the session filter's candidate universe.
    if start_time is not None:
        stmt = stmt.where(start_time <= session_scope.c.end_time)
    if end_time is not None:
        stmt = stmt.where(session_scope.c.start_time < end_time)
    return stmt


def _apply_scope(
    stmt: Select[Any],
    project_rowids: Optional[Collection[int]],
    start_time: Optional[Any],
    end_time: Optional[Any],
) -> Select[Any]:
    return apply_session_scope(
        stmt,
        _GROUP_KEY,
        project_key=models.Trace.project_rowid,
        project_rowids=project_rowids,
        start_time=start_time,
        end_time=end_time,
    )


def earliest_root_span_by_session(
    keys: Optional[Collection[int]] = None,
    project_rowids: Optional[Collection[int]] = None,
    start_time: Optional[Any] = None,
    end_time: Optional[Any] = None,
) -> Select[Any]:
    """Select ``(project_session_rowid, span_rowid)`` of each session's earliest root span."""
    subquery = _ranked_root_span_values_by_session(
        models.Span.id.label(SPAN_ROWID),
        # Span.id tie-break keeps this in lockstep with SessionIODataLoader's root-span window.
        order_by=[models.Trace.start_time.asc(), models.Trace.id.asc(), models.Span.id.asc()],
        keys=keys,
        project_rowids=project_rowids,
        start_time=start_time,
        end_time=end_time,
    ).subquery()
    return select(subquery.c[SESSION_ROWID], subquery.c[SPAN_ROWID]).where(
        subquery.c[_ROOT_SPAN_RANK] == 1
    )


def root_span_io_value_by_session(
    kind: RootSpanIOKind,
    keys: Optional[Collection[int]] = None,
    project_rowids: Optional[Collection[int]] = None,
    start_time: Optional[Any] = None,
    end_time: Optional[Any] = None,
) -> Select[Any]:
    """Select ``(project_session_rowid, value)`` for first input or last output.

    The window shape matches
    :class:`~phoenix.server.api.dataloaders.session_io.SessionIODataLoader`.
    """
    if kind == "first_input":
        attribute_path = SpanAttributes.INPUT_VALUE.split(".")
        order_by = [models.Trace.start_time.asc(), models.Trace.id.asc(), models.Span.id.asc()]
    elif kind == "last_output":
        attribute_path = SpanAttributes.OUTPUT_VALUE.split(".")
        order_by = [models.Trace.start_time.desc(), models.Trace.id.desc(), models.Span.id.desc()]
    else:
        raise ValueError(f"Unknown root span IO kind: {kind}")

    subquery = _ranked_root_span_values_by_session(
        models.Span.attributes[attribute_path].as_string().label(VALUE),
        order_by=order_by,
        keys=keys,
        project_rowids=project_rowids,
        start_time=start_time,
        end_time=end_time,
    ).subquery()
    return select(subquery.c[SESSION_ROWID], subquery.c[VALUE]).where(
        subquery.c[_ROOT_SPAN_RANK] == 1
    )


def _ranked_root_span_values_by_session(
    value: KeyedColumnElement[Any],
    *,
    order_by: Sequence[Any],
    keys: Optional[Collection[int]],
    project_rowids: Optional[Collection[int]],
    start_time: Optional[Any],
    end_time: Optional[Any],
) -> Select[Any]:
    ranked = (
        select(
            _GROUP_KEY.label(SESSION_ROWID),
            value,
            func.row_number()
            .over(
                partition_by=_GROUP_KEY,
                order_by=order_by,
            )
            .label(_ROOT_SPAN_RANK),
        )
        .join_from(models.Span, models.Trace)
        .where(models.Span.parent_id.is_(None))
    )
    if keys is not None:
        ranked = ranked.where(_GROUP_KEY.in_(keys))
    return _apply_scope(ranked, project_rowids, start_time, end_time)
