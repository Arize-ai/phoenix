"""Mv command implementation.

Usage: mv [OPTION]... SOURCE... DEST

Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.

Options:
  -f, --force      do not prompt before overwriting
  -n, --no-clobber do not overwrite an existing file
  -v, --verbose    explain what is being done
"""

from ...types import CommandContext, ExecResult


class MvCommand:
    """The mv command."""

    name = "mv"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the mv command."""
        force = False
        no_clobber = False
        verbose = False
        paths: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                paths.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--force":
                    force = True
                elif arg == "--no-clobber":
                    no_clobber = True
                elif arg == "--verbose":
                    verbose = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"mv: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                for c in arg[1:]:
                    if c == "f":
                        force = True
                    elif c == "n":
                        no_clobber = True
                    elif c == "v":
                        verbose = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"mv: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            else:
                paths.append(arg)
            i += 1

        if len(paths) < 2:
            if len(paths) == 0:
                return ExecResult(
                    stdout="",
                    stderr="mv: missing file operand\n",
                    exit_code=1,
                )
            return ExecResult(
                stdout="",
                stderr=f"mv: missing destination file operand after '{paths[0]}'\n",
                exit_code=1,
            )

        sources = paths[:-1]
        dest = paths[-1]
        dest_path = ctx.fs.resolve_path(ctx.cwd, dest)

        # Check if destination is a directory
        dest_is_dir = False
        try:
            st = await ctx.fs.stat(dest_path)
            dest_is_dir = st.is_directory
        except FileNotFoundError:
            pass

        # Multiple sources require destination to be a directory
        if len(sources) > 1 and not dest_is_dir:
            return ExecResult(
                stdout="",
                stderr=f"mv: target '{dest}' is not a directory\n",
                exit_code=1,
            )

        stdout = ""
        stderr = ""
        exit_code = 0

        for src in sources:
            try:
                src_path = ctx.fs.resolve_path(ctx.cwd, src)

                # Check source exists
                try:
                    await ctx.fs.stat(src_path)
                except FileNotFoundError:
                    stderr += f"mv: cannot stat '{src}': No such file or directory\n"
                    exit_code = 1
                    continue

                # Determine target path
                if dest_is_dir:
                    basename = src.rstrip("/").split("/")[-1]
                    target_path = ctx.fs.resolve_path(dest_path, basename)
                else:
                    target_path = dest_path

                # Check no-clobber (takes precedence over force)
                if no_clobber:
                    try:
                        await ctx.fs.stat(target_path)
                        # File exists, skip
                        continue
                    except FileNotFoundError:
                        pass

                await ctx.fs.mv(src_path, target_path)
                if verbose:
                    renamed_to = dest if not dest_is_dir else f"{dest}/{src.rstrip('/').split('/')[-1]}"
                    stdout += f"renamed '{src}' -> '{renamed_to}'\n"
            except FileNotFoundError:
                stderr += f"mv: cannot stat '{src}': No such file or directory\n"
                exit_code = 1
            except OSError as e:
                stderr += f"mv: cannot move '{src}': {e}\n"
                exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
