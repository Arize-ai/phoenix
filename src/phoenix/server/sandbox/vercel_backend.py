"""
Vercel sandbox backend.

Session-capable — start_session() creates an AsyncSandbox and caches it by
session_key. execute() reuses the cached sandbox if one exists for the key,
otherwise spins up an ephemeral sandbox (create → run_command → stop).

Requires the ``vercel`` extra (``vercel>=0.5.1``).
Import is deferred to avoid top-level failures when the extra is absent.

Authentication follows the Vercel Sandbox SDK: either ``VERCEL_OIDC_TOKEN``
(for local ``vercel env pull`` or deployments on Vercel — read directly from
the process environment by the SDK), or the Phoenix-scoped access-token triple
``PHOENIX_SANDBOX_VERCEL_TOKEN``, ``PHOENIX_SANDBOX_VERCEL_PROJECT_ID``, and
``PHOENIX_SANDBOX_VERCEL_TEAM_ID``. See
https://vercel.com/docs/vercel-sandbox/concepts/authentication

Language routing
----------------
- PYTHON  → runtime="python3.13", run_command("python3", ["-c", code])
- TYPESCRIPT → runtime="node24", run_command("node", ["--input-type=module-typescript", "-e", code])
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Optional

from .types import (
    ExecutionResult,
    ProviderCredentialSpec,
    SandboxAdapter,
    SandboxBackend,
    VercelPythonConfig,
    VercelTypescriptConfig,
)

# OIDC token is read directly from the SDK-native env var because
# AsyncSandbox.create() with no token kwargs reads VERCEL_OIDC_TOKEN from
# os.environ — renaming this would silently break authentication.
ENV_VERCEL_OIDC_TOKEN = "VERCEL_OIDC_TOKEN"
# Phoenix-scoped Vercel access-token credentials. These flow through
# AsyncSandbox.create() as kwargs, so the rename is purely Phoenix-internal.
ENV_PHOENIX_SANDBOX_VERCEL_TOKEN = "PHOENIX_SANDBOX_VERCEL_TOKEN"
ENV_PHOENIX_SANDBOX_VERCEL_PROJECT_ID = "PHOENIX_SANDBOX_VERCEL_PROJECT_ID"
ENV_PHOENIX_SANDBOX_VERCEL_TEAM_ID = "PHOENIX_SANDBOX_VERCEL_TEAM_ID"

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
        "args_prefix": ["--input-type=module-typescript", "-e"],
    },
}
_DEFAULT_LANGUAGE = "TYPESCRIPT"

# Vercel SDK 0.5.7's get_credentials() (vercel/oidc/credentials.py) only reads
# the OIDC token from os.environ — there is no oidc_token= kwarg on
# AsyncSandbox.create(). When Phoenix sources VERCEL_OIDC_TOKEN from a DB
# secret rather than the process env, we must inject it into os.environ
# briefly around AsyncSandbox.create(). The lock serializes those env
# mutations process-wide so concurrent creates with different resolved tokens
# cannot leak each other's value into the env.
_VERCEL_OIDC_ENV_LOCK = asyncio.Lock()


class VercelSandboxBackend(SandboxBackend):
    """Sandbox backend executing code via Vercel Sandbox (vercel >= 0.5.1).

    Supports named sessions via start_session/stop_session for sandbox reuse
    across multiple execute() calls, or ephemeral execution (no session) which
    spins up a fresh sandbox per call.

    Credentials: pass either ``oidc_token`` (the resolved OIDC token; injected
    into ``os.environ[VERCEL_OIDC_TOKEN]`` around ``AsyncSandbox.create`` since
    the SDK only autodiscovers OIDC from env), or the access-token triple
    ``token``/``project_id``/``team_id`` (forwarded directly to
    ``AsyncSandbox.create`` as kwargs).
    """

    def __init__(
        self,
        *,
        oidc_token: Optional[str] = None,
        token: Optional[str] = None,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
        language: str = _DEFAULT_LANGUAGE,
        user_env: Optional[dict[str, str]] = None,
    ) -> None:
        self._oidc_token = oidc_token
        self._token = token
        self._project_id = project_id
        self._team_id = team_id
        if not oidc_token and not (token and project_id and team_id):
            raise ValueError(
                "VercelSandboxBackend requires oidc_token, or token, project_id, and team_id."
            )
        self._language = language.upper() if language else _DEFAULT_LANGUAGE
        self._user_env: dict[str, str] = user_env or {}
        self._sessions: dict[str, Any] = {}
        self._session_locks: dict[str, asyncio.Lock] = {}

    def _lang_cfg(self) -> dict[str, Any]:
        return _LANGUAGE_CONFIGS.get(self._language, _LANGUAGE_CONFIGS[_DEFAULT_LANGUAGE])

    async def _create_sandbox(self) -> Any:
        from vercel.sandbox import AsyncSandbox

        runtime: str = self._lang_cfg()["runtime"]
        create_kwargs: dict[str, Any] = {"runtime": runtime}
        if self._oidc_token:
            # SDK reads VERCEL_OIDC_TOKEN from os.environ synchronously at the
            # top of AsyncSandbox.create() (before any await), then captures
            # the value into a Credentials object. Injecting via env is safe
            # under that synchronous read; the lock serializes the env-mutation
            # window across concurrent VercelSandboxBackend instances so a
            # second backend's env-set cannot clobber the first's restore.
            async with _VERCEL_OIDC_ENV_LOCK:
                original = os.environ.get(ENV_VERCEL_OIDC_TOKEN)
                os.environ[ENV_VERCEL_OIDC_TOKEN] = self._oidc_token
                try:
                    return await AsyncSandbox.create(**create_kwargs)
                finally:
                    if original is None:
                        os.environ.pop(ENV_VERCEL_OIDC_TOKEN, None)
                    else:
                        os.environ[ENV_VERCEL_OIDC_TOKEN] = original
        create_kwargs["token"] = self._token
        create_kwargs["project_id"] = self._project_id
        create_kwargs["team_id"] = self._team_id
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

    async def _exec_code(
        self,
        sandbox: Any,
        code: str,
        env: Optional[dict[str, str]] = None,
    ) -> ExecutionResult:
        """Run code in a sandbox and collect stdout/stderr."""
        lang_cfg = self._lang_cfg()
        cmd: str = lang_cfg["cmd"]
        args: list[str] = lang_cfg["args_prefix"] + [code]
        run_kwargs: dict[str, Any] = {}
        if env:
            run_kwargs["env"] = env
        result = await sandbox.run_command(cmd, args, **run_kwargs)
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
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            session_env: Optional[dict[str, str]] = self._user_env or None
            sandbox = self._sessions.get(session_key)
            if sandbox is not None:
                return await self._exec_code(sandbox, code, env=session_env)
            else:
                # Ephemeral: create, exec, stop.
                sandbox = await self._create_sandbox()
                try:
                    return await self._exec_code(sandbox, code, env=session_env)
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
    return str(config.get(ENV_PHOENIX_SANDBOX_VERCEL_TOKEN) or "") or os.environ.get(
        ENV_PHOENIX_SANDBOX_VERCEL_TOKEN, ""
    )


def _resolve_vercel_project_id(config: dict[str, Any]) -> str:
    return str(config.get(ENV_PHOENIX_SANDBOX_VERCEL_PROJECT_ID) or "") or os.environ.get(
        ENV_PHOENIX_SANDBOX_VERCEL_PROJECT_ID, ""
    )


def _resolve_vercel_team_id(config: dict[str, Any]) -> str:
    return str(config.get(ENV_PHOENIX_SANDBOX_VERCEL_TEAM_ID) or "") or os.environ.get(
        ENV_PHOENIX_SANDBOX_VERCEL_TEAM_ID, ""
    )


def _resolve_vercel_oidc_token(config: dict[str, Any]) -> str:
    return str(config.get(ENV_VERCEL_OIDC_TOKEN) or "") or os.environ.get(ENV_VERCEL_OIDC_TOKEN, "")


# UI surfaces only the access-token triple. OIDC is still honored when
# VERCEL_OIDC_TOKEN is present in the process environment (e.g. `vercel env
# pull` or running on Vercel) — see get_missing_sandbox_auth_detail and
# build_backend below — but is not exposed as a configurable secret.
_VERCEL_ENV_VAR_SPECS = [
    ProviderCredentialSpec(
        key="PHOENIX_SANDBOX_VERCEL_TOKEN",
        display_name="Vercel Access Token",
        description="Vercel personal access token.",
    ),
    ProviderCredentialSpec(
        key="PHOENIX_SANDBOX_VERCEL_PROJECT_ID",
        display_name="Vercel Project ID",
        description="Vercel project ID.",
    ),
    ProviderCredentialSpec(
        key="PHOENIX_SANDBOX_VERCEL_TEAM_ID",
        display_name="Vercel Team ID",
        description="Vercel team ID.",
    ),
]


class VercelPythonAdapter(SandboxAdapter):
    key = "VERCEL_PYTHON"
    display_name = "Vercel Sandbox"
    language = "PYTHON"
    config_model = VercelPythonConfig
    credential_specs = _VERCEL_ENV_VAR_SPECS

    def build_backend(
        self,
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        oidc_token = _resolve_vercel_oidc_token(config)
        if oidc_token:
            return VercelSandboxBackend(oidc_token=oidc_token, language="PYTHON", user_env=user_env)

        token = _resolve_vercel_access_token(config)
        project_id = _resolve_vercel_project_id(config)
        team_id = _resolve_vercel_team_id(config)
        if token and project_id and team_id:
            return VercelSandboxBackend(
                token=token,
                project_id=project_id,
                team_id=team_id,
                language="PYTHON",
                user_env=user_env,
            )
        raise ValueError(
            "Vercel sandbox authentication is not configured. Set "
            "VERCEL_OIDC_TOKEN (e.g. from `vercel env pull`), "
            "or set all of PHOENIX_SANDBOX_VERCEL_TOKEN, "
            "PHOENIX_SANDBOX_VERCEL_PROJECT_ID, and PHOENIX_SANDBOX_VERCEL_TEAM_ID. See "
            "https://vercel.com/docs/vercel-sandbox/concepts/authentication"
        )


class VercelTypescriptAdapter(SandboxAdapter):
    key = "VERCEL_TYPESCRIPT"
    display_name = "Vercel Sandbox"
    language = "TYPESCRIPT"
    config_model = VercelTypescriptConfig
    credential_specs = _VERCEL_ENV_VAR_SPECS

    def build_backend(
        self,
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        oidc_token = _resolve_vercel_oidc_token(config)
        if oidc_token:
            return VercelSandboxBackend(
                oidc_token=oidc_token, language="TYPESCRIPT", user_env=user_env
            )

        token = _resolve_vercel_access_token(config)
        project_id = _resolve_vercel_project_id(config)
        team_id = _resolve_vercel_team_id(config)
        if token and project_id and team_id:
            return VercelSandboxBackend(
                token=token,
                project_id=project_id,
                team_id=team_id,
                language="TYPESCRIPT",
                user_env=user_env,
            )
        raise ValueError(
            "Vercel sandbox authentication is not configured. Set "
            "VERCEL_OIDC_TOKEN (e.g. from `vercel env pull`), "
            "or set all of PHOENIX_SANDBOX_VERCEL_TOKEN, "
            "PHOENIX_SANDBOX_VERCEL_PROJECT_ID, and PHOENIX_SANDBOX_VERCEL_TEAM_ID. See "
            "https://vercel.com/docs/vercel-sandbox/concepts/authentication"
        )
