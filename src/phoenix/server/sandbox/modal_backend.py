"""
Modal sandbox backend.

Requires the ``modal`` package (optional extra). The SDK import is lazy (in
``ModalSandboxBackend.__init__`` and ``_create_sandbox``) so the module remains
importable when the extra is absent. Adapter availability is gated by
``ModalAdapter.probe_dependencies`` at registration time, which surfaces a
missing extra as ``status=NOT_INSTALLED`` instead of a runtime error during
evaluation.

Authentication: Modal SDK reads MODAL_TOKEN_ID and MODAL_TOKEN_SECRET from
``os.environ``. When DB-stored secrets are resolved for these keys, the
backend writes them into ``os.environ`` before invoking the Modal SDK so
the SDK picks them up.

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
import os
from typing import Any, Optional

from .types import (
    ExecutionResult,
    ModalConfig,
    ProviderCredentialSpec,
    SandboxAdapter,
    SandboxBackend,
)

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 600
_DEFAULT_IDLE_TIMEOUT = 300


class ModalSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in Modal cloud sandboxes.

    Supports named sessions via start_session/stop_session for sandbox reuse
    across multiple execute() calls, or ephemeral execution (no session) which
    spins up a fresh sandbox per call.
    """

    def __init__(
        self,
        timeout: int = _DEFAULT_TIMEOUT,
        idle_timeout: int = _DEFAULT_IDLE_TIMEOUT,
        app_name: str = "phoenix-sandbox",
        user_env: Optional[dict[str, str]] = None,
        packages: Optional[list[str]] = None,
        block_network: bool = False,
        token_id: Optional[str] = None,
        token_secret: Optional[str] = None,
    ) -> None:
        # Modal SDK reads MODAL_TOKEN_ID / MODAL_TOKEN_SECRET from os.environ at
        # client init time. Inject DB-resolved values before the SDK is touched
        # so admins can configure Modal via the secrets table without having to
        # also export the variables in the server process.
        if token_id:
            os.environ["MODAL_TOKEN_ID"] = token_id
        if token_secret:
            os.environ["MODAL_TOKEN_SECRET"] = token_secret

        import modal  # type: ignore[import-not-found]

        self._timeout = timeout
        self._idle_timeout = idle_timeout
        self._user_env: dict[str, str] = user_env or {}
        self._block_network = block_network
        self._sessions: dict[str, Any] = {}
        self._session_locks: dict[str, asyncio.Lock] = {}
        self._app = modal.App.lookup(app_name, create_if_missing=True)
        base_image = modal.Image.debian_slim()
        self._image = base_image.pip_install(packages) if packages else base_image

    async def _create_sandbox(self) -> Any:
        import modal

        kwargs: dict[str, Any] = {
            "app": self._app,
            "image": self._image,
            "timeout": self._timeout,
            "idle_timeout": self._idle_timeout,
        }
        if self._user_env:
            kwargs["env"] = self._user_env
        if self._block_network:
            kwargs["block_network"] = True
        sandbox = await modal.Sandbox.create.aio(**kwargs)
        return sandbox

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

    async def _exec_code(self, sandbox: Any, code: str) -> ExecutionResult:
        """Run code in a sandbox and collect stdout/stderr."""
        proc = await sandbox.exec.aio("python", "-c", code)
        stdout, stderr = await asyncio.gather(
            proc.stdout.read.aio(),
            proc.stderr.read.aio(),
        )
        await proc.wait.aio()
        exit_code = proc.returncode if proc.returncode is not None else 1
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
            sandbox = self._sessions.get(session_key)
            if sandbox is not None:
                return await self._exec_code(sandbox, code)
            else:
                # Ephemeral: create, exec, terminate.
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
    display_name = "Modal"
    language = "PYTHON"
    config_model = ModalConfig
    credential_specs = [
        ProviderCredentialSpec(
            key="MODAL_TOKEN_ID",
            display_name="Modal Token ID",
            description="Token ID issued by `modal token new`.",
        ),
        ProviderCredentialSpec(
            key="MODAL_TOKEN_SECRET",
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
        config: dict[str, Any],
        user_env: Optional[dict[str, str]] = None,
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        ia = config.get("internet_access") or {}
        mode = ia.get("mode") if isinstance(ia, dict) else getattr(ia, "mode", None)
        block_network: bool = mode == "deny"
        token_id = config.get("MODAL_TOKEN_ID") or None
        token_secret = config.get("MODAL_TOKEN_SECRET") or None
        return ModalSandboxBackend(
            timeout=_DEFAULT_TIMEOUT,
            idle_timeout=_DEFAULT_IDLE_TIMEOUT,
            app_name="phoenix-sandbox",
            user_env=user_env,
            packages=packages or None,
            block_network=block_network,
            token_id=token_id,
            token_secret=token_secret,
        )
