from datetime import datetime
from typing import Optional, Sequence

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import distinct, or_, select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models


def get_filtered_session_rowids_subquery(
    session_filter_condition: str,
    project_rowids: Sequence[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> ScalarSelect[int]:
    """
    Returns a subquery that contains the project session rowids that match the session filter.

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
                    session_filter_condition,
                ),
                models.CaseInsensitiveContains(
                    models.Span.attributes[OUTPUT_VALUE].as_string(),
                    session_filter_condition,
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
