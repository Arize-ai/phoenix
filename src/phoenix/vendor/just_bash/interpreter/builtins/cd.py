"""Cd builtin implementation.

Usage: cd [-L|-P] [dir]
       cd -

Change the current working directory to dir. If dir is not specified,
change to $HOME. If dir is -, change to $OLDPWD.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


async def handle_cd(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the cd builtin."""
    from ...types import ExecResult

    # Parse flags: -L (logical, default), -P (physical)
    # Also handle -- as end-of-options
    positional: list[str] = []
    end_of_opts = False
    for a in args:
        if end_of_opts:
            positional.append(a)
        elif a == "--":
            end_of_opts = True
        elif a in ("-L", "-P"):
            # Accept but don't change behavior (no symlinks in vfs)
            pass
        elif a == "-":
            positional.append(a)
        elif a.startswith("-") and len(a) > 1:
            return ExecResult(
                stdout="",
                stderr=f"bash: cd: {a}: invalid option\n",
                exit_code=2,
            )
        else:
            positional.append(a)

    # cd accepts at most one positional argument
    if len(positional) > 1:
        return ExecResult(
            stdout="",
            stderr="bash: cd: too many arguments\n",
            exit_code=1,
        )

    # Determine target directory
    if not positional:
        # cd with no args goes to HOME
        target = ctx.state.env.get("HOME", "/")
    elif positional[0] == "-":
        # cd - goes to previous directory
        target = ctx.state.previous_dir
        if not target:
            return ExecResult(
                stdout="",
                stderr="bash: cd: OLDPWD not set\n",
                exit_code=1,
            )
    else:
        target = positional[0]

    # Resolve the path
    new_dir = ctx.fs.resolve_path(ctx.state.cwd, target)

    # Validate intermediate path components
    # e.g. cd nonexistent/.. should fail because nonexistent doesn't exist
    if "/" in target and ".." in target:
        # Check each component exists before resolving ..
        parts = target.split("/")
        check_path = ctx.state.cwd if not target.startswith("/") else ""
        for part in parts:
            if not part or part == ".":
                continue
            if part == "..":
                # Go up (already validated parent exists)
                check_path = ctx.fs.resolve_path(check_path or "/", "..")
                continue
            check_path = ctx.fs.resolve_path(check_path or "/", part)
            try:
                exists = await ctx.fs.exists(check_path)
                if not exists:
                    return ExecResult(
                        stdout="",
                        stderr=f"bash: cd: {target}: No such file or directory\n",
                        exit_code=1,
                    )
            except Exception:
                return ExecResult(
                    stdout="",
                    stderr=f"bash: cd: {target}: No such file or directory\n",
                    exit_code=1,
                )

    # Verify directory exists
    try:
        exists = await ctx.fs.exists(new_dir)
        if not exists:
            return ExecResult(
                stdout="",
                stderr=f"bash: cd: {target}: No such file or directory\n",
                exit_code=1,
            )

        is_dir = await ctx.fs.is_directory(new_dir)
        if not is_dir:
            return ExecResult(
                stdout="",
                stderr=f"bash: cd: {target}: Not a directory\n",
                exit_code=1,
            )
    except Exception as e:
        return ExecResult(
            stdout="",
            stderr=f"bash: cd: {target}: {e}\n",
            exit_code=1,
        )

    # Update state
    old_dir = ctx.state.cwd
    ctx.state.previous_dir = old_dir
    ctx.state.cwd = new_dir
    ctx.state.env["OLDPWD"] = old_dir
    ctx.state.env["PWD"] = new_dir

    # Update bottom of directory stack if stack is non-empty
    # (cd replaces the current entry, which is always position 0 = cwd)
    # The dir_stack stores entries below cwd, so no change needed there.

    # If cd - was used, print the new directory
    stdout = ""
    if positional and positional[0] == "-":
        stdout = new_dir + "\n"

    return ExecResult(stdout=stdout, stderr="", exit_code=0)
