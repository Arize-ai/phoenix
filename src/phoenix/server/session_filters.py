from datetime import datetime
from typing import Optional, Sequence

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import distinct, or_, select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models
from phoenix.trace.dsl.session_filter import AggregateShape, SessionFilter


def get_filtered_session_rowids_subquery(
    session_filter_condition: str,
    project_rowids: Sequence[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    aggregate_shape: AggregateShape = "grouped",
) -> ScalarSelect[int]:
    """Compile the session filter DSL into a subquery of matching project-session rowids.

    ``session_filter_condition`` is a filter expression, not a substring — the substring matcher is
    :func:`get_io_substring_session_rowids_subquery`.
    """
    return SessionFilter(condition=session_filter_condition).as_session_rowids_subquery(
        project_rowids=list(project_rowids),
        start_time=start_time,
        end_time=end_time,
        aggregate_shape=aggregate_shape,
    )


def get_io_substring_session_rowids_subquery(
    io_substring: str,
    project_rowids: Sequence[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> ScalarSelect[int]:
    """Return session rowids whose root-span input or output case-insensitively contains
    ``io_substring``.

    The substring may match the root span input/output of any trace in the session,
    regardless of when that trace occurred. ``start_time``/``end_time`` scope the
    *sessions* by interval overlap: a session qualifies iff
    [session.start_time, session.end_time] intersects [start_time, end_time). These are
    the same semantics as the time range filter on the sessions connection, so all
    callers agree on which sessions match for a given window.
    """
    filtered_session_rowids = (
        select(distinct(models.Trace.project_session_rowid).label("id"))
        .join_from(models.Trace, models.Span)
        .where(models.Trace.project_rowid.in_(project_rowids))
        .where(models.Span.parent_id.is_(None))
        .where(
            or_(
                models.CaseInsensitiveContains(
                    models.Span.attributes[INPUT_VALUE].as_string(),
                    io_substring,
                ),
                models.CaseInsensitiveContains(
                    models.Span.attributes[OUTPUT_VALUE].as_string(),
                    io_substring,
                ),
            )
        )
    )
    if start_time or end_time:
        filtered_session_rowids = filtered_session_rowids.join(
            models.ProjectSession,
            models.Trace.project_session_rowid == models.ProjectSession.id,
        )
        if start_time:
            filtered_session_rowids = filtered_session_rowids.where(
                start_time <= models.ProjectSession.end_time
            )
        if end_time:
            filtered_session_rowids = filtered_session_rowids.where(
                models.ProjectSession.start_time < end_time
            )
    return filtered_session_rowids.scalar_subquery()


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
