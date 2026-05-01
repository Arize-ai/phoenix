"""Batched aggregation queries for cumulative token counts.

Both helpers sum `cumulative_llm_token_count_{prompt,completion}` from root
spans (`Span.parent_id IS NULL`) and group by the requested key. SUM-and-GROUP-BY
is required because a single trace may have multiple root spans, and a single
session may have multiple traces — direct single-row reads would silently
under-report. NULL columns coalesce to 0 so traces/sessions without any LLM
descendants return totals of 0 rather than NULL.

Each helper returns a Select with three columns: `id_` (the grouping key),
`prompt`, and `completion`.
"""

from typing import Any, Collection

from sqlalchemy import Select, func, select
from sqlalchemy.sql.functions import coalesce

from phoenix.db import models


def cumulative_token_counts_by_session(
    keys: Collection[int],
) -> "Select[Any]":
    """Sum cumulative token counts on root spans, grouped by session rowid.

    Columns: `id_` (project_session_rowid), `prompt`, `completion`.
    """
    return (
        select(
            models.Trace.project_session_rowid.label("id_"),
            func.sum(coalesce(models.Span.cumulative_llm_token_count_prompt, 0)).label("prompt"),
            func.sum(coalesce(models.Span.cumulative_llm_token_count_completion, 0)).label(
                "completion"
            ),
        )
        .join_from(models.Span, models.Trace)
        .where(models.Span.parent_id.is_(None))
        .where(models.Trace.project_session_rowid.in_(keys))
        .group_by(models.Trace.project_session_rowid)
    )


def cumulative_token_counts_by_trace(
    keys: Collection[int],
) -> "Select[Any]":
    """Sum cumulative token counts on root spans, grouped by trace rowid.

    Columns: `id_` (trace_rowid), `prompt`, `completion`.
    """
    return (
        select(
            models.Span.trace_rowid.label("id_"),
            func.sum(coalesce(models.Span.cumulative_llm_token_count_prompt, 0)).label("prompt"),
            func.sum(coalesce(models.Span.cumulative_llm_token_count_completion, 0)).label(
                "completion"
            ),
        )
        .where(models.Span.parent_id.is_(None))
        .where(models.Span.trace_rowid.in_(keys))
        .group_by(models.Span.trace_rowid)
    )
