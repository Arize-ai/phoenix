"""Single source for per-session aggregate SQL.

Every session metric (`num_traces`, token totals, cost, tool/LLM span-kind counts) is a
grain-shift aggregation over ``Trace.project_session_rowid``. Each metric is defined once
here as a :class:`SessionAggregate`, consumed by session sorting, the display dataloaders,
and the session filter DSL. Each aggregate exposes two SQL shapes:

- :meth:`SessionAggregate.as_grouped_subquery` — one GROUP BY scan yielding a row per session
  (what the sort join-backs and the display dataloaders consume, and what session-filter
  predicates LEFT JOIN against).
- :meth:`SessionAggregate.as_correlated_scalar` — the same value as a per-session correlated
  subquery.

Both accept an optional ``keys`` / ``session_col`` restriction plus project/time scope so the
aggregate can be narrowed to the resolver's session universe rather than every session.

:func:`earliest_root_span_by_session` derives the earliest root span per session, the anchor
for session-level ``user.id`` / ``metadata`` reads.
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
    "num_traces_by_session",
    "num_traces_with_error_by_session",
    "token_counts_by_session",
    "cost_summary_by_session",
    "span_kind_count_by_session",
    "earliest_root_span_by_session",
    "root_span_io_value_by_session",
    "root_span_attribute_text_contains_by_session",
]

RootSpanIOKind = Literal["first_input", "last_output"]


@dataclass(frozen=True)
class SessionAggregate:
    """A per-session aggregate defined once, adaptable to two SQL shapes.

    The group key is always ``Trace.project_session_rowid``. ``values`` are the labeled
    aggregate expressions the metric produces (one for counts, several for token/cost
    breakdowns); ``as_grouped_subquery`` prefixes them with the session rowid, ``.select_from``
    ``source`` and inner-joins ``joins`` (ON clauses inferred from foreign keys), then applies
    ``where`` and groups by the session rowid.
    """

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
    ) -> Select[Any]:
        """One GROUP BY scan yielding a row per session: ``(project_session_rowid, *values)``.

        Callers stream this directly or ``.subquery()`` it to join by session rowid. When
        ``keys`` is given the aggregate is scoped to that candidate session set. ``project_rowids``
        and time bounds scope resolver-driven filters without changing the returned shape.
        """
        stmt = self._base((_GROUP_KEY.label(SESSION_ROWID), *self.values))
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

        ``session_col`` is the outer session-rowid column to correlate on (e.g.
        ``ProjectSession.id``). ``value`` selects which labeled value column to return when the
        metric produces more than one; it defaults to the first.
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
    ``num_traces_with_error``.

    Counts distinct traces: a trace surfaces once no matter how many of its spans carry a
    positive cumulative error count.
    """
    return SessionAggregate(
        values=(func.count(distinct(models.Trace.id)).label("num_traces_with_error"),),
        source=models.Trace,
        joins=(models.Span,),
        where=(models.Span.cumulative_error_count > 0,),
    )


def token_counts_by_session() -> SessionAggregate:
    """LLM token totals per session — value columns ``prompt``, ``completion``, ``total``.

    Sums the per-span ``llm_token_count_*`` of leaf ``LLM`` spans. Summing the cumulative
    counts on root spans instead multi-counts tokens whenever a framework propagates LLM token
    attributes up through wrapping agent/tool spans (#12768). ``total`` is the canonical session
    token total; it equals ``prompt + completion`` because ``Span.llm_token_count_total`` is
    their coalesced sum.
    """
    return SessionAggregate(
        values=(
            func.sum(func.coalesce(models.Span.llm_token_count_prompt, 0)).label("prompt"),
            func.sum(func.coalesce(models.Span.llm_token_count_completion, 0)).label("completion"),
            func.sum(models.Span.llm_token_count_total).label("total"),
        ),
        source=models.Span,
        joins=(models.Trace,),
        where=(func.upper(models.Span.span_kind) == "LLM",),
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


def span_kind_count_by_session(
    span_kind: str,
    span_name: Optional[str] = None,
) -> SessionAggregate:
    """Number of spans of a given kind per session — value column ``span_kind_count``.

    ``span_kind`` is matched case-insensitively (e.g. ``"TOOL"``, ``"LLM"``). When
    ``span_name`` is given, only spans with that exact name are counted.
    """
    where = [func.upper(models.Span.span_kind) == span_kind.upper()]
    if span_name is not None:
        where.append(models.Span.name == span_name)
    return SessionAggregate(
        values=(func.count(models.Span.id).label("span_kind_count"),),
        source=models.Span,
        joins=(models.Trace,),
        where=tuple(where),
    )


def root_span_attribute_text_contains_by_session(
    attribute_path: tuple[str, ...],
    substring: Any,
    session_col: Any,
    keys: Optional[Collection[int]] = None,
    project_rowids: Optional[Collection[int]] = None,
    start_time: Optional[Any] = None,
    end_time: Optional[Any] = None,
) -> ColumnElement[bool]:
    """Whether any root span in a session contains ``substring`` at ``attribute_path``."""
    stmt = (
        select(models.Span.id)
        .join_from(models.Span, models.Trace)
        .where(_GROUP_KEY == session_col)
        .where(models.Span.parent_id.is_(None))
        .where(
            models.TextContains(
                models.Span.attributes[list(attribute_path)].as_string(),
                substring,
            )
        )
    )
    if keys is not None:
        stmt = stmt.where(_GROUP_KEY.in_(keys))
    stmt = _apply_scope(stmt, project_rowids, start_time, end_time)
    return stmt.exists()


def _apply_scope(
    stmt: Select[Any],
    project_rowids: Optional[Collection[int]],
    start_time: Optional[Any],
    end_time: Optional[Any],
) -> Select[Any]:
    if project_rowids is not None:
        stmt = stmt.where(models.Trace.project_rowid.in_(project_rowids))
    if start_time is None and end_time is None:
        return stmt
    session_scope = models.ProjectSession.__table__.alias("session_scope")
    stmt = stmt.join(session_scope, session_scope.c.id == _GROUP_KEY)
    # Interval-overlap semantics, matching the session filter's candidate
    # universe: a session qualifies iff [start_time, end_time] intersects
    # [start_time, end_time).
    if start_time is not None:
        stmt = stmt.where(start_time <= session_scope.c.end_time)
    if end_time is not None:
        stmt = stmt.where(session_scope.c.start_time < end_time)
    return stmt


def earliest_root_span_by_session(
    keys: Optional[Collection[int]] = None,
    project_rowids: Optional[Collection[int]] = None,
    start_time: Optional[Any] = None,
    end_time: Optional[Any] = None,
) -> Select[Any]:
    """Select ``(project_session_rowid, span_rowid)`` of each session's earliest root span.

    A root span has ``parent_id IS NULL``; "earliest" is the lowest ``(start_time, id)`` within
    the session — the ordering that also picks a session's first input. Callers join ``Span`` on
    ``span_rowid`` to read attributes (``user.id``, ``metadata``, ...) from that span. ``keys``,
    ``project_rowids``, and time bounds scope the derivation to the same candidate universe as the
    session filter.
    """
    subquery = _ranked_root_span_values_by_session(
        models.Span.id.label(SPAN_ROWID),
        # Span.id breaks ties when a trace has multiple root spans, so the window picks one
        # root span deterministically (matches SessionIODataLoader).
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

    ``first_input`` reads ``input.value`` from the earliest root span by
    ``(Trace.start_time ASC, Trace.id ASC)``. ``last_output`` reads ``output.value`` from the
    latest root span by ``(Trace.start_time DESC, Trace.id DESC)``. The window shape matches
    :class:`~phoenix.server.api.dataloaders.session_io.SessionIODataLoader` and intentionally
    avoids correlated LATERAL plans.
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
