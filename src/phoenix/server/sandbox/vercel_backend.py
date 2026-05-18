"""
Vercel sandbox backend.

Session-capable — start_session() creates an AsyncSandbox and caches it by
session_key. execute() reuses the cached sandbox if one exists for the key,
otherwise spins up an ephemeral sandbox (create → run_command → stop).

Requires the ``vercel`` extra (``vercel>=0.5.8``). The SDK import is lazy (in
``VercelSandboxBackend._create_sandbox``) so the module remains importable
when the extra is absent. Adapter availability is gated by
``VercelAdapter.probe_dependencies`` at registration time, which
surfaces a missing extra as ``status=NOT_INSTALLED`` instead of a runtime
error during evaluation.

Authentication uses the Vercel Sandbox access-token triple, forwarded as
explicit kwargs to ``AsyncSandbox.create``. Phoenix resolves those credentials
from the SDK-native ``VERCEL_TOKEN`` / ``VERCEL_PROJECT_ID`` / ``VERCEL_TEAM_ID``
keys. The SDK's alternative OIDC path is not supported — it relied on
``os.environ`` mutation since the SDK has no ``oidc_token=`` kwarg, and
Phoenix's deployment model (self-hosted server, not a Vercel runtime context)
has no documented OIDC workflow. See
https://vercel.com/docs/vercel-sandbox/concepts/authentication

Language routing
----------------
- PYTHON  → runtime="python3.13", run_command("python3", ["-c", code])
- TYPESCRIPT → runtime="node24", run_command("node", ["--input-type=module-typescript", "-e", code])
"""

from __future__ import annotations

import asyncio
import logging
from types import MappingProxyType
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence, TypedDict

from pydantic import SecretStr

from phoenix.db.models import LanguageName

from .types import (
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    VercelConfig,
    VercelCredentials,
    VercelDeployment,
    compose_secret_values,
)

if TYPE_CHECKING:
    from vercel.sandbox import AsyncSandbox


class _LanguageConfig(TypedDict):
    runtime: str
    cmd: str
    args_prefix: list[str]


# Canonical Phoenix credential keys.
ENV_VERCEL_TOKEN = "VERCEL_TOKEN"
ENV_VERCEL_PROJECT_ID = "VERCEL_PROJECT_ID"
ENV_VERCEL_TEAM_ID = "VERCEL_TEAM_ID"

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language → runtime + command mapping
# ---------------------------------------------------------------------------

_LANGUAGE_CONFIGS: Mapping[LanguageName, _LanguageConfig] = MappingProxyType(
    {
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
)


class VercelSandboxBackend(SandboxBackend):
    """Sandbox backend executing code via Vercel Sandbox (vercel >= 0.5.8).

    Supports named sessions via start_session/stop_session for sandbox reuse
    across multiple execute() calls, or ephemeral execution (no session) which
    spins up a fresh sandbox per call.

    Credentials: the access-token triple ``token``/``project_id``/``team_id``
    is forwarded directly to ``AsyncSandbox.create`` as explicit kwargs. No
    ``os.environ`` mutation.

    Network policy: pass ``internet_access`` as ``True`` (allow-all),
    ``False`` (deny-all), or ``None`` (omit — let the SDK default apply).
    The string form is forwarded to ``AsyncSandbox.create(network_policy=)``;
    the SDK accepts ``"allow-all"`` / ``"deny-all"`` and converts internally.
    """

    def __init__(
        self,
        *,
        token: SecretStr,
        project_id: SecretStr,
        team_id: SecretStr,
        language: LanguageName,
        user_env: Optional[Mapping[str, str]] = None,
        packages: Optional[Sequence[str]] = None,
        internet_access: Optional[bool] = None,
    ) -> None:
        if not token or not project_id or not team_id:
            raise ValueError("VercelSandboxBackend requires token, project_id, and team_id.")
        self._token = token
        self._project_id = project_id
        self._team_id = team_id
        self._language = language
        self._user_env: dict[str, str] = dict(user_env or {})
        self._packages: list[str] = list(packages) if packages else []
        self._internet_access = internet_access
        self._sessions: dict[str, AsyncSandbox] = {}
        self._session_locks: dict[str, asyncio.Lock] = {}
        self.secret_values = compose_secret_values(
            user_env,
            self._token,
            self._project_id,
            self._team_id,
        )

    def _lang_cfg(self) -> _LanguageConfig:
        return _LANGUAGE_CONFIGS[self._language]

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
        create_kwargs: dict[str, Any] = {
            "runtime": runtime,
            "token": self._token.get_secret_value(),
            "project_id": self._project_id.get_secret_value(),
            "team_id": self._team_id.get_secret_value(),
        }
        network_policy = self._network_policy()
        if network_policy is not None:
            create_kwargs["network_policy"] = network_policy
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
        return ExecutionResult(stdout=stdout or "", stderr=stderr or "", error=error)

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


# Linked from credential descriptions and authentication error messages so
# users hitting either surface have a direct pointer to provisioning steps.
_VERCEL_AUTH_DOCS_URL = "https://vercel.com/docs/vercel-sandbox/concepts/authentication"


def _probe_vercel_sdk() -> None:
    """Verify ``vercel.sandbox`` is installed; ImportError → NOT_INSTALLED."""
    import vercel.sandbox  # noqa: F401


class VercelAdapter(SandboxAdapter[VercelConfig, VercelCredentials, VercelDeployment]):
    kind = "VERCEL"
    display_name = "Vercel"
    hosting_type = "hosted"
    dependency_hints = (
        "Install Phoenix with the `vercel` extra.",
        (
            "Set all of `VERCEL_TOKEN`, "
            "`VERCEL_PROJECT_ID`, and "
            "`VERCEL_TEAM_ID`. See "
            "https://vercel.com/docs/vercel-sandbox/concepts/authentication"
        ),
    )
    config_model = VercelConfig
    credentials_model = VercelCredentials
    deployment_config_model = VercelDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        _probe_vercel_sdk()

    def build_backend(
        self,
        config: VercelConfig,
        *,
        credentials: VercelCredentials,
        deployment: VercelDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        """Construct a VercelSandboxBackend from typed config + credentials.

        All three access-token fields must be populated. Raises ``ValueError``
        when any is missing so the executor surfaces an actionable error.
        """
        lang = config.language
        token = credentials.VERCEL_TOKEN.get_secret_value()
        project_id = credentials.VERCEL_PROJECT_ID.get_secret_value()
        team_id = credentials.VERCEL_TEAM_ID.get_secret_value()
        if not (token and project_id and team_id):
            raise ValueError(
                "Vercel sandbox authentication is not configured. Set "
                "VERCEL_TOKEN, VERCEL_PROJECT_ID, and VERCEL_TEAM_ID in "
                "Settings → Sandboxes → Vercel → Credentials. "
                f"See {_VERCEL_AUTH_DOCS_URL}"
            )
        packages: list[str] = (
            list(config.dependencies.packages) if config.dependencies is not None else []
        )
        internet_access: Optional[bool]
        if config.internet_access is None:
            internet_access = None
        elif config.internet_access.mode == "deny":
            internet_access = False
        elif config.internet_access.mode == "allow":
            internet_access = True
        else:
            internet_access = None
        return VercelSandboxBackend(
            token=SecretStr(token),
            project_id=SecretStr(project_id),
            team_id=SecretStr(team_id),
            language=lang,
            user_env=user_env,
            packages=packages,
            internet_access=internet_access,
        )
