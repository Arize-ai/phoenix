"""Alias builtin implementation.

Usage: alias [-p] [name[=value] ...]

Define or display aliases.

Options:
  -p    Print all aliases in reusable format
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


def _result(stdout: str, stderr: str, exit_code: int) -> "ExecResult":
    """Create an ExecResult."""
    from ...types import ExecResult
    return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)


def get_aliases(ctx: "InterpreterContext") -> dict[str, str]:
    """Get the aliases dictionary from context."""
    # Store aliases in a special env variable as a serialized format
    # Or use a dedicated attribute on state
    if not hasattr(ctx.state, '_aliases'):
        ctx.state._aliases = {}
    return ctx.state._aliases


def set_alias(ctx: "InterpreterContext", name: str, value: str) -> None:
    """Set an alias."""
    aliases = get_aliases(ctx)
    aliases[name] = value


def unset_alias(ctx: "InterpreterContext", name: str) -> bool:
    """Unset an alias. Returns True if it existed."""
    aliases = get_aliases(ctx)
    if name in aliases:
        del aliases[name]
        return True
    return False


async def handle_alias(
    ctx: "InterpreterContext", args: list[str]
) -> "ExecResult":
    """Execute the alias builtin."""
    # Parse options
    print_format = False
    names = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "-p":
            print_format = True
        elif arg == "--":
            names.extend(args[i + 1:])
            break
        elif arg.startswith("-"):
            return _result("", f"bash: alias: {arg}: invalid option\n", 1)
        else:
            names.append(arg)
        i += 1

    aliases = get_aliases(ctx)

    # No arguments: show all aliases
    if not names:
        output = []
        for name in sorted(aliases.keys()):
            value = aliases[name]
            output.append(f"alias {name}='{value}'")
        if output:
            return _result("\n".join(output) + "\n", "", 0)
        return _result("", "", 0)

    # Process arguments
    output = []
    errors = []
    exit_code = 0

    for arg in names:
        if "=" in arg:
            # Define alias: name=value
            eq_pos = arg.index("=")
            name = arg[:eq_pos]
            value = arg[eq_pos + 1:]
            set_alias(ctx, name, value)
        else:
            # Show alias
            name = arg
            if name in aliases:
                value = aliases[name]
                output.append(f"alias {name}='{value}'")
            else:
                errors.append(f"bash: alias: {name}: not found")
                exit_code = 1

    stdout = "\n".join(output) + "\n" if output else ""
    stderr = "\n".join(errors) + "\n" if errors else ""
    return _result(stdout, stderr, exit_code)


async def handle_unalias(
    ctx: "InterpreterContext", args: list[str]
) -> "ExecResult":
    """Execute the unalias builtin.

    Usage: unalias [-a] name [name ...]

    Options:
      -a    Remove all aliases
    """
    # Parse options
    remove_all = False
    names = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "-a":
            remove_all = True
        elif arg == "--":
            names.extend(args[i + 1:])
            break
        elif arg.startswith("-"):
            return _result("", f"bash: unalias: {arg}: invalid option\n", 1)
        else:
            names.append(arg)
        i += 1

    aliases = get_aliases(ctx)

    if remove_all:
        aliases.clear()
        return _result("", "", 0)

    if not names:
        return _result("", "bash: unalias: usage: unalias [-a] name [name ...]\n", 1)

    exit_code = 0
    stderr_parts = []

    for name in names:
        if not unset_alias(ctx, name):
            stderr_parts.append(f"bash: unalias: {name}: not found")
            exit_code = 1

    stderr = "\n".join(stderr_parts) + "\n" if stderr_parts else ""
    return _result("", stderr, exit_code)
