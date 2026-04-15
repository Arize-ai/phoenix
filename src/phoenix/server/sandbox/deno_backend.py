"""
Local Deno sandbox backend.

Stateless (BaseNoSessionBackend) — each execute() call is independent.
Requires the ``deno_sandbox`` package (optional extra).
Import is deferred to avoid top-level failures when the extra is absent.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from phoenix.config import ENV_PHOENIX_SANDBOX_API_KEY

from .types import (
    BaseNoSessionBackend,
    DenoConfig,
    EnvVarSpec,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    UnsupportedOperation,
)

logger = logging.getLogger(__name__)


class DenoSandboxBackend(BaseNoSessionBackend):
    """Sandbox backend executing TypeScript code in a local Deno runtime."""

    def __init__(self, api_key: str, user_env: Optional[dict[str, str]] = None) -> None:
        self._api_key = api_key
        self._user_env: dict[str, str] = user_env or {}

    def _get_client(self) -> Any:
        from deno_sandbox import DenoSandbox  # type: ignore[import-not-found]

        return DenoSandbox(api_key=self._api_key)

    async def execute(
        self,
        code: str,
        session_key: str,
        env: Optional[dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            client = self._get_client()
            merged_env = {**self._user_env, **(env or {})}
            run_kwargs: dict[str, Any] = {"env": merged_env}
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
    env_var_specs = [
        EnvVarSpec(
            key="PHOENIX_SANDBOX_DENO_API_KEY",
            display_name="Deno API Key",
            description="API key for the Deno sandbox service.",
        ),
    ]

    def build_backend(
        self, config: dict[str, Any], user_env: Optional[dict[str, str]] = None
    ) -> SandboxBackend:
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        if packages:
            raise UnsupportedOperation(
                "Deno backend does not support dependency installation. "
                "Use a pre-baked template or switch to a backend that supports dependencies."
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
                    "Deno backend does not support internet_access configuration. "
                    "Remove the internet_access field or switch to a backend that supports it."
                )
        api_key: str = (
            config.get("PHOENIX_SANDBOX_DENO_API_KEY")
            or os.environ.get("PHOENIX_SANDBOX_DENO_API_KEY")
            or os.environ.get(ENV_PHOENIX_SANDBOX_API_KEY)
            or ""
        )
        return DenoSandboxBackend(api_key=api_key, user_env=user_env)
