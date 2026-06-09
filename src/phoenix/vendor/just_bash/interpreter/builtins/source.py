"""Source and eval builtin implementations.

source (or .) - Execute commands from a file in the current shell.

Usage: source filename [arguments]
       . filename [arguments]

Read and execute commands from filename in the current shell environment.
If arguments are supplied, they become the positional parameters when
filename is executed.

eval - Construct a command by concatenating arguments.

Usage: eval [arg ...]

Concatenate arguments into a single command, then execute.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


async def handle_source(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the source / . builtin."""
    from ...types import ExecResult

    if not args:
        return ExecResult(
            stdout="",
            stderr="bash: source: filename argument required\n",
            exit_code=2,
        )

    # Skip -- separator
    if args[0] == "--":
        args = args[1:]
        if not args:
            return ExecResult(
                stdout="",
                stderr="bash: source: filename argument required\n",
                exit_code=2,
            )

    filename = args[0]
    script_args = args[1:]

    # Resolve path
    content = None
    path = None

    if "/" in filename:
        # Contains slash - resolve directly relative to cwd
        path = ctx.fs.resolve_path(ctx.state.cwd, filename)
        try:
            content = await ctx.fs.read_file(path)
        except Exception:
            pass
    else:
        # No slash - search PATH directories (bash behavior)
        path_var = ctx.state.env.get("PATH", "")
        for dir_entry in path_var.split(":"):
            if not dir_entry:
                continue
            candidate = ctx.fs.resolve_path(ctx.state.cwd, dir_entry + "/" + filename)
            try:
                content = await ctx.fs.read_file(candidate)
                path = candidate
                break
            except Exception:
                continue
        if content is None:
            # Fallback: try current directory (common interactive behavior)
            path = ctx.fs.resolve_path(ctx.state.cwd, filename)
            try:
                content = await ctx.fs.read_file(path)
            except Exception:
                pass

    if content is None:
        return ExecResult(
            stdout="",
            stderr=f"bash: source: {filename}: No such file or directory\n",
            exit_code=1,
        )

    # Check source depth limit
    ctx.state.source_depth += 1
    if ctx.state.source_depth > ctx.limits.max_call_depth:
        ctx.state.source_depth -= 1
        return ExecResult(
            stdout="",
            stderr="bash: source: maximum source depth exceeded\n",
            exit_code=1,
        )

    # Save and set positional parameters if arguments provided
    saved_params = {}
    saved_count = None
    if script_args:
        # Save current positional parameters
        i = 1
        while str(i) in ctx.state.env:
            saved_params[str(i)] = ctx.state.env[str(i)]
            i += 1
        saved_count = ctx.state.env.get("#", "0")

        # Clear and set new positional parameters
        i = 1
        while str(i) in ctx.state.env:
            del ctx.state.env[str(i)]
            i += 1

        for i, arg in enumerate(script_args, start=1):
            ctx.state.env[str(i)] = arg
        ctx.state.env["#"] = str(len(script_args))

    try:
        # Parse and execute
        from ...parser import parse
        from ...parser.parser import ParseException

        try:
            ast = parse(content)
        except ParseException as e:
            return ExecResult(
                stdout="",
                stderr=f"bash: {filename}: {e}\n",
                exit_code=1,
            )
        result = await ctx.execute_script(ast)
        return result
    finally:
        ctx.state.source_depth -= 1

        # Restore positional parameters if we changed them
        if saved_count is not None:
            # Clear current positional parameters
            i = 1
            while str(i) in ctx.state.env:
                del ctx.state.env[str(i)]
                i += 1

            # Restore saved parameters
            for k, v in saved_params.items():
                ctx.state.env[k] = v
            ctx.state.env["#"] = saved_count


async def handle_eval(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the eval builtin."""
    from ...types import ExecResult
    from ..errors import BreakError, ContinueError, ReturnError, ExitError, ErrexitError

    if not args:
        return ExecResult(stdout="", stderr="", exit_code=0)

    # Skip leading -- (eval accepts and ignores it)
    if args and args[0] == "--":
        args = args[1:]

    if not args:
        return ExecResult(stdout="", stderr="", exit_code=0)

    # Concatenate arguments with spaces
    command = " ".join(args)

    # Parse and execute
    try:
        from ...parser import parse

        ast = parse(command)
        result = await ctx.execute_script(ast)
        return result
    except (BreakError, ContinueError, ReturnError, ExitError, ErrexitError):
        # Control flow exceptions must propagate through eval
        raise
    except Exception as e:
        return ExecResult(
            stdout="",
            stderr=f"bash: eval: {e}\n",
            exit_code=1,
        )
