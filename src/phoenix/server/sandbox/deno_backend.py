"""Local Deno sandbox backend; default-deny permissions, no user env vars."""

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

# Global cap across all DenoSandboxBackend instances.
_MAX_CONCURRENT_DENO_EXECUTIONS = 4

# Semaphore is rebuilt per running loop because asyncio.Semaphore binds to the
# loop on first use and tests run on fresh loops.
_execution_slots: asyncio.Semaphore | None = None
_execution_slots_loop: asyncio.AbstractEventLoop | None = None


def _get_execution_slots() -> asyncio.Semaphore:
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
        # Default-deny: also disable config-file permissions and remote/npm
        # module loading. https://docs.deno.com/runtime/fundamentals/security/
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
        # Empty env so the child cannot observe the server's ambient env.
        return {}

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        process: asyncio.subprocess.Process | None = None
        cmd = self._build_command()
        exec_timeout = timeout if timeout is not None else 30

        async with _get_execution_slots():
            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=self._build_subprocess_env(),
                )
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    process.communicate(code.encode("utf-8")),
                    timeout=exec_timeout,
                )
                stdout = stdout_bytes.decode("utf-8", errors="replace")
                stderr = stderr_bytes.decode("utf-8", errors="replace")
                if process.returncode == 0:
                    return ExecutionResult(stdout=stdout, stderr=stderr)
                error = stderr or f"Deno process exited with code {process.returncode}"
                return ExecutionResult(stdout=stdout, stderr=stderr, error=error)
            except asyncio.TimeoutError:
                if process is not None:
                    process.kill()
                    try:
                        await process.wait()
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
            finally:
                # Outer CancelledError (BaseException) bypasses except handlers
                # above, so kill here to prevent orphaned children.
                if process is not None and process.returncode is None:
                    process.kill()

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
        if user_env:
            raise ValueError("Deno sandboxes do not support user-supplied environment variables.")
        deno_executable = shutil.which("deno")
        if deno_executable is None:
            raise ValueError(
                "Deno is not installed. Install Deno and ensure the `deno` binary is on PATH."
            )
        return DenoSandboxBackend(deno_executable=deno_executable)
