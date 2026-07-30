from datetime import datetime
from typing import Any, Optional, Sequence

from sqlalchemy.sql.expression import Select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models
from phoenix.trace.dsl.session_filter import FilterLowering, SessionFilter


def get_filtered_session_rowids_subquery(
    session_filter_condition: str,
    project_rowids: Sequence[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    lowering: FilterLowering = "scan",
) -> ScalarSelect[int]:
    """Compile the session filter DSL into a subquery of matching project-session rowids."""
    return SessionFilter(condition=session_filter_condition).as_session_rowids_subquery(
        project_rowids=list(project_rowids),
        start_time=start_time,
        end_time=end_time,
        lowering=lowering,
    )


def apply_session_filter_to_page(
    stmt: Select[Any],
    session_filter_condition: str,
    project_rowids: Sequence[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    prejoined_aggregate: Optional[tuple[str, Any]] = None,
) -> Select[Any]:
    """Apply the session filter DSL to a statement that selects a page of ``ProjectSession`` rows.

    The predicate goes onto ``stmt`` itself so a ``LIMIT`` can stop once it has enough matching
    rows, except when the condition reads annotations — that join can emit several rows for one
    session, and only the rowid subquery's ``DISTINCT`` collapses them.

    ``prejoined_aggregate`` is the ``(builder key, subquery)`` pair of an aggregate the caller has
    already joined for sorting. Its presence means the statement has to materialize that aggregate
    for every session before it can order rows, so there is no early exit left to buy and the
    predicate takes the whole-scan lowering.
    """
    session_filter = SessionFilter(condition=session_filter_condition)
    if session_filter.can_duplicate_sessions:
        return stmt.where(
            models.ProjectSession.id.in_(
                session_filter.as_session_rowids_subquery(
                    project_rowids=list(project_rowids),
                    start_time=start_time,
                    end_time=end_time,
                    lowering="scan",
                )
            )
        )
    return session_filter(
        stmt,
        project_rowids=list(project_rowids),
        start_time=start_time,
        end_time=end_time,
        lowering="scan" if prejoined_aggregate else "probe",
        prejoined_aggregate=prejoined_aggregate,
    )
