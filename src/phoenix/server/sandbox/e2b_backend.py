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
    E2BConfig,
    EnvVarSpec,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    UnsupportedOperation,
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
        cwd: Optional[str] = None,
        metadata: Optional[str] = None,
        user_env: Optional[dict[str, str]] = None,
    ) -> None:
        self._api_key = api_key
        self._template = template
        self._cwd = cwd
        self._metadata = metadata
        self._user_env: dict[str, str] = user_env or {}
        self._sessions: dict[str, Any] = {}

    def _get_sandbox_cls(self) -> Any:
        from e2b_code_interpreter import AsyncSandbox  # type: ignore[import-not-found]

        return AsyncSandbox

    def _create_kwargs(self) -> dict[str, Any]:
        """Build kwargs for AsyncSandbox.create().

        The E2B SDK expects metadata as Dict[str, str]. A string value from
        the config is passed under the key ``"info"``, so the sandbox is
        tagged with ``{"info": "<value>"}``.
        """
        kwargs: dict[str, Any] = {"api_key": self._api_key, "template": self._template}
        if self._metadata is not None:
            kwargs["metadata"] = {"info": self._metadata}
        return kwargs

    async def start_session(self, session_key: str) -> None:
        if session_key in self._sessions:
            logger.debug(f"E2B session '{session_key}' already exists; reusing")
            return
        AsyncSandbox = self._get_sandbox_cls()
        sandbox = await AsyncSandbox.create(**self._create_kwargs())
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
        try:
            sandbox = self._sessions.get(session_key)
            merged_env = {**self._user_env, **(env or {})}
            run_kwargs: dict[str, Any] = {"envs": merged_env}
            if timeout is not None:
                run_kwargs["timeout"] = timeout
            if self._cwd is not None:
                run_kwargs["cwd"] = self._cwd
            if sandbox is not None:
                execution = await sandbox.run_code(code, **run_kwargs)
            else:
                # Ephemeral: spin up a fresh sandbox, run, then close.
                AsyncSandbox = self._get_sandbox_cls()
                async with await AsyncSandbox.create(**self._create_kwargs()) as sb:
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
    language = "PYTHON"
    config_model = E2BConfig
    env_var_specs = [
        EnvVarSpec(
            key="PHOENIX_SANDBOX_E2B_API_KEY",
            display_name="E2B API Key",
            description="API key for the E2B sandbox service.",
        ),
    ]

    def build_backend(
        self,
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> SandboxBackend:
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        if packages:
            raise UnsupportedOperation(
                "E2B backend does not support dependency installation. "
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
                    "E2B backend does not support internet_access configuration. "
                    "Remove the internet_access field or switch to a backend that supports it."
                )
        api_key: str = (
            config.get("PHOENIX_SANDBOX_E2B_API_KEY")
            or os.environ.get("PHOENIX_SANDBOX_E2B_API_KEY")
            or os.environ.get(ENV_PHOENIX_SANDBOX_API_KEY)
            or ""
        )
        template: str = config.get("template", "base")
        cwd: Optional[str] = config.get("cwd") or None
        metadata: Optional[str] = config.get("metadata") or None
        return E2BSandboxBackend(
            api_key=api_key, template=template, cwd=cwd, metadata=metadata, user_env=user_env
        )
