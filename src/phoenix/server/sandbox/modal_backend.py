"""Modal sandbox backend. Credentials passed explicitly to the SDK, never via os.environ."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from pydantic import SecretStr

from .types import (
    ExecutionResult,
    ModalConfig,
    ModalCredentials,
    ModalDeployment,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
)

if TYPE_CHECKING:
    from modal import App, Client
    from modal.image import Image
    from modal.sandbox import Sandbox

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 600
_DEFAULT_IDLE_TIMEOUT = 300
ENV_MODAL_TOKEN_ID = "MODAL_TOKEN_ID"
ENV_MODAL_TOKEN_SECRET = "MODAL_TOKEN_SECRET"


class ModalSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in Modal cloud sandboxes."""

    def __init__(
        self,
        token_id: SecretStr,
        token_secret: SecretStr,
        *,
        timeout: int = _DEFAULT_TIMEOUT,
        idle_timeout: int = _DEFAULT_IDLE_TIMEOUT,
        app_name: str = "phoenix-sandbox",
        user_env: Optional[Mapping[str, str]] = None,
        packages: Optional[Sequence[str]] = None,
        block_network: bool = False,
    ) -> None:
        if not token_id or not token_secret:
            raise ValueError(
                "Modal sandbox requires both MODAL_TOKEN_ID and "
                "MODAL_TOKEN_SECRET. Set them in Settings → Sandboxes → "
                "Modal → Credentials, or as process environment variables."
            )

        import modal

        self._token_id = token_id
        self._token_secret = token_secret
        self._timeout = timeout
        self._idle_timeout = idle_timeout
        self._app_name = app_name
        self._user_env: dict[str, str] = dict(user_env or {})
        self._block_network = block_network
        self._sessions: dict[str, Sandbox] = {}
        self._session_locks: dict[str, asyncio.Lock] = {}
        self._client: Optional[Client] = None
        self._app: Optional[App] = None
        self._client_lock = asyncio.Lock()
        base_image = modal.Image.debian_slim()
        self._image: Image = base_image.pip_install(list(packages)) if packages else base_image
        self.secret_values = compose_secret_values(user_env, token_id, token_secret)

    async def _ensure_client(self) -> Client:
        import modal

        if self._client is not None:
            return self._client
        async with self._client_lock:
            if self._client is None:
                self._client = await modal.Client.from_credentials.aio(
                    self._token_id.get_secret_value(), self._token_secret.get_secret_value()
                )
        return self._client

    async def _ensure_app(self) -> App:
        import modal

        if self._app is not None:
            return self._app
        client = await self._ensure_client()
        async with self._client_lock:
            if self._app is None:
                self._app = await modal.App.lookup.aio(
                    self._app_name, client=client, create_if_missing=True
                )
        return self._app

    async def _create_sandbox(self) -> Sandbox:
        import modal

        client = await self._ensure_client()
        app = await self._ensure_app()
        kwargs: dict[str, Any] = {
            "app": app,
            "client": client,
            "image": self._image,
            "timeout": self._timeout,
            "idle_timeout": self._idle_timeout,
        }
        if self._user_env:
            kwargs["env"] = self._user_env
        if self._block_network:
            kwargs["block_network"] = True
        return await modal.Sandbox.create.aio(**kwargs)

    async def start_session(self, session_key: str) -> None:
        if session_key not in self._session_locks:
            self._session_locks[session_key] = asyncio.Lock()
        async with self._session_locks[session_key]:
            if session_key in self._sessions:
                logger.debug(f"Modal session '{session_key}' already exists; reusing")
                return
            sandbox = await self._create_sandbox()
            self._sessions[session_key] = sandbox
        logger.debug(f"Started Modal session '{session_key}'")

    async def stop_session(self, session_key: str) -> None:
        sandbox = self._sessions.pop(session_key, None)
        if sandbox is not None:
            await sandbox.terminate.aio()
            logger.debug(f"Stopped Modal session '{session_key}'")

    async def _exec_code(self, sandbox: Sandbox, code: str) -> ExecutionResult:
        proc = await sandbox.exec.aio("python", "-c", code)
        stdout, stderr = await asyncio.gather(
            proc.stdout.read.aio(),
            proc.stderr.read.aio(),
        )
        exit_code = await proc.wait.aio()
        error: Optional[str] = stderr if exit_code != 0 else None
        return ExecutionResult(stdout=stdout or "", stderr=stderr or "", error=error)

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            sandbox = self._sessions.get(session_key)
            if sandbox is not None:
                return await self._exec_code(sandbox, code)
            else:
                sandbox = await self._create_sandbox()
                try:
                    return await self._exec_code(sandbox, code)
                finally:
                    await sandbox.terminate.aio()
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def close(self) -> None:
        for key in list(self._sessions):
            await self.stop_session(key)


class ModalAdapter(SandboxAdapter[ModalConfig, ModalCredentials, ModalDeployment]):
    backend_type = "MODAL"
    display_name = "Modal"
    hosting_type = "hosted"
    dependency_hints = (
        "Install Phoenix with the `modal` extra.",
        "Provide `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` environment variables.",
    )
    config_model = ModalConfig
    credentials_model = ModalCredentials
    deployment_config_model = ModalDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        import modal  # noqa: F401

    def build_backend(
        self,
        config: ModalConfig,
        *,
        credentials: ModalCredentials,
        deployment: ModalDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        token_id = credentials.MODAL_TOKEN_ID.get_secret_value()
        token_secret = credentials.MODAL_TOKEN_SECRET.get_secret_value()
        if not token_id or not token_secret:
            raise ValueError(
                "Modal sandbox authentication is not configured. Set both "
                "MODAL_TOKEN_ID and MODAL_TOKEN_SECRET in Settings → "
                "Sandboxes → Modal → Credentials, or as process environment "
                "variables."
            )
        packages: list[str] = (
            list(config.dependencies.packages) if config.dependencies is not None else []
        )
        block_network = config.internet_access is not None and config.internet_access.mode == "deny"
        return ModalSandboxBackend(
            token_id=SecretStr(token_id),
            token_secret=SecretStr(token_secret),
            timeout=_DEFAULT_TIMEOUT,
            idle_timeout=_DEFAULT_IDLE_TIMEOUT,
            app_name="phoenix-sandbox",
            user_env=user_env,
            packages=packages or None,
            block_network=block_network,
        )
