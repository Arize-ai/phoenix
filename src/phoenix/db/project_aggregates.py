"""Single source for per-project aggregate SQL.

Project token counts and cost totals are defined once here and consumed by the GraphQL
dataloaders and the REST API, so both report the same numbers.
"""

from collections.abc import Collection
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.orm import aliased
from sqlalchemy.sql.functions import coalesce

from phoenix.db import models

__all__ = [
    "cost_summary_by_project",
    "token_counts_by_project",
]


def _has_llm_child() -> ColumnElement[bool]:
    child = aliased(models.Span, name="child_span")
    # Span IDs are unique across traces, so parent_id alone identifies the parent.
    return (
        select(1)
        .where(child.parent_id == models.Span.span_id)
        .where(func.upper(child.span_kind) == "LLM")
        .exists()
    )


def token_counts_by_project(
    project_rowids: Collection[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> Select[*tuple[Any, ...]]:
    """Leaf LLM token totals per project, as ``project_rowid``, ``prompt``, ``completion``
    and ``total``, for spans that start within ``[start_time, end_time)``.
    """
    prompt = coalesce(func.sum(models.Span.llm_token_count_prompt), 0)
    completion = coalesce(func.sum(models.Span.llm_token_count_completion), 0)
    total = prompt + completion
    pid = models.Trace.project_rowid
    stmt: Select[*tuple[Any, ...]] = (
        select(
            pid,
            prompt.label("prompt"),
            completion.label("completion"),
            total.label("total"),
        )
        .join_from(models.Trace, models.Span)
        # Wrapping spans can repeat their children's token counts (#12768).
        .where(func.upper(models.Span.span_kind) == "LLM")
        .where(~_has_llm_child())
        .where(pid.in_(project_rowids))
        .group_by(pid)
    )
    if start_time:
        stmt = stmt.where(start_time <= models.Span.start_time)
    if end_time:
        stmt = stmt.where(models.Span.start_time < end_time)
    return stmt


def cost_summary_by_project(
    project_rowids: Collection[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> Select[*tuple[Any, ...]]:
    """Span-cost totals per project, as ``project_rowid``, ``prompt_cost``,
    ``completion_cost``, ``total_cost``, ``prompt_tokens``, ``completion_tokens`` and
    ``total_tokens``, for traces that start within ``[start_time, end_time)``.
    """
    stmt: Select[*tuple[Any, ...]] = (
        select(
            models.Trace.project_rowid,
            coalesce(func.sum(models.SpanCost.prompt_cost), 0).label("prompt_cost"),
            coalesce(func.sum(models.SpanCost.completion_cost), 0).label("completion_cost"),
            coalesce(func.sum(models.SpanCost.total_cost), 0).label("total_cost"),
            coalesce(func.sum(models.SpanCost.prompt_tokens), 0).label("prompt_tokens"),
            coalesce(func.sum(models.SpanCost.completion_tokens), 0).label("completion_tokens"),
            coalesce(func.sum(models.SpanCost.total_tokens), 0).label("total_tokens"),
        )
        .select_from(models.Trace)
        .join(models.SpanCost, models.Trace.id == models.SpanCost.trace_rowid)
        .where(models.Trace.project_rowid.in_(project_rowids))
        .group_by(models.Trace.project_rowid)
    )
    if start_time:
        stmt = stmt.where(start_time <= models.Trace.start_time)
    if end_time:
        stmt = stmt.where(models.Trace.start_time < end_time)
    return stmt
