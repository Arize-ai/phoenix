from collections.abc import Iterator
from contextlib import contextmanager

from phoenix.server.api.exceptions import BadRequest
from phoenix.trace.dsl.experiment_filter import ExperimentFilter


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


@contextmanager
def experiment_filter_errors() -> Iterator[None]:
    """Report expression failures from experiment filter compilation or SQL application."""
    try:
        yield
    except ExperimentFilterConditionError:
        raise
    except _INVALID_EXPRESSION_ERRORS as error:
        raise ExperimentFilterConditionError(_invalid_expression_message(error)) from error


def compile_experiment_filter(condition: str) -> ExperimentFilter:
    """Compile an experiment filter expression, reporting an unusable one as ``BadRequest``."""
    with experiment_filter_errors():
        return ExperimentFilter(condition=condition)
