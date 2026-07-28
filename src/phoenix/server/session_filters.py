from datetime import datetime
from typing import Optional, Sequence

from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.trace.dsl.session_filter import AggregateShape, SessionFilter


def get_filtered_session_rowids_subquery(
    session_filter_condition: str,
    project_rowids: Sequence[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    aggregate_shape: AggregateShape = "grouped",
) -> ScalarSelect[int]:
    """Compile the session filter DSL into a subquery of matching project-session rowids."""
    return SessionFilter(condition=session_filter_condition).as_session_rowids_subquery(
        project_rowids=list(project_rowids),
        start_time=start_time,
        end_time=end_time,
        aggregate_shape=aggregate_shape,
    )
