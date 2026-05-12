"""
Vercel sandbox backend.

Session-capable — start_session() creates an AsyncSandbox and caches it by
session_key. execute() reuses the cached sandbox if one exists for the key,
otherwise spins up an ephemeral sandbox (create → run_command → stop).

Requires the ``vercel`` extra (``vercel>=0.5.1``). The SDK import is lazy (in
``VercelSandboxBackend._create_sandbox``) so the module remains importable
when the extra is absent. Adapter availability is gated by
``VercelPythonAdapter.probe_dependencies`` /
``VercelTypescriptAdapter.probe_dependencies`` at registration time, which
surfaces a missing extra as ``status=NOT_INSTALLED`` instead of a runtime
error during evaluation.

Authentication follows the Vercel Sandbox SDK: either ``VERCEL_OIDC_TOKEN``
(for local ``vercel env pull`` or deployments on Vercel — read directly from
the process environment by the SDK), or the access-token triple ``VERCEL_TOKEN``,
``VERCEL_PROJECT_ID``, and ``VERCEL_TEAM_ID``. See
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
from typing import TYPE_CHECKING, Any, Optional, TypedDict

from .types import (
    ExecutionResult,
    ProviderCredentialSpec,
    SandboxAdapter,
    SandboxBackend,
    VercelPythonConfig,
    VercelTypescriptConfig,
    compose_secret_values,
)

if TYPE_CHECKING:
    from vercel.sandbox import AsyncSandbox


class _LanguageConfig(TypedDict):
    runtime: str
    cmd: str
    args_prefix: list[str]


# Vercel SDK env-var names. AsyncSandbox.create() with no token kwargs reads
# VERCEL_OIDC_TOKEN / VERCEL_TOKEN / VERCEL_PROJECT_ID / VERCEL_TEAM_ID from
# os.environ — using the SDK-native names here means a user who exports them
# in the process environment gets the same auth resolution Phoenix performs
# from DB-stored secrets, with no rename surprises.
ENV_VERCEL_OIDC_TOKEN = "VERCEL_OIDC_TOKEN"
ENV_VERCEL_TOKEN = "VERCEL_TOKEN"
ENV_VERCEL_PROJECT_ID = "VERCEL_PROJECT_ID"
ENV_VERCEL_TEAM_ID = "VERCEL_TEAM_ID"

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language → runtime + command mapping
# ---------------------------------------------------------------------------

_LANGUAGE_CONFIGS: dict[str, _LanguageConfig] = {
    "PYTHON": _LanguageConfig(
        runtime="python3.13",
        cmd="python3",
        args_prefix=["-c"],
    ),
    "TYPESCRIPT": _LanguageConfig(
        runtime="node24",
        cmd="node",
        args_prefix=["--input-type=module-typescript", "-e"],
    ),
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
    """Sandbox backend executing code via Vercel Sandbox (vercel >= 0.5.8).

    Supports named sessions via start_session/stop_session for sandbox reuse
    across multiple execute() calls, or ephemeral execution (no session) which
    spins up a fresh sandbox per call.

    Credentials: pass either ``oidc_token`` (the resolved OIDC token; injected
    into ``os.environ[VERCEL_OIDC_TOKEN]`` around ``AsyncSandbox.create`` since
    the SDK only autodiscovers OIDC from env), or the access-token triple
    ``token``/``project_id``/``team_id`` (forwarded directly to
    ``AsyncSandbox.create`` as kwargs).

    Network policy: pass ``internet_access`` as ``True`` (allow-all),
    ``False`` (deny-all), or ``None`` (omit — let the SDK default apply).
    The string form is forwarded to ``AsyncSandbox.create(network_policy=)``;
    the SDK accepts ``"allow-all"`` / ``"deny-all"`` and converts internally.
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
        packages: Optional[list[str]] = None,
        internet_access: Optional[bool] = None,
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
        self._packages: list[str] = packages or []
        self._internet_access = internet_access
        self._sessions: dict[str, AsyncSandbox] = {}
        self._session_locks: dict[str, asyncio.Lock] = {}
        self.secret_values = compose_secret_values(user_env, self._oidc_token, self._token)

    def _lang_cfg(self) -> _LanguageConfig:
        return _LANGUAGE_CONFIGS.get(self._language, _LANGUAGE_CONFIGS[_DEFAULT_LANGUAGE])

    def _network_policy(self) -> Optional[str]:
        """Map ``internet_access`` (True/False/None) to the SDK string form.

        Returned values: ``"allow-all"``, ``"deny-all"``, or ``None`` to omit
        the kwarg entirely (SDK default applies). The Vercel SDK accepts these
        string aliases on ``AsyncSandbox.create(network_policy=)`` as of 0.5.8.
        """
        if self._internet_access is None:
            return None
        return "allow-all" if self._internet_access else "deny-all"

    async def _create_sandbox(self) -> AsyncSandbox:
        from vercel.sandbox import AsyncSandbox

        runtime: str = self._lang_cfg()["runtime"]
        create_kwargs: dict[str, Any] = {"runtime": runtime}
        network_policy = self._network_policy()
        if network_policy is not None:
            create_kwargs["network_policy"] = network_policy
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

    async def _install_packages(self, sandbox: AsyncSandbox) -> None:
        """Run language-routed install for configured packages before user code.

        PYTHON → `python3 -m pip install --user <pkgs>` (invoked through the
        same `python3` binary the exec path uses, so install and execute target
        the same interpreter; `--user` avoids needing sudo and writes to the
        sandbox user's ~/.local).
        TYPESCRIPT → `npm install <pkgs>` from the default cwd.

        Raises RuntimeError(stderr) on non-zero exit so callers (start_session
        and ephemeral execute) can either propagate as a fail-fast session
        startup error or surface as an ExecutionResult.error.
        """
        if not self._packages:
            return
        if self._language == "PYTHON":
            cmd = "python3"
            args = ["-m", "pip", "install", "--user", *self._packages]
        else:
            cmd = "npm"
            args = ["install", *self._packages]
        result = await sandbox.run_command(cmd, args)
        if result.exit_code != 0:
            stderr = await result.stderr()
            raise RuntimeError(
                f"{cmd} install {self._packages!r} failed (exit {result.exit_code}): {stderr}"
            )

    async def start_session(self, session_key: str) -> None:
        if session_key not in self._session_locks:
            self._session_locks[session_key] = asyncio.Lock()
        async with self._session_locks[session_key]:
            if session_key in self._sessions:
                logger.debug(f"Vercel session '{session_key}' already exists; reusing")
                return
            sandbox = await self._create_sandbox()
            try:
                await self._install_packages(sandbox)
            except Exception:
                # Install failed — the sandbox is live but unusable. Stop and
                # close it before re-raising so we don't leak a billable
                # Vercel resource that lingers until the SDK's idle timeout.
                try:
                    await sandbox.stop()
                except Exception:
                    logger.debug(
                        f"Error stopping Vercel sandbox after install failure for "
                        f"session '{session_key}'",
                        exc_info=True,
                    )
                try:
                    await sandbox.client.aclose()
                except Exception:
                    logger.debug(
                        f"Error closing Vercel client after install failure for "
                        f"session '{session_key}'",
                        exc_info=True,
                    )
                raise
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
        sandbox: AsyncSandbox,
        code: str,
        env: Optional[dict[str, str]] = None,
    ) -> ExecutionResult:
        """Run code in a sandbox and collect stdout/stderr."""
        lang_cfg = self._lang_cfg()
        cmd: str = lang_cfg["cmd"]
        args: list[str] = lang_cfg["args_prefix"] + [code]
        result = await sandbox.run_command(cmd, args, env=env)
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
                # Ephemeral: create, install (if configured), exec, stop.
                sandbox = await self._create_sandbox()
                try:
                    await self._install_packages(sandbox)
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
    return str(config.get(ENV_VERCEL_TOKEN) or "") or os.environ.get(ENV_VERCEL_TOKEN, "")


def _resolve_vercel_project_id(config: dict[str, Any]) -> str:
    return str(config.get(ENV_VERCEL_PROJECT_ID) or "") or os.environ.get(ENV_VERCEL_PROJECT_ID, "")


def _resolve_vercel_team_id(config: dict[str, Any]) -> str:
    return str(config.get(ENV_VERCEL_TEAM_ID) or "") or os.environ.get(ENV_VERCEL_TEAM_ID, "")


def _resolve_vercel_oidc_token(config: dict[str, Any]) -> str:
    return str(config.get(ENV_VERCEL_OIDC_TOKEN) or "") or os.environ.get(ENV_VERCEL_OIDC_TOKEN, "")


def _resolve_internet_access(config: dict[str, Any]) -> Optional[bool]:
    """Project an InternetAccessConfig mode onto a tri-state bool/None.

    ``None`` means the config did not specify internet_access at all — let
    the Vercel SDK default apply (i.e., omit network_policy=). ``True`` →
    "allow-all", ``False`` → "deny-all"; the string mapping lives in
    ``VercelSandboxBackend._network_policy``.
    """
    internet_access = config.get("internet_access")
    if internet_access is None:
        return None
    mode = (
        internet_access.get("mode")
        if isinstance(internet_access, dict)
        else getattr(internet_access, "mode", None)
    )
    if mode == "deny":
        return False
    if mode == "allow":
        return True
    return None


# UI surfaces only the access-token triple. OIDC is still honored when
# VERCEL_OIDC_TOKEN is present in the process environment (e.g. `vercel env
# pull` or running on Vercel) — see get_missing_sandbox_auth_detail and
# build_backend below — but is not exposed as a configurable secret.
# Linked from credential descriptions and authentication error messages so
# users hitting either surface have a direct pointer to provisioning steps.
_VERCEL_AUTH_DOCS_URL = "https://vercel.com/docs/vercel-sandbox/concepts/authentication"

_VERCEL_ENV_VAR_SPECS = [
    ProviderCredentialSpec(
        key=ENV_VERCEL_TOKEN,
        display_name="Vercel Access Token",
        description=f"Vercel personal access token. See {_VERCEL_AUTH_DOCS_URL}",
    ),
    ProviderCredentialSpec(
        key=ENV_VERCEL_PROJECT_ID,
        display_name="Vercel Project ID",
        description=f"Vercel project ID. See {_VERCEL_AUTH_DOCS_URL}",
    ),
    ProviderCredentialSpec(
        key=ENV_VERCEL_TEAM_ID,
        display_name="Vercel Team ID",
        description=(
            "Vercel team ID — find it under Team Settings → General "
            "(https://vercel.com/teams/your_team_name_here/settings#team-id). "
            f"See {_VERCEL_AUTH_DOCS_URL}"
        ),
    ),
]


def _probe_vercel_sdk() -> None:
    """Verify ``vercel.sandbox`` is installed; ImportError → NOT_INSTALLED."""
    import vercel.sandbox  # noqa: F401


class VercelPythonAdapter(SandboxAdapter):
    key = "VERCEL_PYTHON"
    family = "VERCEL"
    display_name = "Vercel"
    language = "PYTHON"
    config_model = VercelPythonConfig
    credential_specs = _VERCEL_ENV_VAR_SPECS

    @classmethod
    def probe_dependencies(cls) -> None:
        _probe_vercel_sdk()

    def build_backend(
        self,
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        oidc_token = _resolve_vercel_oidc_token(config)
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        internet_access = _resolve_internet_access(config)
        if oidc_token:
            return VercelSandboxBackend(
                oidc_token=oidc_token,
                language="PYTHON",
                user_env=user_env,
                packages=packages,
                internet_access=internet_access,
            )

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
                packages=packages,
                internet_access=internet_access,
            )
        raise ValueError(
            "Vercel sandbox authentication is not configured. Set "
            "VERCEL_OIDC_TOKEN (e.g. from `vercel env pull`), "
            "or set all of VERCEL_TOKEN, VERCEL_PROJECT_ID, and VERCEL_TEAM_ID. See "
            "https://vercel.com/docs/vercel-sandbox/concepts/authentication"
        )


class VercelTypescriptAdapter(SandboxAdapter):
    key = "VERCEL_TYPESCRIPT"
    family = "VERCEL"
    display_name = "Vercel"
    language = "TYPESCRIPT"
    config_model = VercelTypescriptConfig
    credential_specs = _VERCEL_ENV_VAR_SPECS

    @classmethod
    def probe_dependencies(cls) -> None:
        _probe_vercel_sdk()

    def build_backend(
        self,
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        oidc_token = _resolve_vercel_oidc_token(config)
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        internet_access = _resolve_internet_access(config)
        if oidc_token:
            return VercelSandboxBackend(
                oidc_token=oidc_token,
                language="TYPESCRIPT",
                user_env=user_env,
                packages=packages,
                internet_access=internet_access,
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
                packages=packages,
                internet_access=internet_access,
            )
        raise ValueError(
            "Vercel sandbox authentication is not configured. Set "
            "VERCEL_OIDC_TOKEN (e.g. from `vercel env pull`), "
            "or set all of VERCEL_TOKEN, VERCEL_PROJECT_ID, and VERCEL_TEAM_ID. See "
            "https://vercel.com/docs/vercel-sandbox/concepts/authentication"
        )
