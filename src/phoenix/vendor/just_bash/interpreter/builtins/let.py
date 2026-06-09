"""Let builtin implementation.

Usage: let expr [expr ...]

Evaluates arithmetic expressions. Each expr is evaluated as an arithmetic
expression. Returns 0 if the last expression evaluates to non-zero, 1 otherwise.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


def _result(stdout: str, stderr: str, exit_code: int) -> "ExecResult":
    """Create an ExecResult."""
    from ...types import ExecResult
    return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)


async def handle_let(
    ctx: "InterpreterContext", args: list[str]
) -> "ExecResult":
    """Execute the let builtin."""
    from ..expansion import evaluate_arithmetic
    from ...parser.parser import Parser

    if not args:
        return _result("", "bash: let: expression expected\n", 1)

    parser = Parser()
    last_value = 0

    for expr_str in args:
        try:
            # Parse and evaluate the arithmetic expression
            arith_expr = parser._parse_arithmetic_expression(expr_str)
            last_value = await evaluate_arithmetic(ctx, arith_expr)
        except Exception as e:
            return _result("", f"bash: let: {expr_str}: syntax error\n", 1)

    # Return 0 if last value is non-zero, 1 if zero
    return _result("", "", 0 if last_value != 0 else 1)
