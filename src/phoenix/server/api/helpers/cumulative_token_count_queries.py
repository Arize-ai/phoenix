from typing import Any, Collection

from sqlalchemy import Select, func, select
from sqlalchemy.sql.functions import coalesce

from phoenix.db import models


def cumulative_token_counts_by_session(
    keys: Collection[int],
) -> "Select[Any]":
    """
    Returns a Select that SUMs cumulative token counts over root spans grouped by
    project_session_rowid for the given session rowid keys.

    Columns: id_ (project_session_rowid), prompt, completion
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
    """
    Returns a Select that SUMs cumulative token counts over root spans grouped by
    trace_rowid for the given trace rowid keys.

    A valid trace can have multiple root spans, so direct single-root reads are
    unsafe — SUM-and-GROUP-BY is required here too.

    Columns: id_ (trace_rowid), prompt, completion
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
