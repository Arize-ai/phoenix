"""Vercel sandbox backend (vercel>=0.5.8). Auth via access-token triple."""

from __future__ import annotations

import asyncio
import contextlib
import functools
import logging
from datetime import timedelta
from types import MappingProxyType
from typing import TYPE_CHECKING, Any, ClassVar, Mapping, Optional, Sequence, TypedDict

from pydantic import SecretStr
from typing_extensions import override

from phoenix.db.models import LanguageName

from .types import (
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    VercelConfig,
    VercelCredentials,
    VercelDeployment,
    compose_secret_values,
    compute_config_fingerprint,
)

if TYPE_CHECKING:
    from vercel.sandbox import AsyncSandbox


@functools.cache
def _vercel_session_gone_exception_classes() -> tuple[type[BaseException], ...]:
    """Vercel SDK exception classes meaning the remote sandbox is gone (lazy import)."""
    try:
        from vercel.sandbox import SandboxNotFoundError
    except ImportError:
        return ()
    return (SandboxNotFoundError,)


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

# Vercel max-lifetime: bounds the cost of a leaked sandbox after a Phoenix
# crash. Passed as timedelta so the unit (vs. the SDK's int=ms) is explicit.
_VERCEL_CREATE_TIMEOUT = timedelta(seconds=600)

# Process-local session binding. See module docstring for the cross-process
# limitation. Dict ops are GIL-atomic so a race on setdefault still resolves
# to a single Lock.
_session_id_map: dict[str, str] = {}
_session_id_locks: dict[str, asyncio.Lock] = {}


def _get_key_lock(session_key: str) -> asyncio.Lock:
    return _session_id_locks.setdefault(session_key, asyncio.Lock())


class VercelSandboxBackend(SandboxBackend):
    """Sandbox backend executing code via Vercel Sandbox."""

    provider: ClassVar[str] = "VERCEL"

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
        self.secret_values = compose_secret_values(
            user_env,
            self._token,
            self._project_id,
            self._team_id,
        )

    @override
    def config_fingerprint(self) -> str:
        return compute_config_fingerprint(
            backend_type="VERCEL",
            packages=self._packages,
            internet_access_mode=str(self._internet_access),
            language=self._language,
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
            "timeout": _VERCEL_CREATE_TIMEOUT,
        }
        network_policy = self._network_policy()
        if network_policy is not None:
            create_kwargs["network_policy"] = network_policy
        return await AsyncSandbox.create(**create_kwargs)

    async def _get_sandbox(self, sandbox_id: str) -> AsyncSandbox:
        """Reconnect to an existing Vercel sandbox by id (no creation)."""
        from vercel.sandbox import AsyncSandbox

        return await AsyncSandbox.get(
            sandbox_id=sandbox_id,
            token=self._token.get_secret_value(),
            project_id=self._project_id.get_secret_value(),
            team_id=self._team_id.get_secret_value(),
        )

    def _is_alive(self, sandbox: AsyncSandbox) -> bool:
        """``True`` if ``sandbox.status`` reflects a usable runtime state."""
        # ``status`` is a ``SandboxStatus`` enum; compare by value so a future
        # SDK rename of the enum members doesn't silently flip this branch.
        return getattr(sandbox.status, "value", None) in {"running", "pending"}

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

    @override
    async def find_or_create_session(self, session_key: str) -> AsyncSandbox:
        """Process-local bind: reconnect via ``get(sandbox_id)`` or create fresh."""
        key_lock = _get_key_lock(session_key)
        async with key_lock:
            existing_id = _session_id_map.get(session_key)
            if existing_id is not None:
                try:
                    sandbox = await self._get_sandbox(existing_id)
                except Exception:
                    logger.debug(
                        "Vercel find_or_create_session: get(sandbox_id=%s) failed "
                        "for key=%r; treating as stale and recreating",
                        existing_id,
                        session_key,
                        exc_info=True,
                    )
                    sandbox = None
                if sandbox is not None and self._is_alive(sandbox):
                    logger.debug(f"Vercel session '{session_key}' reused")
                    return sandbox
                _session_id_map.pop(session_key, None)

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
            _session_id_map[session_key] = sandbox.sandbox_id
            logger.debug(
                "Vercel session '%s' created (sandbox_id=%s)",
                session_key,
                sandbox.sandbox_id,
            )
            return sandbox

    @override
    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        sandbox: AsyncSandbox = handle  # type: ignore[assignment]
        try:
            session_env: Optional[dict[str, str]] = self._user_env or None
            return await self._exec_code(sandbox, code, env=session_env, timeout=timeout)
        except Exception as exc:
            if self.is_session_gone(exc):
                raise
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    @override
    def is_session_gone(self, exc: BaseException) -> bool:
        """Classify ``SandboxNotFoundError`` (404 from run_command) as session-gone.

        Other ``APIError`` subclasses (auth/permission/rate-limit/server) are
        NOT classified — they recur on a fresh session or are transient.
        """
        return isinstance(exc, _vercel_session_gone_exception_classes())

    @override
    async def close_session(self, session_key: str) -> None:
        """Drop the binding and best-effort stop the remote sandbox.

        Pop both ``_session_id_map`` and ``_session_id_locks`` synchronously
        under the per-key lock — before any ``await`` — so a concurrent
        same-key ``find_or_create_session`` can't race the teardown.
        """
        key_lock = _get_key_lock(session_key)
        async with key_lock:
            sandbox_id = _session_id_map.pop(session_key, None)
            _session_id_locks.pop(session_key, None)
            if sandbox_id is None:
                return
            try:
                sandbox = await self._get_sandbox(sandbox_id)
            except Exception:
                logger.debug(
                    "Vercel close_session: get(sandbox_id=%s) failed for key=%r; "
                    "treating as already-absent",
                    sandbox_id,
                    session_key,
                    exc_info=True,
                )
                return
            try:
                await sandbox.stop()
            except Exception:
                logger.debug(
                    "Vercel close_session: stop failed for sandbox_id=%s key=%r",
                    sandbox_id,
                    session_key,
                    exc_info=True,
                )
            try:
                await sandbox.client.aclose()
            except Exception:
                logger.debug(
                    "Vercel close_session: client.aclose failed for sandbox_id=%s key=%r",
                    sandbox_id,
                    session_key,
                    exc_info=True,
                )
            logger.debug(f"Stopped Vercel session '{session_key}'")

    async def _exec_code(
        self,
        sandbox: AsyncSandbox,
        code: str,
        env: Optional[dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        lang_cfg = self._lang_cfg()
        cmd: str = lang_cfg["cmd"]
        args: list[str] = lang_cfg["args_prefix"] + [code]

        if timeout is None:
            result = await sandbox.run_command(cmd, args, env=env)
        else:
            # run_command has no timeout kwarg; detached + finally-kill so
            # cleanup runs on inner timeout AND outer cancellation.
            command = await sandbox.run_command_detached(cmd, args, env=env)
            completed = False
            try:
                try:
                    result = await asyncio.wait_for(command.wait(), timeout=timeout)
                    completed = True
                except (TimeoutError, asyncio.TimeoutError):
                    message = f"Execution timed out after {timeout}s"
                    return ExecutionResult(stdout="", stderr=message, error=message)
            finally:
                if not completed:
                    with contextlib.suppress(Exception):
                        await command.kill()

        stdout, stderr = await asyncio.gather(result.stdout(), result.stderr())
        exit_code = result.exit_code
        error: Optional[str] = stderr if exit_code != 0 else None
        return ExecutionResult(stdout=stdout or "", stderr=stderr or "", error=error)

    @override
    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Direct one-shot (create → install → exec → stop).

        Always ephemeral — does NOT consult ``_session_id_map`` so two direct
        callers cannot accidentally share a remote sandbox.
        """
        try:
            session_env: Optional[dict[str, str]] = self._user_env or None
            sandbox = await self._create_sandbox()
            try:
                await self._install_packages(sandbox)
                return await self._exec_code(sandbox, code, env=session_env, timeout=timeout)
            finally:
                try:
                    await sandbox.stop()
                    await sandbox.client.aclose()
                except Exception:
                    pass
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    @override
    async def close(self) -> None:
        return None


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
