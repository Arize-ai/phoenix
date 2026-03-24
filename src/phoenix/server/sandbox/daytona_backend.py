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
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
)

logger = logging.getLogger(__name__)


class DaytonaSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in Daytona workspaces."""

    def __init__(self, api_key: str, server_url: str = "") -> None:
        self._api_key = api_key
        self._server_url = server_url
        self._sessions: dict[str, Any] = {}

    def _get_client(self) -> Any:
        from daytona_sdk import Daytona  # type: ignore[import-not-found]

        return Daytona(api_key=self._api_key, server_url=self._server_url or None)

    async def start_session(self, session_key: str) -> None:
        if session_key in self._sessions:
            logger.debug(f"Daytona session '{session_key}' already exists; reusing")
            return
        client = self._get_client()
        workspace = await client.create()
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
            result = await workspace.process.code_run(code)
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


class DaytonaAdapter(SandboxAdapter):
    key = "DAYTONA"
    display_name = "Daytona"
    supported_languages = ["PYTHON", "TYPESCRIPT"]

    def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
        api_key: str = (
            config.get("PHOENIX_SANDBOX_DAYTONA_API_KEY")
            or os.environ.get("PHOENIX_SANDBOX_DAYTONA_API_KEY")
            or os.environ.get(ENV_PHOENIX_SANDBOX_TOKEN)
            or ""
        )
        server_url: str = config.get("server_url", "")
        return DaytonaSandboxBackend(api_key=api_key, server_url=server_url)
