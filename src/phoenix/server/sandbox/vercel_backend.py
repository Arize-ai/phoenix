"""
Vercel sandbox backend.

Stateless (BaseNoSessionBackend) — each execute() call is independent.
Requires the ``vercel_sandbox`` package (optional extra).
Import is deferred to avoid top-level failures when the extra is absent.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from .types import (
    BaseNoSessionBackend,
    ConfigFieldSpec,
    EnvVarSpec,
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
    ) -> ExecutionResult:
        try:
            client = self._get_client()
            result = await client.run(code, env=env or {})
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
    env_var_specs = [
        EnvVarSpec(
            name="PHOENIX_SANDBOX_VERCEL_API_KEY",
            description="Vercel API key for sandbox access",
            required=True,
            secret=True,
        ),
    ]
    config_field_specs: list[ConfigFieldSpec] = []

    def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
        api_key: str = config.get("PHOENIX_SANDBOX_VERCEL_API_KEY", "")
        return VercelSandboxBackend(api_key=api_key)
