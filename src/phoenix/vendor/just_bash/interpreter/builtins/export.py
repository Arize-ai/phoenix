"""Export builtin implementation.

Usage: export [name[=value] ...]
       export -p
       export -n name

Mark variables for export to child processes. If no arguments are given,
list all exported variables.
"""

import re
from typing import TYPE_CHECKING

from ..types import VariableStore

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


async def handle_export(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the export builtin."""
    from ...types import ExecResult

    remove_export = False
    print_mode = False
    names_to_process = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--":
            names_to_process.extend(args[i + 1:])
            break
        if arg.startswith("-") and not arg.startswith("--"):
            for ch in arg[1:]:
                if ch == "n":
                    remove_export = True
                elif ch == "p":
                    print_mode = True
                elif ch == "f":
                    pass  # -f for functions, ignore
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"bash: export: -{ch}: invalid option\n",
                        exit_code=2,
                    )
        else:
            names_to_process.append(arg)
        i += 1

    # No arguments or -p: list all exported variables
    if not names_to_process or print_mode:
        lines = []
        if isinstance(ctx.state.env, VariableStore):
            for k in sorted(ctx.state.env.keys()):
                # Skip internal variables
                if k.startswith("PIPESTATUS_") or k.startswith("__") or k == "?" or k == "#" or k.endswith("__is_array"):
                    continue
                attrs = ctx.state.env.get_attributes(k)
                if "x" in attrs:
                    v = ctx.state.env.get(k, "")
                    escaped_v = v.replace("\\", "\\\\").replace('"', '\\"')
                    lines.append(f'declare -x {k}="{escaped_v}"')
        else:
            for k, v in sorted(ctx.state.env.items()):
                if k.startswith("PIPESTATUS_") or k == "?" or k == "#":
                    continue
                escaped_v = v.replace("\\", "\\\\").replace('"', '\\"')
                lines.append(f'declare -x {k}="{escaped_v}"')
        if not names_to_process:
            return ExecResult(stdout="\n".join(lines) + "\n" if lines else "", stderr="", exit_code=0)

    # Process each argument
    stderr_parts = []
    exit_code = 0
    for arg in names_to_process:
        is_append = False
        if "=" in arg:
            name, value = arg.split("=", 1)
        else:
            name = arg
            value = None

        # Handle append mode: name+=value
        if name.endswith("+"):
            is_append = True
            name = name[:-1]

        # Validate identifier
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", name):
            stderr_parts.append(f"bash: export: '{name}': not a valid identifier\n")
            exit_code = 1
            continue

        # Set value if provided (regardless of -n)
        if value is not None:
            if is_append:
                existing = ctx.state.env.get(name, "")
                ctx.state.env[name] = existing + value
            else:
                ctx.state.env[name] = value
        elif not remove_export and name not in ctx.state.env:
            ctx.state.env[name] = ""

        if remove_export:
            # export -n: remove export attribute
            if isinstance(ctx.state.env, VariableStore):
                ctx.state.env.remove_attribute(name, "x")
        else:
            # Mark as exported
            if isinstance(ctx.state.env, VariableStore):
                ctx.state.env.set_attribute(name, "x")

    return ExecResult(stdout="", stderr="".join(stderr_parts), exit_code=exit_code)
