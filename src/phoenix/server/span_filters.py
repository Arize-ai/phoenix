"""Span selection shared by online span evaluators and datasets exported from their filters."""

from sqlalchemy import select
from sqlalchemy.sql.expression import Select

from phoenix.db import models
from phoenix.trace.dsl.filter import SpanFilter


def select_project_span_rowids(project_rowid: int, span_filter: SpanFilter) -> Select[tuple[int]]:
    """Select the rowids of a project's spans that pass ``span_filter``.

    Online span evaluators scan windows of this statement and span exports narrow it to
    the latest matches, so an export built from an evaluator's filter selects from the
    same spans the evaluator scores.
    """
    stmt = (
        select(models.Span.id)
        .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
        .where(models.Trace.project_rowid == project_rowid)
    )
    return span_filter(stmt)
