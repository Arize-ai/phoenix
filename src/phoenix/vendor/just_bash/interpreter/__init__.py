"""Interpreter module for just-bash."""

from .interpreter import Interpreter
from .types import InterpreterContext, InterpreterState, ShellOptions, VariableStore
from .errors import (
    InterpreterError,
    ExitError,
    ReturnError,
    BreakError,
    ContinueError,
    ErrexitError,
    NounsetError,
    BadSubstitutionError,
    ArithmeticError,
    ExecutionLimitError,
    SubshellExitError,
    is_scope_exit_error,
)

__all__ = [
    "Interpreter",
    "InterpreterContext",
    "InterpreterState",
    "ShellOptions",
    "InterpreterError",
    "ExitError",
    "ReturnError",
    "BreakError",
    "ContinueError",
    "ErrexitError",
    "NounsetError",
    "BadSubstitutionError",
    "ArithmeticError",
    "ExecutionLimitError",
    "SubshellExitError",
    "is_scope_exit_error",
]
