"""
Vercel sandbox backend.

Stateless (BaseNoSessionBackend) — each execute() call is independent.
Requires the ``vercel_sandbox`` package (optional extra).
Import is deferred to avoid top-level failures when the extra is absent.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from phoenix.config import ENV_PHOENIX_SANDBOX_API_KEY

from .types import (
    BaseNoSessionBackend,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
)

logger = logging.getLogger(__name__)


class VercelSandboxBackend(BaseNoSessionBackend):
    """Sandbox backend executing TypeScript code via Vercel Sandbox."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def _get_client(self) -> Any:
        from vercel_sandbox import Sandbox  # type: ignore[import-not-found]

        return Sandbox(api_key=self._api_key)

    async def execute(
        self,
        code: str,
        session_key: str,
        env: Optional[dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            client = self._get_client()
            run_kwargs: dict[str, Any] = {"env": env or {}}
            if timeout is not None:
                run_kwargs["timeout"] = timeout
            result = await client.run(code, **run_kwargs)
            return ExecutionResult(
                stdout=result.stdout or "",
                stderr=result.stderr or "",
                error=result.error or None,
            )
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def close(self) -> None:
        pass


class VercelAdapter(SandboxAdapter):
    key = "VERCEL"
    display_name = "Vercel Sandbox"
    supported_languages = ["TYPESCRIPT"]

    def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
        api_key: str = (
            config.get("PHOENIX_SANDBOX_VERCEL_API_KEY")
            or os.environ.get("PHOENIX_SANDBOX_VERCEL_API_KEY")
            or os.environ.get(ENV_PHOENIX_SANDBOX_API_KEY)
            or ""
        )
        return VercelSandboxBackend(api_key=api_key)
