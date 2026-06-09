"""Unset builtin implementation.

Usage: unset [-f] [-v] [name ...]

Remove variables or functions.

Options:
  -v  Treat each name as a variable name (default)
  -f  Treat each name as a function name
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


async def handle_unset(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the unset builtin."""
    from ...types import ExecResult
    from ..types import VariableStore

    mode = "variable"
    explicit_mode = False
    unset_nameref = False
    names = []

    for arg in args:
        if arg == "-v":
            mode = "variable"
            explicit_mode = True
        elif arg == "-f":
            mode = "function"
            explicit_mode = True
        elif arg == "-n":
            # -n: unset the nameref itself, not the target
            unset_nameref = True
        elif arg.startswith("-"):
            # Skip unknown options
            pass
        else:
            names.append(arg)

    import re
    env = ctx.state.env
    exit_code = 0
    stderr_parts = []

    for name in names:
        if mode == "function":
            ctx.state.functions.pop(name, None)
        else:
            # Validate variable name (allow name, name[subscript])
            base_name = name.split("[")[0] if "[" in name else name
            if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', base_name):
                stderr_parts.append(f"bash: unset: `{name}': not a valid identifier\n")
                exit_code = 1
                continue
            # Handle -n flag: unset the nameref variable itself
            if unset_nameref and isinstance(env, VariableStore):
                env.clear_nameref(name)
                env.pop(name, None)
                continue

            # Resolve nameref for unset target
            resolved_name = name
            if isinstance(env, VariableStore) and env.is_nameref(name):
                try:
                    resolved_name = env.resolve_nameref(name)
                except ValueError:
                    resolved_name = name

            # Check for array element syntax: a[idx]
            array_match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+)\]$', resolved_name)
            if array_match:
                arr_name = array_match.group(1)
                subscript = array_match.group(2)
                # Check if variable is readonly
                if _is_readonly(ctx, arr_name):
                    return ExecResult(
                        stdout="",
                        stderr=f"bash: unset: {arr_name}: cannot unset: readonly variable\n",
                        exit_code=1,
                    )
                # Evaluate subscript for indexed arrays (handles negative indices)
                is_assoc = env.get(f"{arr_name}__is_array") == "assoc"
                if not is_assoc:
                    from ..expansion import _eval_array_subscript, get_array_elements
                    try:
                        idx = _eval_array_subscript(ctx, subscript)
                        # Handle negative index
                        if idx < 0:
                            elements = get_array_elements(ctx, arr_name)
                            if elements:
                                max_idx = max(i for i, _ in elements)
                                idx = max_idx + 1 + idx
                        subscript = str(idx)
                    except (ValueError, TypeError):
                        pass  # Use subscript as-is if evaluation fails
                # Remove specific array element
                env.pop(f"{arr_name}_{subscript}", None)
            else:
                # Check if variable is readonly
                if _is_readonly(ctx, resolved_name):
                    return ExecResult(
                        stdout="",
                        stderr=f"bash: unset: {resolved_name}: cannot unset: readonly variable\n",
                        exit_code=1,
                    )
                # Remove the variable
                env.pop(resolved_name, None)
                # Also remove all array elements if this is an array
                prefix = f"{resolved_name}_"
                to_remove = [k for k in env if k.startswith(prefix)]
                for k in to_remove:
                    del env[k]
                # Clean up metadata
                if isinstance(env, VariableStore):
                    env._metadata.pop(resolved_name, None)
                # If no variable was found and mode wasn't explicitly set,
                # also try removing as function (POSIX behavior)
                if resolved_name not in env and not explicit_mode:
                    ctx.state.functions.pop(resolved_name, None)

    return ExecResult(stdout="", stderr="".join(stderr_parts), exit_code=exit_code)


def _is_readonly(ctx: "InterpreterContext", name: str) -> bool:
    """Check if a variable is readonly."""
    from ..types import VariableStore
    env = ctx.state.env
    if isinstance(env, VariableStore) and env.is_readonly(name):
        return True
    return name in ctx.state.readonly_vars
