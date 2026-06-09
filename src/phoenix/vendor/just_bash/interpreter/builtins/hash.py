"""Hash builtin implementation.

Usage: hash [-lr] [-p pathname] [-dt] [name ...]

Manage the command hash table. Each time you execute a command,
bash looks for it in the PATH directories and remembers the location.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..types import InterpreterContext
    from ...types import ExecResult


async def handle_hash(ctx: "InterpreterContext", args: list[str]) -> "ExecResult":
    """Execute the hash builtin.

    In a sandboxed VFS environment, the hash table is a simple dict
    that tracks command->path mappings. This is a minimal implementation
    that supports the common flags.
    """
    from ...types import ExecResult

    # Get or create hash table on state
    if not hasattr(ctx.state, '_hash_table'):
        ctx.state._hash_table = {}  # type: ignore[attr-defined]
    hash_table: dict[str, tuple[int, str]] = ctx.state._hash_table  # type: ignore[attr-defined]

    # Parse options
    reset = False
    delete = False
    list_mode = False
    type_mode = False
    pathname = None
    names: list[str] = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--":
            names.extend(args[i + 1:])
            break
        elif arg == "-r":
            reset = True
        elif arg == "-l":
            list_mode = True
        elif arg == "-d":
            delete = True
        elif arg == "-t":
            type_mode = True
        elif arg == "-p" and i + 1 < len(args):
            i += 1
            pathname = args[i]
        else:
            names.append(arg)
        i += 1

    # hash -r: clear the table (extra args are silently ignored)
    if reset:
        hash_table.clear()
        return ExecResult(stdout="", stderr="", exit_code=0)

    # hash -d name: delete entries
    if delete:
        for name in names:
            hash_table.pop(name, None)
        return ExecResult(stdout="", stderr="", exit_code=0)

    # hash with no args: list the table
    if not names:
        if not hash_table:
            return ExecResult(
                stdout="",
                stderr="bash: hash: hash table empty\n",
                exit_code=1,
            )
        lines = ["hits\tcommand"]
        for cmd, (hits, path) in sorted(hash_table.items()):
            lines.append(f"   {hits}\t{path}")
        return ExecResult(stdout="\n".join(lines) + "\n", stderr="", exit_code=0)

    # hash -t name: print remembered path
    if type_mode:
        output = []
        exit_code = 0
        for name in names:
            if name in hash_table:
                _, path = hash_table[name]
                output.append(path)
            else:
                # Try to find it
                found = await _find_in_path(ctx, name)
                if found:
                    hash_table[name] = (0, found)
                    output.append(found)
                else:
                    exit_code = 1
        stdout = "\n".join(output) + "\n" if output else ""
        return ExecResult(stdout=stdout, stderr="", exit_code=exit_code)

    # hash -p pathname name: set explicit path
    if pathname and names:
        for name in names:
            hash_table[name] = (0, pathname)
        return ExecResult(stdout="", stderr="", exit_code=0)

    # hash name ...: look up and cache
    exit_code = 0
    stderr_parts = []
    for name in names:
        found = await _find_in_path(ctx, name)
        if found:
            hash_table[name] = (0, found)
        else:
            stderr_parts.append(f"bash: hash: {name}: not found\n")
            exit_code = 1

    return ExecResult(
        stdout="",
        stderr="".join(stderr_parts),
        exit_code=exit_code,
    )


async def _find_in_path(ctx: "InterpreterContext", name: str) -> str | None:
    """Search PATH for a command, return its path or None."""
    path_str = ctx.state.env.get("PATH", "")
    if not path_str:
        return None

    for dir_entry in path_str.split(":"):
        if not dir_entry:
            dir_entry = "."
        candidate = f"{dir_entry}/{name}"
        resolved = ctx.fs.resolve_path(ctx.state.cwd, candidate)
        try:
            if await ctx.fs.exists(resolved):
                if not await ctx.fs.is_directory(resolved):
                    return candidate
        except Exception:
            pass

    return None
