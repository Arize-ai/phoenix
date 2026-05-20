"""
Local Deno sandbox backend.

Stateless (BaseNoSessionBackend) — each execute() call is independent.
Executes code through the local ``deno`` CLI with a default-deny permission
model. Deno sandboxes intentionally never receive any user-supplied
environment variables.

Each execute() spawns a ``deno`` child process on the Phoenix server host,
consuming the server's own CPU/memory. A module-level semaphore caps the
number of concurrent Deno subprocesses across every backend instance so an
unbounded fan-out (e.g. a large experiment) cannot exhaust host resources.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
from typing import Mapping, Optional

from .types import (
    BaseNoSessionBackend,
    DenoConfig,
    DenoDeployment,
    ExecutionResult,
    NoCredentials,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
)

logger = logging.getLogger(__name__)

# Upper bound on Deno subprocesses running concurrently on the Phoenix host,
# shared across every DenoSandboxBackend instance (build_backend() mints a
# fresh instance per call, so a per-instance cap would not bound global
# concurrency).
_MAX_CONCURRENT_DENO_EXECUTIONS = 4

# Lazily created and rebound per running event loop. asyncio.Semaphore binds to
# the loop on first use; constructing it at import time would fail tests that
# each run on a fresh loop. Production has a single long-lived loop, so this
# resolves to a process-wide singleton there.
_execution_slots: asyncio.Semaphore | None = None
_execution_slots_loop: asyncio.AbstractEventLoop | None = None


def _get_execution_slots() -> asyncio.Semaphore:
    """Return the concurrency-limiting semaphore bound to the running loop."""
    global _execution_slots, _execution_slots_loop
    loop = asyncio.get_running_loop()
    if _execution_slots is None or _execution_slots_loop is not loop:
        _execution_slots = asyncio.Semaphore(_MAX_CONCURRENT_DENO_EXECUTIONS)
        _execution_slots_loop = loop
    return _execution_slots


class DenoSandboxBackend(BaseNoSessionBackend):
    """Sandbox backend executing TypeScript code in a local Deno runtime."""

    def __init__(self, deno_executable: str) -> None:
        self._deno_executable = deno_executable
        self.secret_values = compose_secret_values(None)

    def _build_command(self) -> list[str]:
        # Deno security docs: permissions are denied by default, but config
        # files can also supply permissions and module loading from remote/npm
        # can still occur unless explicitly disabled.
        # Docs:
        # - https://docs.deno.com/runtime/fundamentals/security/
        # - https://docs.deno.com/runtime/reference/cli/run/
        return [
            self._deno_executable,
            "run",
            "--no-prompt",
            "--no-config",
            "--no-remote",
            "--no-npm",
            "-",
        ]

    def _build_subprocess_env(self) -> dict[str, str]:
        # Deno child runs with an empty environment so it cannot observe the
        # Phoenix server's ambient process env. User-supplied env vars are
        # intentionally not supported for Deno sandboxes.
        return {}

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        proc: asyncio.subprocess.Process | None = None
        cmd = self._build_command()
        exec_timeout = timeout if timeout is not None else 30

        # Hold a slot for the lifetime of the subprocess so concurrent Deno
        # executions on the host stay bounded. Waiters queue here as cheap
        # coroutines; the working timeout below guarantees slots free up.
        async with _get_execution_slots():
            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=self._build_subprocess_env(),
                )
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(code.encode("utf-8")),
                    timeout=exec_timeout,
                )
                stdout = stdout_bytes.decode("utf-8", errors="replace")
                stderr = stderr_bytes.decode("utf-8", errors="replace")
                if proc.returncode == 0:
                    return ExecutionResult(stdout=stdout, stderr=stderr)
                error = stderr or f"Deno process exited with code {proc.returncode}"
                return ExecutionResult(stdout=stdout, stderr=stderr, error=error)
            except asyncio.TimeoutError:
                if proc is not None:
                    proc.kill()
                    try:
                        await proc.wait()
                    except Exception:
                        logger.debug("Timed-out Deno process failed to exit cleanly", exc_info=True)
                message = f"Execution timed out after {exec_timeout}s"
                return ExecutionResult(stdout="", stderr=message, error=message)
            except FileNotFoundError:
                message = (
                    "Deno executable not found. "
                    "Install Deno and ensure the `deno` binary is on PATH."
                )
                return ExecutionResult(stdout="", stderr=message, error=message)
            except Exception as exc:
                return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def close(self) -> None:
        pass


class DenoAdapter(SandboxAdapter[DenoConfig, NoCredentials, DenoDeployment]):
    backend_type = "DENO"
    display_name = "Deno"
    hosting_type = "local"
    dependency_hints = (
        "Install the Deno runtime and ensure the `deno` binary is available on PATH.",
    )
    config_model = DenoConfig
    credentials_model = NoCredentials
    deployment_config_model = DenoDeployment

    def build_backend(
        self,
        config: DenoConfig,
        *,
        credentials: NoCredentials,
        deployment: DenoDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        # Deno sandboxes do not accept user-supplied environment variables.
        # DenoConfig does not compose SupportsEnvVars, so SecretsContext should
        # already resolve an empty mapping here; reject anything else as
        # defense-in-depth.
        if user_env:
            raise ValueError("Deno sandboxes do not support user-supplied environment variables.")
        deno_executable = shutil.which("deno")
        if deno_executable is None:
            raise ValueError(
                "Deno is not installed. Install Deno and ensure the `deno` binary is on PATH."
            )
        return DenoSandboxBackend(deno_executable=deno_executable)
