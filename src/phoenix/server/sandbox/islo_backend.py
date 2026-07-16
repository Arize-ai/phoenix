"""Islo sandbox backend. Credentials passed explicitly to the SDK, never via os.environ."""

from __future__ import annotations

import asyncio
import functools
import hashlib
import logging
import time
import uuid
from typing import TYPE_CHECKING, ClassVar, Mapping, Optional, Sequence

from pydantic import SecretStr
from typing_extensions import override

from .types import (
    ExecutionResult,
    IsloConfig,
    IsloCredentials,
    IsloDeployment,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
    compute_config_fingerprint,
)

if TYPE_CHECKING:
    from islo import AsyncIslo

logger = logging.getLogger(__name__)

ENV_ISLO_API_KEY = "ISLO_API_KEY"

_DEFAULT_IMAGE = "ghcr.io/islo-labs/islo-runner:latest"

# Provider-side max-lifetime ceiling so orphans get reaped after a hard
# Phoenix crash. Mid-experiment deletion recovers via is_session_gone rebind.
_SESSION_DELETE_AFTER_SECONDS = 3600

# Islo exec is async two-step: start the command, then poll for its result.
_EXEC_POLL_INTERVAL_SECONDS = 1.0
_TERMINAL_EXEC_STATUSES = frozenset({"completed", "failed", "timeout"})

# Deadline for a freshly created (or resumed) sandbox VM to reach 'running'.
_CREATE_READY_DEADLINE_SECONDS = 120

# Sandbox states that will never transition back to 'running'.
_DEAD_SANDBOX_STATUSES = frozenset({"failed", "stopped", "deleted"})


@functools.cache
def _islo_session_gone_exception_classes() -> tuple[type[BaseException], ...]:
    """Islo SDK exception classes meaning the remote sandbox is gone (lazy import)."""
    try:
        from islo.errors import NotFoundError
    except ImportError:
        return ()
    return (NotFoundError,)


class IsloSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in Islo cloud sandboxes."""

    provider: ClassVar[str] = "ISLO"

    def __init__(
        self,
        api_key: SecretStr,
        *,
        user_env: Optional[Mapping[str, str]] = None,
        allow_internet_access: bool = True,
        packages: Optional[Sequence[str]] = None,
    ) -> None:
        self._api_key = api_key
        self._user_env: dict[str, str] = dict(user_env or {})
        self._allow_internet_access = allow_internet_access
        self._packages: list[str] = list(packages) if packages else []
        self._client: Optional[AsyncIslo] = None
        self._client_lock = asyncio.Lock()
        self.secret_values = compose_secret_values(user_env, api_key)

    @override
    def config_fingerprint(self) -> str:
        return compute_config_fingerprint(
            backend_type="ISLO",
            packages=self._packages,
            internet_access_mode=str(self._allow_internet_access),
        )

    @override
    def provider_session_id(self, session_key: str) -> str:
        # Provider-safe name charset/length (Modal precedent): hex digest only.
        return "phx-" + hashlib.sha256(session_key.encode()).hexdigest()[:32]

    def _get_client_cls(self) -> type[AsyncIslo]:
        """Lazy-import ``AsyncIslo``; tests patch this to avoid the islo extra."""
        from islo import AsyncIslo

        return AsyncIslo

    async def _ensure_client(self) -> AsyncIslo:
        # NEVER rely on the SDK's os.getenv("ISLO_API_KEY") fallback: the key
        # must come from Phoenix's credential resolution.
        if self._client is not None:
            return self._client
        client_cls = self._get_client_cls()
        async with self._client_lock:
            if self._client is None:
                self._client = client_cls(api_key=self._api_key.get_secret_value())
        return self._client

    async def _create_sandbox(self, name: str) -> None:
        from islo.types import LifecyclePolicy

        client = await self._ensure_client()
        await client.sandboxes.create_sandbox(
            name=name,
            image=_DEFAULT_IMAGE,
            internet_enabled=self._allow_internet_access,
            lifecycle=LifecyclePolicy(delete_after=_SESSION_DELETE_AFTER_SECONDS),
        )

    async def _wait_until_running(self, name: str) -> None:
        """Poll ``get_sandbox`` until the VM reaches 'running' or a dead state."""
        client = await self._ensure_client()
        deadline = time.monotonic() + _CREATE_READY_DEADLINE_SECONDS
        while True:
            sandbox = await client.sandboxes.get_sandbox(sandbox_name=name)
            if sandbox.status == "running":
                return
            if sandbox.status in _DEAD_SANDBOX_STATUSES:
                raise RuntimeError(
                    f"Islo sandbox {name!r} entered terminal state "
                    f"{sandbox.status!r} before becoming ready"
                )
            if time.monotonic() >= deadline:
                raise RuntimeError(
                    f"Islo sandbox {name!r} did not reach 'running' within "
                    f"{_CREATE_READY_DEADLINE_SECONDS}s (last status: {sandbox.status!r})"
                )
            await asyncio.sleep(_EXEC_POLL_INTERVAL_SECONDS)

    async def _install_packages(self, name: str) -> None:
        # List-form argv, no shell: quoting would break specs like 'numpy>=1.0'.
        if not self._packages:
            return
        result = await self._exec(name, ["python3", "-m", "pip", "install", *self._packages])
        if not result.success:
            raise RuntimeError(f"pip install failed for {self._packages!r}: {result.error}")

    async def _delete_sandbox_if_exists(self, name: str) -> None:
        """Delete the named sandbox, swallowing NotFoundError (idempotent)."""
        from islo.errors import NotFoundError

        client = await self._ensure_client()
        try:
            await client.sandboxes.delete_sandbox(sandbox_name=name)
        except NotFoundError:
            return

    async def _create_ready_sandbox(self, name: str) -> None:
        """Create a sandbox by name, wait for it to boot, and install packages."""
        await self._create_sandbox(name)
        try:
            await self._wait_until_running(name)
            await self._install_packages(name)
        except BaseException:
            # Names are unique among non-deleted sandboxes: leaving a broken
            # sandbox parked under the deterministic name would make every
            # subsequent find_or_create_session fail until the delete_after
            # lifecycle reaps it (~1h). Free the name for the next attempt.
            try:
                await self._delete_sandbox_if_exists(name)
            except Exception:
                logger.exception(f"Failed to clean up broken Islo sandbox '{name}'")
            raise

    async def _create_session_sandbox(self, name: str) -> None:
        """Create a ready session sandbox, re-attaching on a concurrent-create race."""
        from islo.errors import ConflictError

        try:
            await self._create_ready_sandbox(name)
            logger.debug(f"Created Islo session '{name}'")
        except ConflictError:
            # Concurrent winner from another replica; re-attach by name.
            await self._wait_until_running(name)
            logger.debug(f"Islo session '{name}' won by concurrent creator; attaching")

    @override
    async def find_or_create_session(self, session_key: str) -> object:
        """Converge on a named Islo sandbox: reuse running, resume paused, else create.

        Two replicas with the same key converge on the same remote sandbox
        (create-by-name is unique server-side; the ConflictError loser
        re-attaches to the winner's sandbox).
        """
        from islo.errors import NotFoundError

        client = await self._ensure_client()
        name = self.provider_session_id(session_key)
        try:
            sandbox = await client.sandboxes.get_sandbox(sandbox_name=name)
        except NotFoundError:
            await self._create_session_sandbox(name)
            return name
        if sandbox.status in _DEAD_SANDBOX_STATUSES:
            # A dead sandbox still occupies the deterministic name (names are
            # unique among non-deleted sandboxes), so it must be deleted before
            # a fresh one can be created — raising here would hard-fail every
            # execution for this session until the lifecycle reaper runs.
            logger.debug(f"Islo session '{name}' is {sandbox.status!r}; deleting and recreating")
            await self._delete_sandbox_if_exists(name)
            await self._create_session_sandbox(name)
            return name
        if sandbox.status == "paused":
            await client.sandboxes.resume_sandbox(sandbox_name=name)
            await self._wait_until_running(name)
            logger.debug(f"Resumed paused Islo session '{name}'")
        elif sandbox.status != "running":
            await self._wait_until_running(name)
        logger.debug(f"Islo session '{name}' already exists; reusing")
        return name

    async def _exec(
        self,
        name: str,
        command: Sequence[str],
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Two-step Islo exec: start the command, then poll for its result."""
        client = await self._ensure_client()
        started = await client.sandboxes.exec_in_sandbox(
            sandbox_name=name,
            command=list(command),
            env=self._user_env or None,
            timeout_secs=timeout,
        )
        deadline = time.monotonic() + timeout if timeout is not None else None
        while True:
            result = await client.sandboxes.get_exec_result(
                sandbox_name=name, exec_id=started.exec_id
            )
            if result.status in _TERMINAL_EXEC_STATUSES:
                break
            if deadline is not None and time.monotonic() >= deadline:
                # timeout_secs is a server-side hint only; enforce client-side.
                return ExecutionResult(
                    stdout="",
                    stderr="",
                    error=f"Execution timed out after {timeout}s",
                )
            await asyncio.sleep(_EXEC_POLL_INTERVAL_SECONDS)

        error: Optional[str] = None
        if result.status == "timeout":
            # Server-side timeout: exit_code is None, so the generic
            # "exit code None" message would mislead. Mirror the client-side
            # deadline message above.
            error = result.stderr or (
                f"Execution timed out after {timeout}s"
                if timeout is not None
                else "Execution timed out"
            )
        elif result.status != "completed" or result.exit_code != 0:
            if result.exit_code is None:
                error = result.stderr or f"Execution failed (status={result.status!r})"
            else:
                error = result.stderr or f"exit code {result.exit_code}"
        if error is not None and result.truncated:
            error = f"{error}\n[output truncated]"
        return ExecutionResult(stdout=result.stdout, stderr=result.stderr, error=error)

    @override
    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        name: str = handle  # type: ignore[assignment]
        try:
            return await self._exec(name, ["python3", "-c", code], timeout)
        except Exception as exc:
            if self.is_session_gone(exc):
                raise
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    @override
    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Direct one-shot ephemeral execution: create, run, delete."""
        name = f"phx-ephemeral-{uuid.uuid4().hex[:12]}"
        try:
            client = await self._ensure_client()
            await self._create_sandbox(name)
            try:
                await self._wait_until_running(name)
                await self._install_packages(name)
                return await self._exec(name, ["python3", "-c", code], timeout)
            finally:
                await client.sandboxes.delete_sandbox(sandbox_name=name)
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    @override
    async def close_session(self, session_key: str) -> None:
        """Delete the named Islo sandbox bound to ``session_key`` (idempotent)."""
        from islo.errors import NotFoundError

        client = await self._ensure_client()
        name = self.provider_session_id(session_key)
        try:
            await client.sandboxes.delete_sandbox(sandbox_name=name)
            logger.debug(f"Deleted Islo session '{name}'")
        except NotFoundError:
            return

    @override
    async def close(self) -> None:
        # The SDK exposes no public close; its httpx client is reaped with the
        # client object.
        return None

    @override
    def is_session_gone(self, exc: BaseException) -> bool:
        """Classify ``NotFoundError`` as session-gone.

        Other Islo exceptions are NOT classified: auth/5xx errors recur on a
        fresh session, so classifying them would churn rebinds without
        recovering.
        """
        return isinstance(exc, _islo_session_gone_exception_classes())


class IsloAdapter(SandboxAdapter[IsloConfig, IsloCredentials, IsloDeployment]):
    backend_type = "ISLO"
    display_name = "Islo"
    hosting_type = "hosted"
    dependency_hints = (
        "Install Phoenix with the `islo` extra.",
        "Provide `ISLO_API_KEY`.",
    )
    config_model = IsloConfig
    credentials_model = IsloCredentials
    deployment_config_model = IsloDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        import islo  # noqa: F401

    def build_backend(
        self,
        config: IsloConfig,
        *,
        credentials: IsloCredentials,
        deployment: IsloDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        # Fail-closed: empty api_key would let the SDK silently fall back to
        # os.getenv("ISLO_API_KEY"), bypassing Phoenix's credential resolution.
        api_key = credentials.ISLO_API_KEY.get_secret_value()
        if not api_key:
            raise ValueError(
                "Islo sandbox authentication is not configured. Set "
                "ISLO_API_KEY in Settings → Sandboxes → Islo → Credentials, "
                "or as a process environment variable."
            )
        allow_internet_access = (
            config.internet_access is None or config.internet_access.mode != "deny"
        )
        packages: list[str] = (
            list(config.dependencies.packages) if config.dependencies is not None else []
        )
        return IsloSandboxBackend(
            api_key=SecretStr(api_key),
            user_env=user_env,
            allow_internet_access=allow_internet_access,
            packages=packages or None,
        )
