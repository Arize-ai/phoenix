from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, Sequence

from sqlalchemy.sql.selectable import ScalarSelect

from phoenix.server.api.exceptions import BadRequest
from phoenix.trace.dsl.trace_filter import FilterLowering, TraceFilter


class TraceFilterConditionError(BadRequest):
    """A trace filter expression rejected as caller input."""


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
        return f"invalid trace filter expression: {type(error).__name__}: {detail}"
    return detail


@contextmanager
def trace_filter_errors() -> Iterator[None]:
    """Report expression failures from trace filter compilation or SQL application."""
    try:
        yield
    except TraceFilterConditionError:
        raise
    except _INVALID_EXPRESSION_ERRORS as error:
        raise TraceFilterConditionError(_invalid_expression_message(error)) from error


def compile_trace_filter(trace_filter_condition: str) -> TraceFilter:
    """Compile a trace filter expression, reporting an unusable one as ``BadRequest``."""
    with trace_filter_errors():
        return TraceFilter(condition=trace_filter_condition)


def get_filtered_trace_rowids_subquery(
    trace_filter_condition: str,
    project_rowids: Sequence[int],
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    candidate_trace_rowids: Optional[Sequence[int]] = None,
    lowering: FilterLowering = "scan",
) -> ScalarSelect[int]:
    """Compile a trace filter expression into a subquery of matching trace rowids."""
    trace_filter = compile_trace_filter(trace_filter_condition)
    with trace_filter_errors():
        return trace_filter.as_trace_rowids_subquery(
            project_rowids=list(project_rowids),
            start_time=start_time,
            end_time=end_time,
            candidate_trace_rowids=candidate_trace_rowids,
            lowering=lowering,
        )
