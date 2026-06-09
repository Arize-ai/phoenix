"""Chmod command implementation.

Usage: chmod [OPTION]... MODE FILE...

Change the mode of each FILE to MODE.

MODE can be:
  - Octal number (e.g., 755, 644)
  - Symbolic mode (e.g., u+x, g-w, o=r, a+x)

Options:
  -R, --recursive  change files and directories recursively
  -v, --verbose    output a diagnostic for every file processed
"""

import re
from ...types import CommandContext, ExecResult


class ChmodCommand:
    """The chmod command."""

    name = "chmod"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the chmod command."""
        recursive = False
        verbose = False
        mode_str = None
        files: list[str] = []

        # Parse arguments
        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--":
                files.extend(args[i + 1:])
                break
            elif arg.startswith("--"):
                if arg == "--recursive":
                    recursive = True
                elif arg == "--verbose":
                    verbose = True
                else:
                    return ExecResult(
                        stdout="",
                        stderr=f"chmod: unrecognized option '{arg}'\n",
                        exit_code=1,
                    )
            elif arg.startswith("-") and arg != "-" and not re.match(r'^-[0-7]+$', arg):
                for c in arg[1:]:
                    if c == "R":
                        recursive = True
                    elif c == "v":
                        verbose = True
                    else:
                        return ExecResult(
                            stdout="",
                            stderr=f"chmod: invalid option -- '{c}'\n",
                            exit_code=1,
                        )
            elif mode_str is None:
                mode_str = arg
            else:
                files.append(arg)
            i += 1

        if mode_str is None:
            return ExecResult(
                stdout="",
                stderr="chmod: missing operand\n",
                exit_code=1,
            )

        if not files:
            return ExecResult(
                stdout="",
                stderr=f"chmod: missing operand after '{mode_str}'\n",
                exit_code=1,
            )

        stdout = ""
        stderr = ""
        exit_code = 0

        for f in files:
            try:
                path = ctx.fs.resolve_path(ctx.cwd, f)
                await self._chmod_path(ctx, path, mode_str, recursive, verbose, f)
                if verbose:
                    stdout += f"mode of '{f}' changed\n"
            except FileNotFoundError:
                stderr += f"chmod: cannot access '{f}': No such file or directory\n"
                exit_code = 1
            except ValueError as e:
                stderr += f"chmod: invalid mode: '{mode_str}'\n"
                exit_code = 1
            except OSError as e:
                stderr += f"chmod: changing permissions of '{f}': {e}\n"
                exit_code = 1

        return ExecResult(stdout=stdout, stderr=stderr, exit_code=exit_code)

    async def _chmod_path(
        self,
        ctx: CommandContext,
        path: str,
        mode_str: str,
        recursive: bool,
        verbose: bool,
        display_name: str,
    ) -> None:
        """Change mode of a path, optionally recursively."""
        # Get current stat
        st = await ctx.fs.stat(path)
        current_mode = st.mode & 0o7777  # Get permission bits

        # Calculate new mode
        new_mode = self._parse_mode(mode_str, current_mode)

        # Apply mode
        await ctx.fs.chmod(path, new_mode)

        # Recurse into directories
        if recursive and st.is_directory:
            entries = await ctx.fs.readdir(path)
            for entry in entries:
                child_path = f"{path}/{entry}"
                child_name = f"{display_name}/{entry}"
                await self._chmod_path(ctx, child_path, mode_str, recursive, verbose, child_name)

    def _parse_mode(self, mode_str: str, current_mode: int) -> int:
        """Parse mode string and return numeric mode."""
        # Try octal first
        if re.match(r'^[0-7]+$', mode_str):
            return int(mode_str, 8)

        # Symbolic mode parsing
        # Format: [ugoa]*([-+=]([rwxXst]*|[ugo]))+
        new_mode = current_mode

        # Split into clauses separated by commas
        for clause in mode_str.split(","):
            new_mode = self._apply_symbolic_mode(clause.strip(), new_mode)

        return new_mode

    def _apply_symbolic_mode(self, clause: str, current_mode: int) -> int:
        """Apply a single symbolic mode clause."""
        # Parse who (ugoa)
        who_chars = ""
        i = 0
        while i < len(clause) and clause[i] in "ugoa":
            who_chars += clause[i]
            i += 1

        # Default to 'a' if no who specified
        if not who_chars:
            who_chars = "a"

        # Parse operations
        while i < len(clause):
            if clause[i] not in "+-=":
                raise ValueError(f"Invalid operator in mode: {clause[i]}")

            op = clause[i]
            i += 1

            # Parse permissions
            perm_bits = 0
            while i < len(clause) and clause[i] in "rwxXst":
                c = clause[i]
                if c == "r":
                    perm_bits |= 0o4
                elif c == "w":
                    perm_bits |= 0o2
                elif c == "x":
                    perm_bits |= 0o1
                elif c == "X":
                    # Execute only if directory or already executable
                    if current_mode & 0o111:
                        perm_bits |= 0o1
                elif c == "s":
                    # setuid/setgid - not fully implemented
                    pass
                elif c == "t":
                    # sticky bit - not fully implemented
                    pass
                i += 1

            # Calculate mask based on who
            mask = 0
            if "u" in who_chars or "a" in who_chars:
                mask |= perm_bits << 6
            if "g" in who_chars or "a" in who_chars:
                mask |= perm_bits << 3
            if "o" in who_chars or "a" in who_chars:
                mask |= perm_bits

            # Apply operation
            if op == "+":
                current_mode |= mask
            elif op == "-":
                current_mode &= ~mask
            elif op == "=":
                # Clear and set
                clear_mask = 0
                if "u" in who_chars or "a" in who_chars:
                    clear_mask |= 0o700
                if "g" in who_chars or "a" in who_chars:
                    clear_mask |= 0o070
                if "o" in who_chars or "a" in who_chars:
                    clear_mask |= 0o007
                current_mode = (current_mode & ~clear_mask) | mask

        return current_mode
