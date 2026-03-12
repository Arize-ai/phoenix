from __future__ import annotations

import asyncio
import logging
import shutil
from typing import Any

from .types import (
    BaseNoSessionBackend,
    ConfigFieldSpec,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
)

logger = logging.getLogger(__name__)

# Default Deno permissions: deny all (most restrictive)
# Users can configure permissions via the config field
DEFAULT_PERMISSIONS: list[str] = []


class DenoSandboxBackend(BaseNoSessionBackend):
    """Sandbox backend that executes TypeScript code using Deno.

    Uses Deno's built-in security model with configurable permissions.
    By default, all permissions are denied (equivalent to --allow-none).
    Code is passed via stdin with `-` as the script path.

    Timeout enforcement uses asyncio.wait_for to cancel the subprocess
    if execution exceeds the specified duration.
    """

    def __init__(
        self,
        permissions: list[str] | None = None,
    ) -> None:
        """Initialize the Deno backend.

        Args:
            permissions: List of Deno permission flags (e.g., ["--allow-net", "--allow-read"]).
                        Defaults to empty list (deny all permissions).
        """
        self._permissions = permissions if permissions is not None else DEFAULT_PERMISSIONS

    def _build_command(self) -> list[str]:
        """Build the deno command with security flags."""
        cmd = ["deno", "run", "--no-prompt"]
        cmd.extend(self._permissions)
        # Use `-` to read script from stdin
        cmd.append("-")
        return cmd

    async def _run_subprocess(self, code: str, timeout: float) -> ExecutionResult:
        """Run code in a Deno subprocess."""
        cmd = self._build_command()
        proc = None  # Initialize to avoid UnboundLocalError in exception handler

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(input=code.encode("utf-8")),
                timeout=timeout,
            )

            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")
            exit_code = proc.returncode if proc.returncode is not None else 1

            return ExecutionResult(
                stdout=stdout,
                stderr=stderr,
                exit_code=exit_code,
                error=RuntimeError(stderr) if exit_code != 0 and stderr else None,
            )

        except asyncio.TimeoutError:
            # Kill the process if it's still running
            if proc is not None:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
            return ExecutionResult(
                stdout="",
                stderr=f"Execution timed out after {timeout}s",
                exit_code=-1,
                timed_out=True,
            )
        except FileNotFoundError:
            return ExecutionResult(
                stdout="",
                stderr="Deno executable not found. Please install Deno: https://deno.land",
                exit_code=1,
                error=FileNotFoundError("deno not found in PATH"),
            )
        except Exception as exc:
            return ExecutionResult(
                stdout="",
                stderr=str(exc),
                exit_code=1,
                error=exc,
            )

    async def execute(
        self, code: str, timeout: float = 30.0, *, session_key: str | None = None
    ) -> ExecutionResult:
        return await self._run_subprocess(code, timeout)

    async def close(self) -> None:
        pass


class DenoAdapter(SandboxAdapter):
    _key = "DENO"
    label = "Deno (Local)"
    description = "Runs code evaluators locally using Deno's secure TypeScript runtime."
    python_packages: list[str] = []
    env_vars: list[Any] = []
    config_fields = [
        ConfigFieldSpec(
            key="permissions",
            label="Permissions",
            placeholder="--allow-net,--allow-read=/tmp",
            description="Comma-separated Deno permission flags. Leave empty to deny all.",
        )
    ]
    config_required = False
    setup_instructions = [
        "Install Deno: https://deno.land/manual/getting_started/installation",
        "Verify installation: deno --version",
    ]

    def is_installed(self) -> bool:
        return shutil.which("deno") is not None

    def create_backend(self, config: dict[str, str], credentials: dict[str, str]) -> SandboxBackend:
        permissions_str = config.get("permissions", "")
        permissions: list[str] = DEFAULT_PERMISSIONS
        if permissions_str.strip():
            # Split by comma and strip whitespace
            permissions = [p.strip() for p in permissions_str.split(",") if p.strip()]
        return DenoSandboxBackend(permissions=permissions)
