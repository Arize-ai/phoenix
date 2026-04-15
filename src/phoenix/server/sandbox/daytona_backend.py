"""
Daytona sandbox backend.

Requires the ``daytona_sdk`` package (optional extra).
Import is deferred to avoid top-level failures when the extra is absent.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from phoenix.config import ENV_PHOENIX_SANDBOX_TOKEN

from .types import (
    DaytonaPythonConfig,
    EnvVarSpec,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    UnsupportedOperation,
)

logger = logging.getLogger(__name__)


class DaytonaSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in Daytona workspaces."""

    def __init__(
        self,
        api_key: str,
        server_url: str = "",
        user_env: Optional[dict[str, str]] = None,
        packages: Optional[list[str]] = None,
    ) -> None:
        self._api_key = api_key
        self._server_url = server_url
        self._user_env: dict[str, str] = user_env or {}
        self._packages: list[str] = packages or []
        self._sessions: dict[str, Any] = {}

    def _get_client(self) -> Any:
        from daytona_sdk import Daytona  # type: ignore[import-not-found]

        return Daytona(api_key=self._api_key, server_url=self._server_url or None)

    async def _install_packages(self, workspace: Any) -> None:
        """Run pip install for configured packages before first user execute."""
        if not self._packages:
            return
        pkg_args = " ".join(self._packages)
        install_code = (
            f"import subprocess, sys\n"
            f"r = subprocess.run(\n"
            f"    [sys.executable, '-m', 'pip', 'install', *{self._packages!r}],\n"
            f"    capture_output=True, text=True\n"
            f")\n"
            f"if r.returncode != 0:\n"
            f"    raise RuntimeError(r.stderr)\n"
        )
        result = await workspace.process.code_run(install_code)
        if result.exit_code != 0:
            raise RuntimeError(
                f"pip install {pkg_args!r} failed (exit {result.exit_code}): {result.stderr}"
            )

    async def start_session(self, session_key: str) -> None:
        if session_key in self._sessions:
            logger.debug(f"Daytona session '{session_key}' already exists; reusing")
            return
        client = self._get_client()
        workspace = await client.create()
        await self._install_packages(workspace)
        self._sessions[session_key] = workspace
        logger.debug(f"Started Daytona session '{session_key}'")

    async def stop_session(self, session_key: str) -> None:
        workspace = self._sessions.pop(session_key, None)
        if workspace is not None:
            client = self._get_client()
            await client.remove(workspace)
            logger.debug(f"Stopped Daytona session '{session_key}'")

    async def execute(
        self,
        code: str,
        session_key: str,
        env: Optional[dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        if timeout is not None:
            logger.warning(
                "DaytonaSandboxBackend does not support per-call timeout; ignoring timeout=%d",
                timeout,
            )
        try:
            workspace = self._sessions.get(session_key)
            if workspace is None:
                client = self._get_client()
                workspace = await client.create()
            merged_env = {**self._user_env, **(env or {})}
            result = await workspace.process.code_run(code, envs=merged_env)
            return ExecutionResult(
                stdout=result.stdout or "",
                stderr=result.stderr or "",
                error=result.exit_code != 0 and result.stderr or None,
            )
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def close(self) -> None:
        for key in list(self._sessions):
            await self.stop_session(key)


class DaytonaPythonAdapter(SandboxAdapter):
    key = "DAYTONA_PYTHON"
    display_name = "Daytona (Python)"
    language = "PYTHON"
    config_model = DaytonaPythonConfig
    env_var_specs = [
        EnvVarSpec(
            key="PHOENIX_SANDBOX_DAYTONA_API_KEY",
            display_name="Daytona API Key",
            description="API key for the Daytona sandbox service.",
        ),
    ]

    def build_backend(
        self, config: dict[str, Any], user_env: Optional[dict[str, str]] = None
    ) -> SandboxBackend:
        api_key: str = (
            config.get("PHOENIX_SANDBOX_DAYTONA_API_KEY")
            or os.environ.get("PHOENIX_SANDBOX_DAYTONA_API_KEY")
            or os.environ.get(ENV_PHOENIX_SANDBOX_TOKEN)
            or ""
        )
        internet_access = config.get("internet_access")
        if internet_access is not None:
            mode = (
                internet_access.get("mode")
                if isinstance(internet_access, dict)
                else getattr(internet_access, "mode", None)
            )
            if mode is not None:
                raise UnsupportedOperation(
                    "Daytona backend does not support internet_access configuration. "
                    "Remove the internet_access field or switch to a backend that supports it."
                )
        server_url: str = config.get("server_url", "")
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        return DaytonaSandboxBackend(
            api_key=api_key, server_url=server_url, user_env=user_env, packages=packages
        )
