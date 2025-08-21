from datetime import datetime
from typing import Optional

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import distinct, or_, select
from sqlalchemy.sql import Subquery

from phoenix.db import models


def get_filtered_session_rowids_subquery(
    session_filter: str,
    project_rowid: int,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> Subquery:
    """
    Returns a subquery that contains the project session rowids that match the session filter.
    """

    filtered_session_rowids = (
        select(distinct(models.Trace.project_session_rowid).label("id"))
        .filter_by(project_rowid=project_rowid)
        .join_from(models.Trace, models.Span)
        .where(models.Span.parent_id.is_(None))
        .where(
            or_(
                models.CaseInsensitiveContains(
                    models.Span.attributes[INPUT_VALUE].as_string(),
                    session_filter,
                ),
                models.CaseInsensitiveContains(
                    models.Span.attributes[OUTPUT_VALUE].as_string(),
                    session_filter,
                ),
            )
        )
    )
    if start_time:
        filtered_session_rowids = filtered_session_rowids.where(
            start_time <= models.Trace.start_time
        )
    if end_time:
        filtered_session_rowids = filtered_session_rowids.where(models.Trace.start_time < end_time)
    return filtered_session_rowids.subquery()


INPUT_VALUE = SpanAttributes.INPUT_VALUE.split(".")
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE.split(".")
