"""Main Bash class - the primary API for just-bash.

Example usage:
    from just_bash import Bash

    # Async usage
    bash = Bash()
    result = await bash.exec("echo hello world")
    print(result.stdout)  # "hello world\n"

    # With initial files
    bash = Bash(files={"/data.txt": "hello\\n"})
    result = await bash.exec("cat /data.txt")

    # With execution limits
    bash = Bash(limits=ExecutionLimits(max_command_count=1000))
"""

from typing import Optional

from .commands import create_command_registry
from .commands.registry import create_network_lazy_commands
from .fs import InMemoryFs
from .interpreter import ExitError, Interpreter, InterpreterState, ShellOptions, VariableStore
from .network import make_default_fetch
from .parser import parse, unescape_html_entities
from .parser.parser import ParseException
from .types import (
    Command,
    ExecResult,
    ExecutionLimits,
    IFileSystem,
    NetworkConfig,
    SecureFetch,
)


class Bash:
    """Main Bash interpreter class.

    Provides a high-level API for executing bash scripts in a sandboxed
    environment with an in-memory virtual filesystem.
    """

    def __init__(
        self,
        *,
        fs: Optional[IFileSystem] = None,
        files: Optional[dict[str, str | bytes]] = None,
        cwd: str = "/home/user",
        env: Optional[dict[str, str]] = None,
        limits: Optional[ExecutionLimits] = None,
        network: Optional[NetworkConfig] = None,
        fetch: Optional[SecureFetch] = None,
        timeout_seconds: float = 5.0,
        commands: Optional[dict[str, Command]] = None,
        errexit: bool = False,
        pipefail: bool = False,
        nounset: bool = False,
        unescape_html: bool = True,
    ):
        """Initialize the Bash interpreter.

        Args:
            fs: Filesystem to use. If not provided, creates an InMemoryFs.
            files: Initial files to create (requires default InMemoryFs).
            cwd: Initial working directory.
            env: Additional environment variables.
            limits: Execution limits for security.
            network: Network configuration (for curl command).
            fetch: Custom secure fetch function (for curl command).
            timeout_seconds: Per-command wall-clock timeout budget in seconds (used by sqlite3).
            commands: Custom command registry. If not provided, uses built-in commands.
            errexit: Enable errexit (set -e) mode.
            pipefail: Enable pipefail mode.
            nounset: Enable nounset (set -u) mode.
            unescape_html: Unescape HTML entities in operator positions (default True).
                This helps LLM-generated commands work correctly when they contain
                &lt; instead of <, &gt; instead of >, etc.
        """
        # Set up filesystem
        if fs is not None:
            self._fs = fs
        else:
            self._fs = InMemoryFs(initial_files=files or {})

        # Set up limits
        self._limits = limits or ExecutionLimits()

        # Set up network config
        self._network = network
        self._fetch = fetch or (make_default_fetch(network) if network is not None else None)
        self._timeout_seconds = timeout_seconds

        # Set up commands
        if commands is None:
            self._commands = create_command_registry(include_network=self._fetch is not None)
        else:
            self._commands = dict(commands)
            if self._fetch is not None and "curl" not in self._commands:
                for cmd in create_network_lazy_commands():
                    self._commands[cmd.name] = cmd

        # Set up HTML unescaping
        self._unescape_html = unescape_html

        # Set up initial state
        default_env = VariableStore({
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "HOME": "/home/user",
            "USER": "user",
            "SHELL": "/bin/bash",
            "PWD": cwd,
            "?": "0",
            "SHLVL": "1",
            "BASH_VERSION": "5.0.0(1)-release",
            "OPTIND": "1",
        })
        # Mark default environment variables as exported (visible to subprocesses)
        for var in ("PATH", "HOME", "USER", "SHELL", "PWD", "SHLVL", "BASH_VERSION"):
            default_env.set_attribute(var, "x")
        if env:
            default_env.update(env)
            # Mark user-provided env vars as exported
            for var in env:
                default_env.set_attribute(var, "x")

        self._initial_state = InterpreterState(
            env=default_env,
            cwd=cwd,
            previous_dir="",
            options=ShellOptions(
                errexit=errexit,
                pipefail=pipefail,
                nounset=nounset,
            ),
        )

        # Create interpreter
        self._interpreter = Interpreter(
            fs=self._fs,
            commands=self._commands,
            limits=self._limits,
            state=self._initial_state,
            fetch=self._fetch,
            timeout_seconds=self._timeout_seconds,
        )

    @property
    def fs(self) -> IFileSystem:
        """Get the filesystem."""
        return self._fs

    @property
    def cwd(self) -> str:
        """Get the current working directory."""
        return self._interpreter.state.cwd

    @property
    def env(self) -> dict[str, str]:
        """Get the environment variables."""
        return self._interpreter.state.env

    async def exec(
        self,
        script: str,
        *,
        env: Optional[dict[str, str]] = None,
        cwd: Optional[str] = None,
    ) -> ExecResult:
        """Execute a bash script.

        Args:
            script: The bash script to execute.
            env: Additional environment variables for this execution.
            cwd: Working directory for this execution.

        Returns:
            ExecResult with stdout, stderr, exit_code, and final env.
        """
        # Preprocess HTML entities if enabled
        if self._unescape_html:
            script = unescape_html_entities(script)

        # Parse the script
        try:
            ast = parse(script)
        except ParseException as e:
            return ExecResult(
                stdout="",
                stderr=f"bash: {e}\n",
                exit_code=2,
                env=dict(self._interpreter.state.env),
            )

        # Update state if env/cwd provided
        if env:
            self._interpreter.state.env.update(env)
        if cwd:
            self._interpreter.state.cwd = cwd
            self._interpreter.state.env["PWD"] = cwd

        # Execute
        try:
            return await self._interpreter.execute_script(ast)
        except ExitError as error:
            return ExecResult(
                stdout=error.stdout,
                stderr=error.stderr,
                exit_code=error.exit_code,
                env=dict(self._interpreter.state.env),
            )

    def reset(self) -> None:
        """Reset the interpreter state to initial values."""
        self._interpreter = Interpreter(
            fs=self._fs,
            commands=self._commands,
            limits=self._limits,
            fetch=self._fetch,
            timeout_seconds=self._timeout_seconds,
            state=InterpreterState(
                env=self._initial_state.env.copy() if isinstance(self._initial_state.env, VariableStore) else VariableStore(self._initial_state.env),
                cwd=self._initial_state.cwd,
                previous_dir=self._initial_state.previous_dir,
                options=ShellOptions(
                    errexit=self._initial_state.options.errexit,
                    pipefail=self._initial_state.options.pipefail,
                    nounset=self._initial_state.options.nounset,
                ),
            ),
        )
