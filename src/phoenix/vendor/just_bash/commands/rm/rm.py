"""Rm command implementation.

Usage: rm [OPTION]... FILE...

Remove (unlink) the FILE(s).

Options:
  -f, --force     ignore nonexistent files and arguments
  -r, -R, --recursive  remove directories and their contents recursively
  -v, --verbose   explain what is being done
"""

from ...types import CommandContext, ExecResult


class RmCommand:
    """The rm command."""

    name = "rm"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the rm command."""
        force = False
        recursive = False
        verbose = False
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--force":
                    force = True
                elif arg == "--recursive":
                    recursive = True
                elif arg == "--verbose":
                    verbose = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"rm: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                for c in arg[1:]:
                    if c == "f":
                        force = True
                    elif c in ("r", "R"):
                        recursive = True
                    elif c == "v":
                        verbose = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"rm: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            else:
                files.append(arg)
            i += 1

        if not files:
            return ExecResult(
                stdout="",
                stderr="rm: missing operand\n",
                exit_code=1,
            )

        stdout = ""
        stderr = ""
        exit_code = 0

        for f in files:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, f)

                # Check if it's a directory
                try:
                    st = await ctx.fs.stat(path)
                    if st.is_directory and not recursive:
                        stderr += f"rm: cannot remove '{f}': Is a directory\n"
                        exit_code = 1
                        continue
                except FileNotFoundError:
                    if force:
                        continue
                    stderr += f"rm: cannot remove '{f}': No such file or directory\n"
                    exit_code = 1
                    continue

                await ctx.fs.rm(path, recursive=recursive, force=force)
                if verbose:
                    stdout += f"removed '{f}'\n"
            except FileNotFoundError:
                if not force:
                    stderr += f"rm: cannot remove '{f}': No such file or directory\n"
                    exit_code = 1
            except OSError as e:
                stderr += f"rm: cannot remove '{f}': {e}\n"
                exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
