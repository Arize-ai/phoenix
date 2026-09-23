from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Optional, Sequence

from sqlalchemy.sql.expression import Select
from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.db import models
from phoenix.server.api.exceptions import BadRequest
from phoenix.trace.dsl.session_filter import FilterLowering, SessionFilter


class SessionFilterConditionError(BadRequest):
    """A session filter expression the compiler rejected as the caller's error.

    It subclasses ``BadRequest`` so every resolver that compiles a session filter reports
    an unusable expression as a client error rather than a server error, and
    ``validateSessionFilterCondition`` catches this same type — the two entrypoints cannot
    disagree about what counts as invalid.
    """


# Failures the compiler raises for an expression it cannot make sense of. Anything outside
# this set (planner, driver, database) is not the caller's fault and stays a server error.
_INVALID_EXPRESSION_ERRORS = (
    AttributeError,
    IndexError,
    KeyError,
    NameError,
    SyntaxError,
    TypeError,
    ValueError,
)


def _invalid_expression_message(error: Exception) -> str:
    detail = str(error)
    if isinstance(error, (AttributeError, IndexError, KeyError)):
        # These stringify to a bare key or attribute, which reads as noise without a frame.
        return f"invalid session filter expression: {type(error).__name__}: {detail}"
    return detail


@contextmanager
def session_filter_errors() -> Iterator[None]:
    """Report expression failures from the enclosed compile/apply as ``BadRequest``.

    Compilation and application are one boundary from a caller's perspective: some
    expressions parse and only fail once the compiler tries to build SQL for them, and both
    are the caller's expression being wrong.
    """
    try:
        yield
    except SessionFilterConditionError:
        raise
    except _INVALID_EXPRESSION_ERRORS as error:
        raise SessionFilterConditionError(_invalid_expression_message(error)) from error


def compile_session_filter(session_filter_condition: str) -> SessionFilter:
    """Compile a session filter expression, reporting an unusable one as ``BadRequest``."""
    with session_filter_errors():
        return SessionFilter(condition=session_filter_condition)


def get_filtered_session_rowids_subquery(
    session_filter_condition: str,
    project_rowids: Sequence[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    lowering: FilterLowering = "scan",
) -> ScalarSelect[int]:
    """Compile the session filter DSL into a subquery of matching project-session rowids."""
    session_filter = compile_session_filter(session_filter_condition)
    with session_filter_errors():
        return session_filter.as_session_rowids_subquery(
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
    session_filter = compile_session_filter(session_filter_condition)
    with session_filter_errors():
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
