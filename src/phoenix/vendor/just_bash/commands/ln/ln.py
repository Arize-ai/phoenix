"""Ln command implementation.

Usage: ln [OPTION]... TARGET LINK_NAME

Create a link to TARGET with the name LINK_NAME.

Options:
  -s, --symbolic   make symbolic links instead of hard links
  -f, --force      remove existing destination files
  -v, --verbose    print name of each linked file
"""

from ...types import CommandContext, ExecResult


class LnCommand:
    """The ln command."""

    name = "ln"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the ln command."""
        symbolic = False
        force = False
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
                if arg == "--symbolic":
                    symbolic = True
                elif arg == "--force":
                    force = True
                elif arg == "--verbose":
                    verbose = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"ln: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-":
                for c in arg[1:]:
                    if c == "s":
                        symbolic = True
                    elif c == "f":
                        force = True
                    elif c == "v":
                        verbose = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"ln: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            else:
                paths.append(arg)
            i += 1

        if len(paths) < 2:
            if len(paths) == 0:
                return ExecResult(
                    stdout="",
                    stderr="ln: missing file operand\n",
                    exit_code=1,
                )
            return ExecResult(
                stdout="",
                stderr=f"ln: missing destination file operand after '{paths[0]}'\n",
                exit_code=1,
            )

        target = paths[0]
        link_name = paths[1]

        target_path = ctx.fs.resolve_path(ctx.cwd, target)
        link_path = ctx.fs.resolve_path(ctx.cwd, link_name)

        stdout = ""
        stderr = ""
        exit_code = 0

        try:
            # For hard links, target must exist
            if not symbolic:
                try:
                    await ctx.fs.stat(target_path)
                except FileNotFoundError:
                    return ExecResult(
                        stdout="",
                        stderr=f"ln: failed to access '{target}': No such file or directory\n",
                        exit_code=1,
                    )

            # Remove existing link if force
            if force:
                try:
                    await ctx.fs.rm(link_path, recursive=False, force=True)
                except (FileNotFoundError, IsADirectoryError):
                    pass

            # Create the link
            if symbolic:
                await ctx.fs.symlink(target, link_path)
            else:
                await ctx.fs.link(target_path, link_path)

            if verbose:
                stdout += f"'{link_name}' -> '{target}'\n"

        except FileExistsError:
            stderr += f"ln: failed to create {'symbolic ' if symbolic else ''}link '{link_name}': File exists\n"
            exit_code = 1
        except FileNotFoundError:
            stderr += f"ln: failed to create {'symbolic ' if symbolic else ''}link '{link_name}': No such file or directory\n"
            exit_code = 1
        except OSError as e:
            stderr += f"ln: failed to create link: {e}\n"
            exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)
