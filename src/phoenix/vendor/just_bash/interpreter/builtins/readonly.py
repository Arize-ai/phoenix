"""Readonly builtin implementation.

Usage: readonly [-p] [name[=value] ...]

Marks variables as readonly. Once a variable is marked readonly, it cannot
be reassigned or unset.

Options:
  -p    Display all readonly variables
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


def _result(stdout: str, stderr: str, exit_code: int) -> "ExecResult":
    """Create an ExecResult."""
    from ...types import ExecResult
    return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)


async def handle_readonly(
    ctx: "InterpreterContext", args: list[str]
) -> "ExecResult":
    """Execute the readonly builtin."""
    from ..types import VariableStore

    # Parse options
    show_all = False
    names = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "-p":
            show_all = True
        elif arg == "--":
            names.extend(args[i + 1:])
            break
        elif arg.startswith("-"):
            # Unknown option - ignore for now
            pass
        else:
            names.append(arg)
        i += 1

    env = ctx.state.env

    # If no names and -p or no args, show all readonly variables
    if not names or show_all:
        output = []
        # Collect readonly vars from metadata and legacy __readonly__
        readonly_vars: set[str] = set()
        if isinstance(env, VariableStore):
            for vname, meta in env._metadata.items():
                if "r" in meta.attributes:
                    readonly_vars.add(vname)
        # Also check legacy __readonly__ key
        legacy_readonly = env.get("__readonly__", "").split()
        readonly_vars.update(v for v in legacy_readonly if v)
        # Also check state.readonly_vars
        readonly_vars.update(ctx.state.readonly_vars)

        for var in sorted(readonly_vars):
            if var in env:
                value = env[var]
                output.append(f"declare -r {var}=\"{value}\"")
            else:
                output.append(f"declare -r {var}")
        if output:
            return _result("\n".join(output) + "\n", "", 0)
        return _result("", "", 0)

    # Mark variables as readonly
    for name_value in names:
        is_append = False
        if "=" in name_value:
            name, value = name_value.split("=", 1)
        else:
            name = name_value
            value = None

        # Handle append mode: name+=value or name+=(array)
        if name.endswith("+"):
            is_append = True
            name = name[:-1]

        # Check if already readonly
        if _is_readonly(ctx, name):
            return _result("", f"bash: readonly: {name}: readonly variable\n", 1)

        if value is not None:
            # Handle array assignment: (values)
            if value.startswith("(") and value.endswith(")"):
                from .declare import _parse_array_assignment
                array_key = f"{name}__is_array"
                if array_key not in env:
                    # Converting scalar to array
                    existing_scalar = env.get(name)
                    env[array_key] = "indexed"
                    if existing_scalar is not None:
                        env[f"{name}_0"] = existing_scalar
                else:
                    env[array_key] = "indexed"

                if not is_append:
                    # Clear existing elements
                    to_remove = [k for k in env if k.startswith(f"{name}_") and not k.startswith(f"{name}__")]
                    for k in to_remove:
                        del env[k]

                inner = value[1:-1].strip()
                if inner:
                    _parse_array_assignment(ctx, name, inner, False, is_append)
            elif is_append:
                # Check if this is an array - if so, append to element 0
                is_array = env.get(f"{name}__is_array") is not None
                if is_array:
                    existing = env.get(f"{name}_0", "")
                    env[f"{name}_0"] = existing + value
                else:
                    existing = env.get(name, "")
                    env[name] = existing + value
            else:
                env[name] = value

        # Set readonly via metadata
        if isinstance(env, VariableStore):
            env.set_attribute(name, "r")
        ctx.state.readonly_vars.add(name)
        # Also update legacy __readonly__ for backwards compat
        readonly_set = set(env.get("__readonly__", "").split())
        readonly_set.add(name)
        env["__readonly__"] = " ".join(sorted(readonly_set))

    return _result("", "", 0)


def _is_readonly(ctx: "InterpreterContext", name: str) -> bool:
    """Check if a variable is readonly."""
    from ..types import VariableStore
    env = ctx.state.env
    if isinstance(env, VariableStore) and env.is_readonly(name):
        return True
    if name in ctx.state.readonly_vars:
        return True
    return name in env.get("__readonly__", "").split()
