"""Rmdir command implementation.

Usage: rmdir [OPTION]... DIRECTORY...

Remove empty directories.

Options:
  -p, --parents   remove DIRECTORY and its ancestors
  -v, --verbose   output a diagnostic for every directory processed
"""

from ...types import CommandContext, ExecResult


class RmdirCommand:
    """The rmdir command."""

    name = "rmdir"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the rmdir command."""
        parents = False
        verbose = False
        directories: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                directories.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--parents":
                    parents = True
                elif arg == "--verbose":
                    verbose = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"rmdir: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                for c in arg[1:]:
                    if c == "p":
                        parents = True
                    elif c == "v":
                        verbose = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"rmdir: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            else:
                directories.append(arg)
            i += 1

        if not directories:
            return ExecResult(
                stdout="",
                stderr="rmdir: missing operand\n",
                exit_code=1,
            )

        stdout = ""
        stderr = ""
        exit_code = 0

        for directory in directories:
            result = await self._rmdir_one(
                ctx, directory, parents, verbose
            )
            stdout += result.stdout
            stderr += result.stderr
            if result.exit_code != 0:
                exit_code = result.exit_code

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)

    async def _rmdir_one(
        self,
        ctx: CommandContext,
        directory: str,
        parents: bool,
        verbose: bool,
    ) -> ExecResult:
        """Remove a single directory (and optionally its parents)."""
        path = ctx.fs.resolve_path(ctx.cwd, directory)
        stdout = ""
        stderr = ""

        # Get list of directories to remove
        dirs_to_remove = [path]
        if parents:
            # Add parent directories up to root
            current = path
            while True:
                parent = self._dirname(current)
                if parent == current or parent == "/":
                    break
                dirs_to_remove.append(parent)
                current = parent

        # Try to remove directories
        for dir_path in dirs_to_remove:
            try:
                # Check if path exists
                try:
                    stat = await ctx.fs.stat(dir_path)
                except FileNotFoundError:
                    return ExecResult(
                        stdout=stdout,
                        stderr=stderr + f"rmdir: failed to remove '{dir_path}': No such file or directory\n",
                        exit_code=1,
                    )

                if not stat.is_directory:
                    return ExecResult(
                        stdout=stdout,
                        stderr=stderr + f"rmdir: failed to remove '{dir_path}': Not a directory\n",
                        exit_code=1,
                    )

                # Check if directory is empty
                contents = await ctx.fs.readdir(dir_path)
                if contents:
                    return ExecResult(
                        stdout=stdout,
                        stderr=stderr + f"rmdir: failed to remove '{dir_path}': Directory not empty\n",
                        exit_code=1,
                    )

                # Remove the directory
                await ctx.fs.rm(dir_path)

                if verbose:
                    stdout += f"rmdir: removing directory, '{dir_path}'\n"

            except OSError as e:
                return ExecResult(
                    stdout=stdout,
                    stderr=stderr + f"rmdir: failed to remove '{dir_path}': {e}\n",
                    exit_code=1,
                )

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=0)

    def _dirname(self, path: str) -> str:
        """Get the directory name of a path."""
        if path == "/":
            return "/"
        path = path.rstrip("/")
        last_slash = path.rfind("/")
        if last_slash == -1:
            return "."
        if last_slash == 0:
            return "/"
        return path[:last_slash]
