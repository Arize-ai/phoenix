"""Control flow builtins: break, continue, return, exit.

These builtins control the flow of script execution.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult

from ..errors import BreakError, ContinueError, ReturnError, ExitError


async def handle_break(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the break builtin.

    Usage: break [n]

    Exit from within a for, while, until, or select loop.
    If n is specified, break out of n enclosing loops.
    """
    levels = 1
    if args:
        try:
            levels = int(args[0])
            if levels < 1:
                levels = 1
        except ValueError:
            raise ExitError(
                128,
                stderr=f"bash: break: {args[0]}: numeric argument required\n",
            )
        if len(args) > 1:
            # In bash, too many arguments still breaks the loop
            if ctx.state.loop_depth > 0:
                raise BreakError(levels=levels)
            from ...types import ExecResult
            return ExecResult(
                stdout="",
                stderr="bash: break: too many arguments\n",
                exit_code=1,
            )

    # If not inside a loop but inside a subshell spawned from a loop,
    # break should exit the subshell (bash behavior)
    if ctx.state.loop_depth == 0 and ctx.state.parent_has_loop_context:
        raise BreakError(levels=levels)

    # If not inside a loop, print warning and return success (bash behavior)
    if ctx.state.loop_depth == 0:
        from ...types import ExecResult
        return ExecResult(
            stdout="",
            stderr="bash: break: only meaningful in a `for', `while', or `until' loop\n",
            exit_code=0,
        )
    raise BreakError(levels=levels)


async def handle_continue(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the continue builtin.

    Usage: continue [n]

    Resume the next iteration of an enclosing for, while, until, or select loop.
    If n is specified, resume at the nth enclosing loop.
    """
    levels = 1
    if args:
        try:
            levels = int(args[0])
            if levels < 1:
                levels = 1
        except ValueError:
            raise ExitError(
                128,
                stderr=f"bash: continue: {args[0]}: numeric argument required\n",
            )
        if len(args) > 1:
            # In bash, too many arguments still breaks the loop
            if ctx.state.loop_depth > 0:
                raise BreakError(levels=levels)
            from ...types import ExecResult
            return ExecResult(
                stdout="",
                stderr="bash: continue: too many arguments\n",
                exit_code=1,
            )

    # If not inside a loop but inside a subshell spawned from a loop,
    # continue/break should exit the subshell (bash behavior)
    if ctx.state.loop_depth == 0 and ctx.state.parent_has_loop_context:
        raise ContinueError(levels=levels)

    # If not inside a loop, print warning and return success (bash behavior)
    if ctx.state.loop_depth == 0:
        from ...types import ExecResult
        return ExecResult(
            stdout="",
            stderr="bash: continue: only meaningful in a `for', `while', or `until' loop\n",
            exit_code=0,
        )
    raise ContinueError(levels=levels)


async def handle_return(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the return builtin.

    Usage: return [n]

    Return from a shell function or sourced script.
    n is the return value (0-255). If n is omitted, the return value is
    the exit status of the last command executed.
    """
    exit_code = ctx.state.last_exit_code
    if args:
        try:
            exit_code = int(args[0]) & 255  # Mask to 0-255
        except ValueError:
            from ...types import ExecResult
            return ExecResult(
                stdout="",
                stderr=f"bash: return: {args[0]}: numeric argument required\n",
                exit_code=2,
            )

    raise ReturnError(exit_code)


async def handle_exit(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the exit builtin.

    Usage: exit [n]

    Exit the shell with status n. If n is omitted, the exit status is
    that of the last command executed.
    """
    exit_code = ctx.state.last_exit_code
    if args:
        try:
            exit_code = int(args[0]) & 255  # Mask to 0-255
        except ValueError:
            from ...types import ExecResult
            return ExecResult(
                stdout="",
                stderr=f"bash: exit: {args[0]}: numeric argument required\n",
                exit_code=1,
            )

    raise ExitError(exit_code)
