"""
Vercel sandbox backend.

Session-capable — start_session() creates an AsyncSandbox and caches it by
session_key. execute() reuses the cached sandbox if one exists for the key,
otherwise spins up an ephemeral sandbox (create → run_command → stop).

Requires the ``vercel`` extra (``vercel>=0.5.1``).
Import is deferred to avoid top-level failures when the extra is absent.

Authentication follows the Vercel Sandbox SDK: either ``VERCEL_OIDC_TOKEN`` (for
local ``vercel env pull`` or deployments on Vercel), or the access-token
triple ``VERCEL_TOKEN``, ``VERCEL_PROJECT_ID``, and ``VERCEL_TEAM_ID``. See
https://vercel.com/docs/vercel-sandbox/concepts/authentication

Language routing
----------------
- PYTHON  → runtime="python3.13", run_command("python3", ["-c", code])
- TYPESCRIPT → runtime="node24", run_command("node", ["--input-type=module", "-e", code])
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Optional

from .types import (
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
)

# Vercel SDK env (https://vercel.com/docs/vercel-sandbox/concepts/authentication)
ENV_VERCEL_OIDC_TOKEN = "VERCEL_OIDC_TOKEN"
ENV_VERCEL_TOKEN = "VERCEL_TOKEN"
ENV_VERCEL_PROJECT_ID = "VERCEL_PROJECT_ID"
ENV_VERCEL_TEAM_ID = "VERCEL_TEAM_ID"

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language → runtime + command mapping
# ---------------------------------------------------------------------------

_LANGUAGE_CONFIGS: dict[str, dict[str, Any]] = {
    "PYTHON": {
        "runtime": "python3.13",
        "cmd": "python3",
        "args_prefix": ["-c"],
    },
    "TYPESCRIPT": {
        "runtime": "node24",
        "cmd": "node",
        "args_prefix": ["--input-type=module", "-e"],
    },
}
_DEFAULT_LANGUAGE = "TYPESCRIPT"


class VercelSandboxBackend(SandboxBackend):
    """Sandbox backend executing code via Vercel Sandbox (vercel >= 0.5.1).

    Supports named sessions via start_session/stop_session for sandbox reuse
    across multiple execute() calls, or ephemeral execution (no session) which
    spins up a fresh sandbox per call.

    Credentials: either rely on ``VERCEL_OIDC_TOKEN`` in the process environment
    (``use_oidc_env=True``), or pass an access-token triple ``token``,
    ``project_id``, and ``team_id`` for ``AsyncSandbox.create``.
    """

    def __init__(
        self,
        *,
        use_oidc_env: bool = False,
        token: Optional[str] = None,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
        language: str = _DEFAULT_LANGUAGE,
    ) -> None:
        self._use_oidc_env = use_oidc_env
        self._token = token
        self._project_id = project_id
        self._team_id = team_id
        if not use_oidc_env and not (token and project_id and team_id):
            raise ValueError(
                "VercelSandboxBackend requires use_oidc_env=True, or "
                "token, project_id, and team_id."
            )
        self._language = language.upper() if language else _DEFAULT_LANGUAGE
        self._sessions: dict[str, Any] = {}
        self._session_locks: dict[str, asyncio.Lock] = {}

    def _lang_cfg(self) -> dict[str, Any]:
        return _LANGUAGE_CONFIGS.get(self._language, _LANGUAGE_CONFIGS[_DEFAULT_LANGUAGE])

    async def _create_sandbox(self, env: Optional[dict[str, str]] = None) -> Any:
        from vercel.sandbox import AsyncSandbox

        runtime: str = self._lang_cfg()["runtime"]
        create_kwargs: dict[str, Any] = {"runtime": runtime}
        if not self._use_oidc_env:
            create_kwargs["token"] = self._token
            create_kwargs["project_id"] = self._project_id
            create_kwargs["team_id"] = self._team_id
        if env:
            create_kwargs["env"] = env
        return await AsyncSandbox.create(**create_kwargs)

    async def start_session(self, session_key: str) -> None:
        if session_key not in self._session_locks:
            self._session_locks[session_key] = asyncio.Lock()
        async with self._session_locks[session_key]:
            if session_key in self._sessions:
                logger.debug(f"Vercel session '{session_key}' already exists; reusing")
                return
            sandbox = await self._create_sandbox()
            self._sessions[session_key] = sandbox
        logger.debug(f"Started Vercel session '{session_key}'")

    async def stop_session(self, session_key: str) -> None:
        sandbox = self._sessions.pop(session_key, None)
        if sandbox is not None:
            try:
                await sandbox.stop()
                await sandbox.client.aclose()
            except Exception:
                logger.debug(f"Error stopping Vercel session '{session_key}'", exc_info=True)
            logger.debug(f"Stopped Vercel session '{session_key}'")

    async def _exec_code(self, sandbox: Any, code: str) -> ExecutionResult:
        """Run code in a sandbox and collect stdout/stderr."""
        lang_cfg = self._lang_cfg()
        cmd: str = lang_cfg["cmd"]
        args: list[str] = lang_cfg["args_prefix"] + [code]
        result = await sandbox.run_command(cmd, args)
        stdout, stderr = await asyncio.gather(result.stdout(), result.stderr())
        exit_code = result.exit_code
        error: Optional[str] = stderr if exit_code != 0 else None
        return ExecutionResult(
            stdout=stdout or "",
            stderr=stderr or "",
            error=error,
        )

    async def execute(
        self,
        code: str,
        session_key: str,
        env: Optional[dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        if timeout is not None:
            logger.debug(
                "VercelSandboxBackend: per-call timeout not supported for session reuse; "
                "set timeout at sandbox creation time via start_session"
            )
        try:
            sandbox = self._sessions.get(session_key)
            if sandbox is not None:
                return await self._exec_code(sandbox, code)
            else:
                # Ephemeral: create, exec, stop.
                sandbox = await self._create_sandbox(env=env)
                try:
                    return await self._exec_code(sandbox, code)
                finally:
                    try:
                        await sandbox.stop()
                        await sandbox.client.aclose()
                    except Exception:
                        pass
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def close(self) -> None:
        for key in list(self._sessions):
            await self.stop_session(key)


def _resolve_vercel_access_token(config: dict[str, Any]) -> str:
    return str(config.get(ENV_VERCEL_TOKEN) or "") or os.environ.get(ENV_VERCEL_TOKEN, "")


def _resolve_vercel_project_id(config: dict[str, Any]) -> str:
    return str(config.get(ENV_VERCEL_PROJECT_ID) or "") or os.environ.get(ENV_VERCEL_PROJECT_ID, "")


def _resolve_vercel_team_id(config: dict[str, Any]) -> str:
    return str(config.get(ENV_VERCEL_TEAM_ID) or "") or os.environ.get(ENV_VERCEL_TEAM_ID, "")


class VercelPythonAdapter(SandboxAdapter):
    key = "VERCEL_PYTHON"
    display_name = "Vercel Sandbox (Python)"
    language = "PYTHON"

    def build_backend(self, config: dict[str, Any]) -> SandboxBackend:
        if os.environ.get(ENV_VERCEL_OIDC_TOKEN):
            return VercelSandboxBackend(use_oidc_env=True, language="PYTHON")

        token = _resolve_vercel_access_token(config)
        project_id = _resolve_vercel_project_id(config)
        team_id = _resolve_vercel_team_id(config)
        if token and project_id and team_id:
            return VercelSandboxBackend(
                token=token,
                project_id=project_id,
                team_id=team_id,
                language="PYTHON",
            )
        raise ValueError(
            "Vercel sandbox authentication is not configured. Set VERCEL_OIDC_TOKEN "
            "(e.g. from `vercel env pull`), or set all of VERCEL_TOKEN, "
            "VERCEL_PROJECT_ID, and VERCEL_TEAM_ID. See "
            "https://vercel.com/docs/vercel-sandbox/concepts/authentication"
        )
