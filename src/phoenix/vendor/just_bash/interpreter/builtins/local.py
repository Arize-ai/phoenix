"""Local builtin implementation.

Usage: local [name[=value] ...]

Create local variables for use within a function. When the function
returns, any local variables are restored to their previous values.
"""

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


def _save_array_in_scope(ctx: "InterpreterContext", name: str, scope: dict) -> None:
    """Save all array-related keys for a variable in the local scope."""
    env = ctx.state.env
    # Save the array marker
    array_key = f"{name}__is_array"
    if array_key not in scope:
        scope[array_key] = env.get(array_key)

    # Save all existing array element keys
    prefix = f"{name}_"
    for key in list(env.keys()):
        if key.startswith(prefix) and not key.startswith(f"{name}__"):
            if key not in scope:
                scope[key] = env.get(key)


def _clear_array_elements(ctx: "InterpreterContext", name: str) -> None:
    """Remove all array element keys for a variable."""
    prefix = f"{name}_"
    to_remove = [k for k in ctx.state.env if k.startswith(prefix) and not k.startswith(f"{name}__")]
    for k in to_remove:
        del ctx.state.env[k]


async def handle_local(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the local builtin."""
    from ...types import ExecResult
    from .declare import _parse_array_assignment

    # Check if we're inside a function
    if not ctx.state.local_scopes:
        return ExecResult(
            stdout="",
            stderr="bash: local: can only be used in a function\n",
            exit_code=1,
        )

    current_scope = ctx.state.local_scopes[-1]

    # Parse flags
    is_array = False
    is_assoc = False
    is_nameref = False
    remaining_args = []

    for arg in args:
        if arg.startswith("-") and not ("=" in arg):
            # Parse flag characters
            for ch in arg[1:]:
                if ch == "a":
                    is_array = True
                elif ch == "A":
                    is_assoc = True
                elif ch == "n":
                    is_nameref = True
                # Other flags like -i, -r, -x are ignored for now
        else:
            remaining_args.append(arg)

    for arg in remaining_args:
        has_assignment = "=" in arg
        is_append_local = False
        if has_assignment:
            name, value = arg.split("=", 1)
        else:
            name = arg
            value = None  # No assignment - don't reset existing value

        # Handle append mode: name+=value or name+=(array)
        if name.endswith("+"):
            is_append_local = True
            name = name[:-1]

        # Validate identifier
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", name):
            return ExecResult(
                stdout="",
                stderr=f"bash: local: '{name}': not a valid identifier\n",
                exit_code=1,
            )

        # Save original value for restoration (if not already saved)
        if name not in current_scope:
            current_scope[name] = ctx.state.env.get(name)

        # Also save metadata
        from ..types import VariableStore
        if isinstance(ctx.state.env, VariableStore):
            ctx.state.env.save_metadata_in_scope(name)

        # Handle nameref
        if is_nameref and isinstance(ctx.state.env, VariableStore):
            if value is not None:
                ctx.state.env.set_nameref(name, value)
            else:
                ctx.state.env.set_attribute(name, "n")
            continue

        # Handle array initialization - detect (values...) syntax even without -a flag
        if value is not None and value.startswith("(") and value.endswith(")"):
            # Save existing array keys before overwriting
            _save_array_in_scope(ctx, name, current_scope)

            # Set array type marker
            array_key = f"{name}__is_array"
            if array_key not in ctx.state.env:
                # Converting scalar to array - save existing scalar value as element 0
                existing_scalar = ctx.state.env.get(name)
                ctx.state.env[array_key] = "assoc" if is_assoc else "indexed"
                if existing_scalar is not None:
                    ctx.state.env[f"{name}_0"] = existing_scalar
            else:
                ctx.state.env[array_key] = "assoc" if is_assoc else "indexed"

            # Clear existing elements and parse new ones (unless appending)
            if not is_append_local:
                _clear_array_elements(ctx, name)
            inner = value[1:-1].strip()
            if inner:
                _parse_array_assignment(ctx, name, inner, is_assoc, is_append_local)
        elif is_array or is_assoc:
            # Declare as array without initialization - creates empty local array
            _save_array_in_scope(ctx, name, current_scope)
            array_key = f"{name}__is_array"
            ctx.state.env[array_key] = "assoc" if is_assoc else "indexed"
            # Clear existing elements to create a fresh empty local array
            _clear_array_elements(ctx, name)
            if has_assignment:
                # Simple value assignment - set element 0
                ctx.state.env[f"{name}_0"] = value or ""
        elif has_assignment:
            # Simple variable with value
            if is_append_local:
                existing = ctx.state.env.get(name, "")
                ctx.state.env[name] = existing + (value or "")
            else:
                ctx.state.env[name] = value or ""
        else:
            # local without assignment - just mark as local, don't change value
            # If variable doesn't exist yet, set to empty string
            if name not in ctx.state.env:
                ctx.state.env[name] = ""

    return ExecResult(stdout="", stderr="", exit_code=0)
