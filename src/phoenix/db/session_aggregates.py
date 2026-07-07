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

Both accept an optional ``keys`` / ``session_col`` restriction so the aggregate can be scoped
to a candidate session set rather than every session in the project.

:func:`earliest_root_span_by_session` derives the earliest root span per session, the anchor
for session-level ``user.id`` / ``metadata`` reads.
"""

from collections.abc import Collection
from dataclasses import dataclass
from typing import Any, Optional

from sqlalchemy import distinct, func, select
from sqlalchemy.sql.elements import KeyedColumnElement
from sqlalchemy.sql.expression import ColumnElement, Select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models

SESSION_ROWID = "project_session_rowid"
SPAN_ROWID = "span_rowid"
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
]


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

    def as_grouped_subquery(self, keys: Optional[Collection[int]] = None) -> Select[Any]:
        """One GROUP BY scan yielding a row per session: ``(project_session_rowid, *values)``.

        Callers stream this directly or ``.subquery()`` it to join by session rowid. When
        ``keys`` is given the aggregate is scoped to that candidate session set.
        """
        stmt = self._base((_GROUP_KEY.label(SESSION_ROWID), *self.values))
        if keys is not None:
            stmt = stmt.where(_GROUP_KEY.in_(keys))
        return stmt.group_by(_GROUP_KEY)

    def as_correlated_scalar(
        self,
        session_col: ColumnElement[Any],
        value: Optional[str] = None,
    ) -> ScalarSelect[Any]:
        """The aggregate for a single session as a correlated scalar subquery.

        ``session_col`` is the outer session-rowid column to correlate on (e.g.
        ``ProjectSession.id``). ``value`` selects which labeled value column to return when the
        metric produces more than one; it defaults to the first.
        """
        column = self.values[0] if value is None else self._value(value)
        return self._base((column,)).where(_GROUP_KEY == session_col).scalar_subquery()

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


def span_kind_count_by_session(span_kind: str) -> SessionAggregate:
    """Number of spans of a given kind per session — value column ``span_kind_count``.

    ``span_kind`` is matched case-insensitively (e.g. ``"TOOL"``, ``"LLM"``).
    """
    return SessionAggregate(
        values=(func.count(models.Span.id).label("span_kind_count"),),
        source=models.Span,
        joins=(models.Trace,),
        where=(func.upper(models.Span.span_kind) == span_kind.upper(),),
    )


def earliest_root_span_by_session(keys: Optional[Collection[int]] = None) -> Select[Any]:
    """Select ``(project_session_rowid, span_rowid)`` of each session's earliest root span.

    A root span has ``parent_id IS NULL``; "earliest" is the lowest ``(start_time, id)`` within
    the session — the ordering that also picks a session's first input. Callers join ``Span`` on
    ``span_rowid`` to read attributes (``user.id``, ``metadata``, ...) from that span. When
    ``keys`` is given the derivation is scoped to that candidate session set.
    """
    ranked = (
        select(
            _GROUP_KEY.label(SESSION_ROWID),
            models.Span.id.label(SPAN_ROWID),
            func.row_number()
            .over(
                partition_by=_GROUP_KEY,
                order_by=[models.Trace.start_time.asc(), models.Trace.id.asc()],
            )
            .label(_ROOT_SPAN_RANK),
        )
        .join_from(models.Span, models.Trace)
        .where(models.Span.parent_id.is_(None))
    )
    if keys is not None:
        ranked = ranked.where(_GROUP_KEY.in_(keys))
    subquery = ranked.subquery()
    return select(subquery.c[SESSION_ROWID], subquery.c[SPAN_ROWID]).where(
        subquery.c[_ROOT_SPAN_RANK] == 1
    )
