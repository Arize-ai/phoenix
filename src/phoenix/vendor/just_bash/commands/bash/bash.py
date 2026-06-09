"""Bash and sh command implementations."""

from ...types import CommandContext, ExecResult


class BashCommand:
    """The bash command - execute shell commands or scripts."""

    name = "bash"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the bash command."""
        if "--help" in args:
            return ExecResult(
                stdout=(
                    "Usage: bash [OPTIONS] [SCRIPT_FILE] [ARGUMENTS...]\n"
                    "Execute shell commands or scripts.\n\n"
                    "Options:\n"
                    "  -c COMMAND  execute COMMAND string\n"
                    "      --help  display this help and exit\n\n"
                    "Without -c, reads and executes commands from SCRIPT_FILE.\n"
                ),
                stderr="",
                exit_code=0,
            )

        # Parse flags before -c or script file
        # Flags that take an argument
        flags_with_arg = {"--rcfile", "--init-file", "-O", "+O", "-o", "+o"}
        # Flags that don't take an argument
        flags_no_arg = {
            "--norc", "--noprofile", "--noediting", "--posix", "--verbose",
            "--login", "-i", "-l", "-r", "-s", "-D", "--dump-strings",
            "--debugger", "--dump-po-strings",
        }
        # Single-letter flags that can appear as -x, -e, -u, etc.
        single_letter_flags = set("abefhkmnprtuvxBCEHPT")

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-c":
                # Found -c flag
                if i + 1 < len(args):
                    command = args[i + 1]
                    rest = args[i + 2:]
                    script_name = rest[0] if rest else "bash"
                    script_args = rest[1:] if len(rest) > 1 else []
                    return await self._execute_script(command, script_name, script_args, ctx)
                else:
                    return ExecResult(
                        stdout="", stderr="bash: -c: option requires an argument\n",
                        exit_code=2,
                    )
            elif arg in flags_with_arg:
                i += 2  # skip flag and its argument
            elif arg in flags_no_arg:
                i += 1
            elif arg.startswith("-") and len(arg) == 2 and arg[1] in single_letter_flags:
                i += 1
            elif arg.startswith("+") and len(arg) == 2 and arg[1] in single_letter_flags:
                i += 1
            elif arg == "--":
                i += 1
                break  # end of options
            else:
                break  # not a recognized flag, treat as script file

        remaining = args[i:]

        # No arguments - in real bash this would be interactive mode
        if not remaining:
            return ExecResult(stdout="", stderr="", exit_code=0)

        # Read and execute script file
        script_path = remaining[0]
        script_args = remaining[1:]

        try:
            full_path = ctx.fs.resolve_path(ctx.cwd, script_path)
            script_content = await ctx.fs.read_file(full_path)
            return await self._execute_script(script_content, script_path, script_args, ctx)
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"bash: {script_path}: No such file or directory\n",
                exit_code=127,
            )

    async def _execute_script(
        self,
        script: str,
        script_name: str,
        script_args: list[str],
        ctx: CommandContext,
    ) -> ExecResult:
        """Execute a script with positional parameters."""
        if not ctx.exec:
            return ExecResult(
                stdout="",
                stderr="bash: internal error: exec function not available\n",
                exit_code=1,
            )

        # Build positional parameters for the exec env option
        positional_env: dict[str, str] = {
            "0": script_name,
            "#": str(len(script_args)),
            "@": " ".join(script_args),
            "*": " ".join(script_args),
        }
        for i, arg in enumerate(script_args):
            positional_env[str(i + 1)] = arg

        # Skip shebang line if present
        script_to_run = script
        if script_to_run.startswith("#!"):
            first_newline = script_to_run.find("\n")
            if first_newline != -1:
                script_to_run = script_to_run[first_newline + 1:]

        # Process the script line by line, filtering out comments and empty lines
        lines = script_to_run.split("\n")
        commands: list[str] = []
        for line in lines:
            trimmed = line.strip()
            # Skip empty lines and comment lines
            if trimmed and not trimmed.startswith("#"):
                commands.append(trimmed)

        # Execute all commands joined by semicolons
        command_string = "; ".join(commands)
        result = await ctx.exec(command_string, {"env": positional_env, "cwd": ctx.cwd})
        return result


class ShCommand:
    """The sh command - execute shell commands or scripts (POSIX shell)."""

    name = "sh"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the sh command."""
        if "--help" in args:
            return ExecResult(
                stdout=(
                    "Usage: sh [OPTIONS] [SCRIPT_FILE] [ARGUMENTS...]\n"
                    "Execute shell commands or scripts (POSIX shell).\n\n"
                    "Options:\n"
                    "  -c COMMAND  execute COMMAND string\n"
                    "      --help  display this help and exit\n\n"
                    "Without -c, reads and executes commands from SCRIPT_FILE.\n"
                ),
                stderr="",
                exit_code=0,
            )

        # Same flag parsing as bash
        flags_with_arg = {"--rcfile", "--init-file", "-O", "+O", "-o", "+o"}
        flags_no_arg = {
            "--norc", "--noprofile", "--noediting", "--posix", "--verbose",
            "--login", "-i", "-l", "-r", "-s", "-D",
        }
        single_letter_flags = set("abefhkmnprtuvxBCEHPT")

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "-c":
                if i + 1 < len(args):
                    command = args[i + 1]
                    rest = args[i + 2:]
                    script_name = rest[0] if rest else "sh"
                    script_args = rest[1:] if len(rest) > 1 else []
                    return await self._execute_script(command, script_name, script_args, ctx)
                else:
                    return ExecResult(
                        stdout="", stderr="sh: -c: option requires an argument\n",
                        exit_code=2,
                    )
            elif arg in flags_with_arg:
                i += 2
            elif arg in flags_no_arg:
                i += 1
            elif arg.startswith("-") and len(arg) == 2 and arg[1] in single_letter_flags:
                i += 1
            elif arg.startswith("+") and len(arg) == 2 and arg[1] in single_letter_flags:
                i += 1
            elif arg == "--":
                i += 1
                break
            else:
                break

        remaining = args[i:]

        if not remaining:
            return ExecResult(stdout="", stderr="", exit_code=0)

        script_path = remaining[0]
        script_args = remaining[1:]

        try:
            full_path = ctx.fs.resolve_path(ctx.cwd, script_path)
            script_content = await ctx.fs.read_file(full_path)
            return await self._execute_script(script_content, script_path, script_args, ctx)
        except FileNotFoundError:
            return ExecResult(
                stdout="",
                stderr=f"sh: {script_path}: No such file or directory\n",
                exit_code=127,
            )

    async def _execute_script(
        self,
        script: str,
        script_name: str,
        script_args: list[str],
        ctx: CommandContext,
    ) -> ExecResult:
        """Execute a script with positional parameters."""
        if not ctx.exec:
            return ExecResult(
                stdout="",
                stderr="sh: internal error: exec function not available\n",
                exit_code=1,
            )

        positional_env: dict[str, str] = {
            "0": script_name,
            "#": str(len(script_args)),
            "@": " ".join(script_args),
            "*": " ".join(script_args),
        }
        for i, arg in enumerate(script_args):
            positional_env[str(i + 1)] = arg

        script_to_run = script
        if script_to_run.startswith("#!"):
            first_newline = script_to_run.find("\n")
            if first_newline != -1:
                script_to_run = script_to_run[first_newline + 1:]

        lines = script_to_run.split("\n")
        commands: list[str] = []
        for line in lines:
            trimmed = line.strip()
            if trimmed and not trimmed.startswith("#"):
                commands.append(trimmed)

        command_string = "; ".join(commands)
        result = await ctx.exec(command_string, {"env": positional_env, "cwd": ctx.cwd})
        return result
