"""Pushd, popd, and dirs builtin implementations.

Usage: pushd [dir]
       popd
       dirs [-clpv]

Manage the directory stack.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


def _tilde_sub(path: str, home: str) -> str:
    """Replace leading $HOME with ~ in path."""
    if not home:
        return path
    if path == home:
        return "~"
    if path.startswith(home + "/"):
        return "~" + path[len(home):]
    return path


def _format_stack(ctx: "InterpreterContext", long_format: bool = False) -> list[str]:
    """Get formatted directory stack entries."""
    home = ctx.state.env.get("HOME", "")
    # Stack: cwd is always position 0, then dir_stack entries follow
    entries = [ctx.state.cwd] + list(ctx.state.dir_stack)
    if long_format:
        return entries
    return [_tilde_sub(e, home) for e in entries]


async def handle_pushd(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the pushd builtin."""
    from ...types import ExecResult

    # Filter out --
    filtered = []
    for a in args:
        if a == "--":
            continue
        filtered.append(a)

    # Check for invalid flags
    for a in filtered:
        if a.startswith("-") and a != "--":
            return ExecResult(
                stdout="",
                stderr=f"bash: pushd: {a}: invalid option\n",
                exit_code=2,
            )

    if len(filtered) > 1:
        return ExecResult(
            stdout="",
            stderr="bash: pushd: too many arguments\n",
            exit_code=2,
        )

    if not filtered:
        # pushd with no args swaps top two entries
        if not ctx.state.dir_stack:
            return ExecResult(
                stdout="",
                stderr="bash: pushd: no other directory\n",
                exit_code=1,
            )
        # Swap cwd and top of stack
        top = ctx.state.dir_stack[0]
        ctx.state.dir_stack[0] = ctx.state.cwd
        old_dir = ctx.state.cwd
        ctx.state.previous_dir = old_dir
        ctx.state.cwd = top
        ctx.state.env["OLDPWD"] = old_dir
        ctx.state.env["PWD"] = top
    else:
        target = filtered[0]
        new_dir = ctx.fs.resolve_path(ctx.state.cwd, target)

        # Verify directory exists
        try:
            exists = await ctx.fs.exists(new_dir)
            if not exists:
                return ExecResult(
                    stdout="",
                    stderr=f"bash: pushd: {target}: No such file or directory\n",
                    exit_code=1,
                )
            is_dir = await ctx.fs.is_directory(new_dir)
            if not is_dir:
                return ExecResult(
                    stdout="",
                    stderr=f"bash: pushd: {target}: Not a directory\n",
                    exit_code=1,
                )
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"bash: pushd: {target}: {e}\n",
                exit_code=1,
            )

        # Push old cwd onto stack and cd to new dir
        ctx.state.dir_stack.insert(0, ctx.state.cwd)
        old_dir = ctx.state.cwd
        ctx.state.previous_dir = old_dir
        ctx.state.cwd = new_dir
        ctx.state.env["OLDPWD"] = old_dir
        ctx.state.env["PWD"] = new_dir

    # Print the stack
    entries = _format_stack(ctx)
    return ExecResult(
        stdout=" ".join(entries) + "\n",
        stderr="",
        exit_code=0,
    )


async def handle_popd(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the popd builtin."""
    from ...types import ExecResult

    # Filter out --
    filtered = []
    for a in args:
        if a == "--":
            continue
        filtered.append(a)

    # Check for invalid flags
    for a in filtered:
        if a.startswith("-"):
            return ExecResult(
                stdout="",
                stderr=f"bash: popd: {a}: invalid option\n",
                exit_code=2,
            )

    if filtered:
        return ExecResult(
            stdout="",
            stderr="bash: popd: too many arguments\n",
            exit_code=2,
        )

    if not ctx.state.dir_stack:
        return ExecResult(
            stdout="",
            stderr="bash: popd: directory stack empty\n",
            exit_code=1,
        )

    # Pop top of stack and cd to it
    new_dir = ctx.state.dir_stack.pop(0)
    old_dir = ctx.state.cwd
    ctx.state.previous_dir = old_dir
    ctx.state.cwd = new_dir
    ctx.state.env["OLDPWD"] = old_dir
    ctx.state.env["PWD"] = new_dir

    # Print the stack
    entries = _format_stack(ctx)
    return ExecResult(
        stdout=" ".join(entries) + "\n",
        stderr="",
        exit_code=0,
    )


async def handle_dirs(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the dirs builtin."""
    from ...types import ExecResult

    clear = False
    verbose = False
    per_line = False
    long_format = False
    positional = []

    i = 0
    while i < len(args):
        a = args[i]
        if a == "-c":
            clear = True
        elif a == "-v":
            verbose = True
        elif a == "-p":
            per_line = True
        elif a == "-l":
            long_format = True
        elif a.startswith("-") and len(a) > 1:
            # Parse combined flags like -lv
            for ch in a[1:]:
                if ch == "c":
                    clear = True
                elif ch == "v":
                    verbose = True
                elif ch == "p":
                    per_line = True
                elif ch == "l":
                    long_format = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"bash: dirs: -{ch}: invalid option\n",
                        exit_code=2,
                    )
        else:
            positional.append(a)
        i += 1

    if positional:
        return ExecResult(
            stdout="",
            stderr=f"bash: dirs: too many arguments\n",
            exit_code=1,
        )

    if clear:
        ctx.state.dir_stack.clear()
        return ExecResult(stdout="", stderr="", exit_code=0)

    entries = _format_stack(ctx, long_format=long_format)

    if verbose:
        lines = []
        for idx, entry in enumerate(entries):
            lines.append(f" {idx}  {entry}")
        return ExecResult(stdout="\n".join(lines) + "\n", stderr="", exit_code=0)

    if per_line:
        return ExecResult(stdout="\n".join(entries) + "\n", stderr="", exit_code=0)

    # Default: space-separated on one line
    return ExecResult(stdout=" ".join(entries) + "\n", stderr="", exit_code=0)
