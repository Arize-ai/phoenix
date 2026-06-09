"""Env and printenv command implementations."""

from ...types import CommandContext, ExecResult


class EnvCommand:
    """The env command - run a command with modified environment."""

    name = "env"

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the env command."""
        ignore_environment = False
        unset_vars: list[str] = []
        set_vars: dict[str, str] = {}
        command: list[str] = []

        i = 0
        while i < len(args):
            arg = args[i]

            if arg == "--help":
                return ExecResult(
                    stdout=(
                        "Usage: env [OPTION]... [NAME=VALUE]... [COMMAND [ARG]...]\n"
                        "Set each NAME to VALUE in the environment and run COMMAND.\n\n"
                        "Options:\n"
                        "  -i, --ignore-environment  start with an empty environment\n"
                        "  -u, --unset=NAME          remove variable from the environment\n"
                        "      --help                display this help and exit\n"
                    ),
                    stderr="",
                    exit_code=0,
                )
            elif arg in ("-i", "--ignore-environment"):
                ignore_environment = True
            elif arg == "-u" and i + 1 < len(args):
                i += 1
                unset_vars.append(args[i])
            elif arg.startswith("-u"):
                unset_vars.append(arg[2:])
            elif arg.startswith("--unset="):
                unset_vars.append(arg[8:])
            elif arg == "--unset" and i + 1 < len(args):
                i += 1
                unset_vars.append(args[i])
            elif arg == "--":
                # Everything after -- is the command
                command = args[i + 1:]
                break
            elif "=" in arg and not arg.startswith("-"):
                # NAME=VALUE assignment
                eq_idx = arg.index("=")
                name = arg[:eq_idx]
                value = arg[eq_idx + 1:]
                set_vars[name] = value
            elif arg.startswith("-"):
                # Unknown option
                return ExecResult(
                    stdout="",
                    stderr=f"env: invalid option -- '{arg[1:]}'\n",
                    exit_code=1,
                )
            else:
                # Start of command
                command = args[i:]
                break
            i += 1

        # Build the environment
        if ignore_environment:
            new_env = {}
        else:
            new_env = dict(ctx.env)

        # Remove unset variables
        for var in unset_vars:
            new_env.pop(var, None)

        # Add new variables
        new_env.update(set_vars)

        # If no command, print the environment
        if not command:
            lines = [f"{k}={v}" for k, v in sorted(new_env.items())]
            return ExecResult(
                stdout="\n".join(lines) + "\n" if lines else "",
                stderr="",
                exit_code=0,
            )

        # Execute the command with the new environment
        if not ctx.exec:
            return ExecResult(
                stdout="",
                stderr="env: cannot execute commands\n",
                exit_code=126,
            )

        # Quote arguments properly for shell execution
        def quote(s: str) -> str:
            if not s or any(c in s for c in " \t\n'\"\\$`!"):
                return "'" + s.replace("'", "'\"'\"'") + "'"
            return s

        cmd_str = " ".join(quote(c) for c in command)

        try:
            result = await ctx.exec(cmd_str, {"cwd": ctx.cwd, "env": new_env})
            return result
        except Exception as e:
            return ExecResult(
                stdout="",
                stderr=f"env: {e}\n",
                exit_code=1,
            )


class PrintenvCommand:
    """The printenv command - print environment variables.

    This simulates subprocess behavior - only exported variables are visible.
    """

    name = "printenv"

    def _is_exported(self, ctx: CommandContext, name: str) -> bool:
        """Check if a variable is exported (visible to subprocesses)."""
        # Import here to avoid circular imports
        from ...interpreter.types import VariableStore
        if isinstance(ctx.env, VariableStore):
            return "x" in ctx.env.get_attributes(name)
        # If not a VariableStore, assume all variables are exported (backwards compat)
        return True

    async def execute(self, args: list[str], ctx: CommandContext) -> ExecResult:
        """Execute the printenv command."""
        var_names: list[str] = []

        for arg in args:
            if arg == "--help":
                return ExecResult(
                    stdout="Usage: printenv [OPTION]... [VARIABLE]...\n",
                    stderr="",
                    exit_code=0,
                )
            elif arg.startswith("-"):
                pass  # Ignore options
            else:
                var_names.append(arg)

        if not var_names:
            # Print all exported variables
            lines = []
            for k, v in sorted(ctx.env.items()):
                if self._is_exported(ctx, k):
                    lines.append(f"{k}={v}")
            return ExecResult(
                stdout="\n".join(lines) + "\n" if lines else "",
                stderr="",
                exit_code=0,
            )

        # Print specific variables (only if exported)
        output_lines = []
        exit_code = 0

        for name in var_names:
            if name in ctx.env and self._is_exported(ctx, name):
                output_lines.append(ctx.env[name])
            else:
                exit_code = 1

        output = "\n".join(output_lines)
        if output:
            output += "\n"

        return ExecResult(stdout=output, stderr="", exit_code=exit_code)
