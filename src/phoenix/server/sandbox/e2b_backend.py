"""
E2B sandbox backend.

Requires the ``e2b_code_interpreter`` package (optional extra).
Import is deferred to avoid top-level failures when the extra is absent.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from phoenix.config import ENV_PHOENIX_SANDBOX_API_KEY

from .types import (
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
)

logger = logging.getLogger(__name__)


class E2BSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in E2B cloud sandboxes.

    Supports named sessions via start_session/stop_session for sandbox reuse
    across multiple execute() calls, or ephemeral execution (no session) which
    spins up a fresh sandbox per call.
    """

    def __init__(
        self,
        api_key: str,
        template: str = "base",
    ) -> None:
        self._api_key = api_key
        self._template = template
        self._sessions: dict[str, Any] = {}

    def _get_sandbox_cls(self) -> Any:
        from e2b_code_interpreter import AsyncSandbox  # type: ignore[import-not-found]

        return AsyncSandbox

    async def start_session(self, session_key: str) -> None:
        if session_key in self._sessions:
            logger.debug(f"E2B session '{session_key}' already exists; reusing")
            return
        AsyncSandbox = self._get_sandbox_cls()
        sandbox = await AsyncSandbox.create(api_key=self._api_key, template=self._template)
        self._sessions[session_key] = sandbox
        logger.debug(f"Started E2B session '{session_key}'")

    async def stop_session(self, session_key: str) -> None:
        sandbox = self._sessions.pop(session_key, None)
        if sandbox is not None:
            await sandbox.close()
            logger.debug(f"Stopped E2B session '{session_key}'")

    async def execute(
        self,
        code: str,
        session_key: str,
        env: Optional[dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        AsyncSandbox = self._get_sandbox_cls()
        try:
            sandbox = self._sessions.get(session_key)
            run_kwargs: dict[str, Any] = {"envs": env or {}}
            if timeout is not None:
                run_kwargs["timeout"] = timeout
            if sandbox is not None:
                execution = await sandbox.run_code(code, **run_kwargs)
            else:
                # Ephemeral: spin up a fresh sandbox, run, then close.
                async with await AsyncSandbox.create(
                    api_key=self._api_key, template=self._template
                ) as sb:
                    execution = await sb.run_code(code, **run_kwargs)

            stdout = "\n".join(execution.logs.stdout) if execution.logs.stdout else ""
            stderr = "\n".join(execution.logs.stderr) if execution.logs.stderr else ""
            error_str: Optional[str] = str(execution.error) if execution.error else None

            return ExecutionResult(
                stdout=stdout,
                stderr=stderr,
                error=error_str,
            )
        except Exception as exc:
            return ExecutionResult(
                stdout="",
                stderr=str(exc),
                error=str(exc),
            )

    async def close(self) -> None:
        for key in list(self._sessions):
            await self.stop_session(key)


class E2BAdapter(SandboxAdapter):
    key = "E2B"
    display_name = "E2B"
    supported_languages = ["PYTHON"]

    def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
        api_key: str = (
            config.get("PHOENIX_SANDBOX_E2B_API_KEY")
            or os.environ.get("PHOENIX_SANDBOX_E2B_API_KEY")
            or os.environ.get(ENV_PHOENIX_SANDBOX_API_KEY)
            or ""
        )
        template: str = config.get("template", "base")
        return E2BSandboxBackend(api_key=api_key, template=template)
