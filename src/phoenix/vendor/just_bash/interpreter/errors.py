"""Interpreter errors for just-bash."""


class InterpreterError(Exception):
    """Base class for interpreter errors."""

    def __init__(self, message: str = ""):
        super().__init__(message)
        self.stdout = ""
        self.stderr = ""

    def prepend_output(self, stdout: str, stderr: str) -> None:
        """Prepend accumulated output to error output."""
        self.stdout = stdout + self.stdout
        self.stderr = stderr + self.stderr


class ExitError(InterpreterError):
    """Raised when 'exit' builtin is called."""

    def __init__(self, exit_code: int, stdout: str = "", stderr: str = ""):
        super().__init__(f"exit {exit_code}")
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr


class ReturnError(InterpreterError):
    """Raised when 'return' builtin is called."""

    def __init__(self, exit_code: int, stdout: str = "", stderr: str = ""):
        super().__init__(f"return {exit_code}")
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr


class BreakError(InterpreterError):
    """Raised when 'break' builtin is called."""

    def __init__(self, levels: int = 1, stdout: str = "", stderr: str = ""):
        super().__init__(f"break {levels}")
        self.levels = levels
        self.stdout = stdout
        self.stderr = stderr


class ContinueError(InterpreterError):
    """Raised when 'continue' builtin is called."""

    def __init__(self, levels: int = 1, stdout: str = "", stderr: str = ""):
        super().__init__(f"continue {levels}")
        self.levels = levels
        self.stdout = stdout
        self.stderr = stderr


class ErrexitError(InterpreterError):
    """Raised when errexit (set -e) terminates execution."""

    def __init__(self, exit_code: int, stdout: str = "", stderr: str = ""):
        super().__init__(f"errexit with code {exit_code}")
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr


class NounsetError(InterpreterError):
    """Raised when nounset (set -u) encounters unset variable."""

    def __init__(self, variable: str, stdout: str = "", stderr: str = ""):
        super().__init__(f"unbound variable: {variable}")
        self.variable = variable
        self.stdout = stdout
        self.stderr = stderr


class BadSubstitutionError(InterpreterError):
    """Raised for bad parameter substitution."""

    def __init__(self, message: str, stdout: str = "", stderr: str = ""):
        super().__init__(message)
        self.stdout = stdout
        self.stderr = stderr


class ArithmeticError(InterpreterError):
    """Raised for arithmetic evaluation errors."""

    def __init__(self, message: str, stdout: str = "", stderr: str = ""):
        super().__init__(message)
        self.stdout = stdout
        self.stderr = stderr


class ExecutionLimitError(InterpreterError):
    """Raised when execution limits are exceeded."""

    def __init__(self, message: str, limit_type: str):
        super().__init__(message)
        self.limit_type = limit_type


class SubshellExitError(InterpreterError):
    """Raised when a subshell exits."""

    def __init__(self, exit_code: int, stdout: str = "", stderr: str = ""):
        super().__init__(f"subshell exit {exit_code}")
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr


def is_scope_exit_error(error: Exception) -> bool:
    """Check if an error should exit the current scope."""
    return isinstance(error, (ExitError, ReturnError, BreakError, ContinueError))
