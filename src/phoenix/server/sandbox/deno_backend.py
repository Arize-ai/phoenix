"""
Deno Deploy sandbox backend.

Stateless (BaseNoSessionBackend) — each execute() call is independent.
Requires the ``deno_sandbox`` package (optional extra).
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


class DenoSandboxBackend(BaseNoSessionBackend):
    """Sandbox backend executing TypeScript code via Deno Deploy."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def _get_client(self) -> Any:
        from deno_sandbox import DenoSandbox  # type: ignore[import-not-found]

        return DenoSandbox(api_key=self._api_key)

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


class DenoAdapter(SandboxAdapter):
    key = "DENO"
    display_name = "Deno Deploy"
    supported_languages = ["TYPESCRIPT"]
    env_var_specs = [
        EnvVarSpec(
            name="PHOENIX_SANDBOX_DENO_API_KEY",
            description="Deno Deploy API key",
            required=True,
            secret=True,
        ),
    ]
    config_field_specs: list[ConfigFieldSpec] = []

    def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
        api_key: str = config.get("PHOENIX_SANDBOX_DENO_API_KEY", "")
        return DenoSandboxBackend(api_key=api_key)
