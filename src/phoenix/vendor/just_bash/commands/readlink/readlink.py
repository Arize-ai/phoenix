"""Readlink command implementation."""

from ...types import CommandContext, ExecResult


class ReadlinkCommand:
    """The readlink command."""

    name = "readlink"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the readlink command."""
        canonicalize = False
        paths: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg in ("-f", "--canonicalize", "-e", "--canonicalize-existing"):
                canonicalize = True
            elif arg == "--help":
                return ExecResult(
                    stdout="Usage: readlink [OPTION]... FILE...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg == "--":
                paths.extend(args[i + 1:])
                break
            elif arg.startswith("-") and len(arg) > 1:
                return ExecResult(
                    stdout="",
                    stderr=f"readlink: invalid option -- '{arg[1]}'\n",
                    exit_code=1,
                )
            else:
                paths.append(arg)
            i += 1

        if not paths:
            return ExecResult(
                stdout="",
                stderr="readlink: missing operand\n",
                exit_code=1,
            )

        stdout_parts = []
        stderr = ""
        exit_code = 0

        for path in paths:
            try:
                resolved = ctx.fs.resolve_path(ctx.cwd, path)
                # Use lstat to not follow symlinks
                stat = await ctx.fs.lstat(resolved)

                if canonicalize:
                    # Return the canonical path (fully resolved)
                    canonical = await ctx.fs.realpath(resolved)
                    stdout_parts.append(canonical)
                else:
                    # Only works on symlinks
                    if stat.is_symbolic_link:
                        target = await ctx.fs.readlink(resolved)
                        stdout_parts.append(target)
                    else:
                        stderr += f"readlink: {path}: Not a symbolic link\n"
                        exit_code = 1
            except FileNotFoundError:
                stderr += f"readlink: {path}: No such file or directory\n"
                exit_code = 1
            except Exception as e:
                stderr += f"readlink: {path}: {e}\n"
                exit_code = 1

        stdout = "\n".join(stdout_parts)
        if stdout:
            stdout += "\n"

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
