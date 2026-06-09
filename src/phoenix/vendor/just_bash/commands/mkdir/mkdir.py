"""Mkdir command implementation.

Usage: mkdir [OPTION]... DIRECTORY...

Create the DIRECTORY(ies), if they do not already exist.

Options:
  -p, --parents  make parent directories as needed
  -v, --verbose  print a message for each created directory
"""

from ...types import CommandContext, ExecResult


class MkdirCommand:
    """The mkdir command."""

    name = "mkdir"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the mkdir command."""
        recursive = False
        verbose = False
        dirs: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                dirs.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--parents":
                    recursive = True
                elif arg == "--verbose":
                    verbose = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"mkdir: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                for c in arg[1:]:
                    if c == "p":
                        recursive = True
                    elif c == "v":
                        verbose = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"mkdir: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            else:
                dirs.append(arg)
            i += 1

        if not dirs:
            return ExecResult(
                stdout="",
                stderr="mkdir: missing operand\n",
                exit_code=1,
            )

        stdout = ""
        stderr = ""
        exit_code = 0

        for d in dirs:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, d)
                await ctx.fs.mkdir(path, recursive=recursive)
                if verbose:
                    stdout += f"mkdir: created directory '{d}'\n"
            except (FileExistsError, OSError) as e:
                if "EEXIST" in str(e) or isinstance(e, FileExistsError):
                    if not recursive:
                        stderr += f"mkdir: cannot create directory '{d}': File exists\n"
                        exit_code = 1
                elif "ENOENT" in str(e):
                    stderr += f"mkdir: cannot create directory '{d}': No such file or directory\n"
                    exit_code = 1
                else:
                    stderr += f"mkdir: cannot create directory '{d}': {e}\n"
                    exit_code = 1
            except FileNotFoundError:
                stderr += f"mkdir: cannot create directory '{d}': No such file or directory\n"
                exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
