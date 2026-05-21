"""Modal sandbox backend. Credentials passed explicitly to the SDK, never via os.environ."""

from __future__ import annotations

import asyncio
import functools
import hashlib
import logging
from typing import TYPE_CHECKING, Any, ClassVar, Mapping, Optional, Sequence

from pydantic import SecretStr
from typing_extensions import override

from .types import (
    ExecutionResult,
    ModalConfig,
    ModalCredentials,
    ModalDeployment,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
    compute_config_fingerprint,
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


@functools.cache
def _modal_session_gone_exception_classes() -> tuple[type[BaseException], ...]:
    """Modal SDK exception classes meaning the remote sandbox is gone (lazy import)."""
    try:
        from modal.exception import (
            NotFoundError,
            SandboxTerminatedError,
            SandboxTimeoutError,
        )
    except ImportError:
        return ()
    return (NotFoundError, SandboxTerminatedError, SandboxTimeoutError)


class ModalSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in Modal cloud sandboxes."""

    provider: ClassVar[str] = "MODAL"

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
        self._client: Optional[Client] = None
        self._app: Optional[App] = None
        self._client_lock = asyncio.Lock()
        self._packages: list[str] = list(packages) if packages else []
        base_image = modal.Image.debian_slim()
        self._image: Image = (
            base_image.pip_install(self._packages) if self._packages else base_image
        )
        self.secret_values = compose_secret_values(user_env, token_id, token_secret)

    @override
    def config_fingerprint(self) -> str:
        return compute_config_fingerprint(
            backend_type="MODAL",
            packages=self._packages,
            internet_access_mode=str(self._block_network),
        )

    @override
    def provider_session_id(self, session_key: str) -> str:
        # Modal sandbox names: alphanumeric + ``-``, max 64 chars.
        return hashlib.sha256(session_key.encode()).hexdigest()[:32]

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

    async def _create_sandbox(self, *, name: Optional[str] = None) -> Sandbox:
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
        if name is not None:
            kwargs["name"] = name
        if self._user_env:
            kwargs["env"] = self._user_env
        if self._block_network:
            kwargs["block_network"] = True
        return await modal.Sandbox.create.aio(**kwargs)

    async def _from_name_if_alive(self, name: str) -> Optional[Sandbox]:
        """Look up a named Modal sandbox; return None if missing or already exited."""
        import modal
        from modal.exception import NotFoundError

        client = await self._ensure_client()
        try:
            sandbox = await modal.Sandbox.from_name.aio(self._app_name, name, client=client)
        except NotFoundError:
            return None
        # poll() returns None while running, else the exit code.
        try:
            returncode = await sandbox.poll.aio()
        except Exception:
            return None
        if returncode is not None:
            return None
        return sandbox

    @override
    async def find_or_create_session(self, session_key: str) -> Sandbox:
        from modal.exception import AlreadyExistsError

        name = self.provider_session_id(session_key)
        existing = await self._from_name_if_alive(name)
        if existing is not None:
            logger.debug(f"Modal session '{name}' already exists; reusing")
            return existing
        try:
            sandbox = await self._create_sandbox(name=name)
            logger.debug(f"Created Modal session '{name}'")
            return sandbox
        except AlreadyExistsError:
            # Concurrent winner from another replica; re-attach via from_name.
            attached = await self._from_name_if_alive(name)
            if attached is None:
                raise
            logger.debug(f"Modal session '{name}' won by concurrent creator; attaching")
            return attached

    @override
    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        sandbox: Sandbox = handle  # type: ignore[assignment]
        try:
            return await self._exec_code(sandbox, code)
        except Exception as exc:
            if self.is_session_gone(exc):
                raise
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    @override
    async def close_session(self, session_key: str) -> None:
        import modal
        from modal.exception import NotFoundError

        name = self.provider_session_id(session_key)
        client = await self._ensure_client()
        try:
            sandbox = await modal.Sandbox.from_name.aio(self._app_name, name, client=client)
        except NotFoundError:
            return
        try:
            await sandbox.terminate.aio()
            logger.debug(f"Stopped Modal session '{name}'")
        except NotFoundError:
            return

    async def _exec_code(self, sandbox: Sandbox, code: str) -> ExecutionResult:
        # No timeout= kwarg: ContainerProcess has no kill; cleanup is via
        # outer wait_for + schedule_eviction -> sandbox.terminate.
        proc = await sandbox.exec.aio("python", "-c", code)
        stdout, stderr = await asyncio.gather(
            proc.stdout.read.aio(),
            proc.stderr.read.aio(),
        )
        exit_code = await proc.wait.aio()
        error: Optional[str] = stderr if exit_code != 0 else None
        return ExecutionResult(stdout=stdout or "", stderr=stderr or "", error=error)

    @override
    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Direct one-shot ephemeral execution: create, run, terminate."""
        try:
            sandbox = await self._create_sandbox()
            try:
                return await self._exec_code(sandbox, code)
            finally:
                await sandbox.terminate.aio()
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    @override
    async def close(self) -> None:
        return None

    @override
    def is_session_gone(self, exc: BaseException) -> bool:
        """Classify NotFoundError / SandboxTerminatedError / SandboxTimeoutError as gone.

        Other Modal exceptions are NOT classified: ``AuthError`` /
        ``InvalidError`` recur on a fresh session, ``ConnectionError`` is
        transient transport noise.
        """
        return isinstance(exc, _modal_session_gone_exception_classes())


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
