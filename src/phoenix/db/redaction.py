"""Keeps the values of marked columns out of SQLAlchemy error text.

A ``StatementError`` renders its bound parameters in ``str()``. Marking a column type
with ``RedactedType`` replaces that column's values with ``[redacted]`` in the rendered
parameters while leaving every other parameter visible.
"""

from collections.abc import Mapping, Sequence
from itertools import cycle
from typing import Any, Optional

from sqlalchemy import event
from sqlalchemy.engine.interfaces import ExceptionContext
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.sql.compiler import Compiled, SQLCompiler

REDACTED_VALUE = "[redacted]"


class RedactedType:
    """Mixin for a ``TypeDecorator`` whose bound values must not appear in error text."""


def redact_parameters_in_errors(engine: AsyncEngine) -> None:
    event.listen(engine.sync_engine, "handle_error", _redact_error_parameters)


def _redact_error_parameters(context: ExceptionContext) -> None:
    error = context.sqlalchemy_exception
    if error is None or not error.params:
        return
    compiled = context.execution_context.compiled if context.execution_context else None
    redacted = redact_parameters(error.params, compiled, ismulti=bool(error.ismulti))
    if redacted is None:
        error.hide_parameters = True
    else:
        error.params = redacted


def redact_parameters(params: Any, compiled: Optional[Compiled], *, ismulti: bool) -> Optional[Any]:
    """The parameters with marked binds blanked, or ``None`` when the compiled statement
    cannot account for them (textual SQL), in which case nothing can be shown safely.

    A batched multi-row INSERT arrives as one flat tuple of whole rows, so the bind
    names repeat across it."""
    if not isinstance(compiled, SQLCompiler):
        return None
    if ismulti:
        if not isinstance(params, Sequence):
            return None
        rows = [_redact_parameter_set(row, compiled) for row in params]
        return None if any(row is None for row in rows) else rows
    return _redact_parameter_set(params, compiled)


def _redact_parameter_set(params: Any, compiled: SQLCompiler) -> Optional[Any]:
    if isinstance(params, Mapping):
        return {
            name: REDACTED_VALUE if _is_redacted_bind(compiled, name) else value
            for name, value in params.items()
        }
    if isinstance(params, Sequence) and not isinstance(params, (str, bytes)):
        names = compiled.positiontup or ()
        if not names or len(params) % len(names):
            return None
        return tuple(
            REDACTED_VALUE if _is_redacted_bind(compiled, name) else value
            for name, value in zip(cycle(names), params)
        )
    return None


def _is_redacted_bind(compiled: SQLCompiler, name: str) -> bool:
    bind = compiled.binds.get(name)
    return bind is not None and isinstance(bind.type, RedactedType)


__all__ = ["REDACTED_VALUE", "RedactedType", "redact_parameters", "redact_parameters_in_errors"]
