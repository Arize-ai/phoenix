"""
Modal sandbox backend.

Requires the ``modal`` package (optional extra). The SDK import is lazy (in
``ModalSandboxBackend.__init__`` and the ``_ensure_*`` helpers) so the module
remains importable when the extra is absent. Adapter availability is gated by
``ModalAdapter.probe_dependencies`` at registration time, which surfaces a
missing extra as ``status=NOT_INSTALLED`` instead of a runtime error during
evaluation.

Authentication: credentials are passed explicitly to the Modal SDK via
``modal.Client.from_credentials(token_id, token_secret)`` and threaded through
``modal.App.lookup`` and ``modal.Sandbox.create`` as a ``client=`` kwarg. The
backend never mutates ``os.environ`` — DB-resolved tokens stay scoped to the
adapter instance and cannot leak into the Phoenix process env, subprocesses,
logs, or crash dumps.

Session lifecycle
-----------------
- start_session(): creates a Modal Sandbox via Sandbox.create.aio() and
  caches it by session_key. Sandboxes are long-lived (idle_timeout=300s,
  hard timeout=600s).
- stop_session(): terminates the cached sandbox via sandbox.terminate.aio().
- execute(): runs code via sandbox.exec("python", "-c", code) inside the
  cached session, or ephemeral (create → exec → terminate) if no session.
- close(): terminates all cached sandboxes.
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from starlette.datastructures import Secret

from .types import (
    ExecutionResult,
    ModalConfig,
    ProviderCredentialSpec,
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
    """Sandbox backend executing code in Modal cloud sandboxes.

    Supports named sessions via start_session/stop_session for sandbox reuse
    across multiple execute() calls, or ephemeral execution (no session) which
    spins up a fresh sandbox per call.

    Credentials are passed explicitly to the SDK via ``modal.Client.from_credentials``
    rather than via ``os.environ``. The client + app are constructed lazily on
    first use so a missing/invalid token surfaces at sandbox-creation time —
    consistent with how the rest of Phoenix's SDK adapters fail.
    """

    def __init__(
        self,
        token_id: Secret,
        token_secret: Secret,
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
                "MODAL_TOKEN_SECRET. Set them via setSandboxCredential "
                "or as process environment variables."
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
        """Construct (or reuse) a typed Modal Client bound to this backend's credentials.

        Double-checked locking: the unlocked fast path serves the steady-state
        cache hit, and the re-check inside the lock prevents two concurrent
        first-time callers from each constructing a client.
        """
        import modal

        if self._client is not None:
            return self._client
        async with self._client_lock:
            if self._client is None:
                self._client = await modal.Client.from_credentials.aio(
                    str(self._token_id), str(self._token_secret)
                )
        return self._client

    async def _ensure_app(self) -> App:
        """Look up (or create) the Modal App for sandbox association, using our client.

        Double-checked locking, same rationale as ``_ensure_client``.
        """
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
        """Run code in a sandbox and collect stdout/stderr."""
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


class ModalAdapter(SandboxAdapter):
    key = "MODAL"
    family = "MODAL"
    display_name = "Modal"
    language = "PYTHON"
    config_model = ModalConfig
    credential_specs = [
        ProviderCredentialSpec(
            key=ENV_MODAL_TOKEN_ID,
            display_name="Modal Token ID",
            description="Token ID issued by `modal token new`.",
        ),
        ProviderCredentialSpec(
            key=ENV_MODAL_TOKEN_SECRET,
            display_name="Modal Token Secret",
            description="Token secret issued by `modal token new`.",
        ),
    ]

    @classmethod
    def probe_dependencies(cls) -> None:
        """Verify ``modal`` is installed; ImportError → NOT_INSTALLED."""
        import modal  # noqa: F401

    def build_backend(
        self,
        config: Mapping[str, Any],
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        token_id = config.get(ENV_MODAL_TOKEN_ID) or ""
        token_secret = config.get(ENV_MODAL_TOKEN_SECRET) or ""
        if not token_id or not token_secret:
            raise ValueError(
                "Modal sandbox authentication is not configured. Set both "
                "MODAL_TOKEN_ID and MODAL_TOKEN_SECRET "
                "via setSandboxCredential or as process environment variables."
            )
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        ia = config.get("internet_access") or {}
        mode = ia.get("mode") if isinstance(ia, dict) else getattr(ia, "mode", None)
        block_network: bool = mode == "deny"
        return ModalSandboxBackend(
            token_id=Secret(token_id),
            token_secret=Secret(token_secret),
            timeout=_DEFAULT_TIMEOUT,
            idle_timeout=_DEFAULT_IDLE_TIMEOUT,
            app_name="phoenix-sandbox",
            user_env=user_env,
            packages=packages or None,
            block_network=block_network,
        )
