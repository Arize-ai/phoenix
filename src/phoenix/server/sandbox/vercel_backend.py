"""Vercel sandbox backend (vercel>=0.5.8). Auth via access-token triple."""

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
    """Sandbox backend executing code via Vercel Sandbox."""

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
        # PYTHON uses `python3 -m pip install --user` so install and exec
        # target the same interpreter without needing sudo.
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
                # Install failed: stop the live sandbox so we don't leak a
                # billable resource until the SDK idle timeout.
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


_VERCEL_AUTH_DOCS_URL = "https://vercel.com/docs/vercel-sandbox/concepts/authentication"


def _probe_vercel_sdk() -> None:
    import vercel.sandbox  # noqa: F401


class VercelAdapter(SandboxAdapter[VercelConfig, VercelCredentials, VercelDeployment]):
    backend_type = "VERCEL"
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
