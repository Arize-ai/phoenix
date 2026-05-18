"""
Local Deno sandbox backend.

Stateless (BaseNoSessionBackend) — each execute() call is independent.
Executes code through the local ``deno`` CLI with a default-deny permission
model, granting only exact env-var access for server-injected variables.
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


class DenoSandboxBackend(BaseNoSessionBackend):
    """Sandbox backend executing TypeScript code in a local Deno runtime."""

    def __init__(
        self,
        deno_executable: str,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> None:
        self._deno_executable = deno_executable
        self._user_env: dict[str, str] = dict(user_env or {})
        self.secret_values = compose_secret_values(user_env)

    def _build_command(self) -> list[str]:
        # Deno security docs: permissions are denied by default, but config
        # files can also supply permissions and module loading from remote/npm
        # can still occur unless explicitly disabled.
        # Docs:
        # - https://docs.deno.com/runtime/fundamentals/security/
        # - https://docs.deno.com/runtime/reference/cli/run/
        cmd = [
            self._deno_executable,
            "run",
            "--no-prompt",
            "--no-config",
            "--no-remote",
            "--no-npm",
        ]
        if self._user_env:
            allowed_env_names = ",".join(sorted(self._user_env))
            cmd.append(f"--allow-env={allowed_env_names}")
        cmd.append("-")
        return cmd

    def _build_subprocess_env(self) -> dict[str, str]:
        # Pass only caller-resolved variables through to the child so Deno code
        # cannot observe the Phoenix server's ambient environment.
        return dict(self._user_env)

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        proc: asyncio.subprocess.Process | None = None
        cmd = self._build_command()
        exec_timeout = timeout if timeout is not None else 30

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
                "Deno executable not found. Install Deno and ensure the `deno` binary is on PATH."
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
        deno_executable = shutil.which("deno")
        if deno_executable is None:
            raise ValueError(
                "Deno is not installed. Install Deno and ensure the `deno` binary is on PATH."
            )
        return DenoSandboxBackend(deno_executable=deno_executable, user_env=user_env)
