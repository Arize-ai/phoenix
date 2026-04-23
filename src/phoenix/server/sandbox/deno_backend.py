"""
Local Deno sandbox backend.

Stateless (BaseNoSessionBackend) — each execute() call is independent.
Requires the ``deno_sandbox`` package (optional extra).
Import is deferred to avoid top-level failures when the extra is absent.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from .types import (
    BaseNoSessionBackend,
    DenoConfig,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
)

logger = logging.getLogger(__name__)


class DenoSandboxBackend(BaseNoSessionBackend):
    """Sandbox backend executing TypeScript code in a local Deno runtime."""

    def __init__(self, user_env: Optional[dict[str, str]] = None) -> None:
        self._user_env: dict[str, str] = user_env or {}

    def _get_client(self) -> Any:
        from deno_sandbox import DenoSandbox  # type: ignore[import-not-found]

        return DenoSandbox()

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            client = self._get_client()
            run_kwargs: dict[str, Any] = {"env": self._user_env}
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


class DenoAdapter(SandboxAdapter):
    key = "DENO"
    display_name = "Deno (local)"
    language = "TYPESCRIPT"
    config_model = DenoConfig

    def build_backend(
        self, config: dict[str, Any], user_env: Optional[dict[str, str]] = None
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        return DenoSandboxBackend(user_env=user_env)
