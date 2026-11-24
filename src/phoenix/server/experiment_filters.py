from typing import Any

from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.sql.expression import Select

from phoenix.server.api.exceptions import BadRequest
from phoenix.server.experiments.filter import compile_experiment_filter


class ExperimentFilterConditionError(BadRequest):
    """An experiment filter expression rejected as caller input."""


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
        return f"invalid experiment filter expression: {type(error).__name__}: {detail}"
    return detail


def apply_experiment_filter(*, condition: str, stmt: Select[Any]) -> Select[Any]:
    """Apply an experiment filter expression to a statement selecting from ``Experiment``.

    The filtered statement is compiled for SQLite and PostgreSQL, so a condition that
    compiles but can't be rendered as SQL, such as one nested too deeply, raises
    ``ExperimentFilterConditionError`` here rather than when the query runs.
    """
    try:
        predicate = compile_experiment_filter(condition)
        filtered_stmt = stmt.where(predicate) if predicate is not None else stmt
        filtered_stmt.compile(dialect=sqlite.dialect())
        filtered_stmt.compile(dialect=postgresql.dialect())  # type: ignore[no-untyped-call]
    except RecursionError:
        raise ExperimentFilterConditionError("filter condition is nested too deeply") from None
    except _INVALID_EXPRESSION_ERRORS as error:
        raise ExperimentFilterConditionError(_invalid_expression_message(error)) from error
    return filtered_stmt
