"""Tenki sandbox backend.

Executes evaluator code in ephemeral Tenki Cloud microVM sandboxes. Modeled
as a stateless backend (:class:`BaseNoSessionBackend`): every ``execute`` call
spins up a fresh sandbox, runs the code, and tears it down. This uses only the
stable Tenki primitives (create / exec / terminate) — no volumes, snapshots,
or custom templates — so evaluations stay on stock guest images.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from pydantic import SecretStr
from typing_extensions import override

from .types import (
    BaseNoSessionBackend,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    TenkiConfig,
    TenkiCredentials,
    TenkiDeployment,
    compose_secret_values,
)

if TYPE_CHECKING:
    from tenki_sandbox import AsyncClient, AsyncSandbox, CommandResult

logger = logging.getLogger(__name__)

ENV_TENKI_API_KEY = "TENKI_API_KEY"

# Seconds to wait for the sandbox to become exec-ready during create().
_CREATE_TIMEOUT_SECONDS = 180

# Extra sandbox lifetime, on top of the evaluation timeout, to cover create,
# package install, and teardown. The sandbox is killed at ``timeout + headroom``
# so a long evaluation is not truncated by the total-lifetime cap.
_LIFETIME_HEADROOM_SECONDS = 300

# Fallback total-lifetime cap when no evaluation timeout is supplied, so an
# orphan is still reaped rather than lingering until the workspace idle sweep.
_DEFAULT_MAX_DURATION_SECONDS = 600

# Prefix for the per-execution sandbox tag used to reap a VM that ``create()``
# created remotely but never returned a handle for (see ``_reap``). Tenki caps
# tags at 32 characters, so the prefix is short and the uuid is truncated:
# len("phx-") + 24 hex chars = 28.
_SESSION_TAG_PREFIX = "phx-"
_SESSION_TAG_UUID_LEN = 24

# Global cap on concurrent Tenki microVMs across all TenkiSandboxBackend
# instances. Tenki VMs are billable and, as a stateless backend, Tenki bypasses
# SandboxSessionManager's per-provider accounting — so we self-limit here,
# mirroring the local Deno backend's process-wide semaphore.
_MAX_CONCURRENT_TENKI_EXECUTIONS = 4

# Rebuilt per running loop because asyncio.Semaphore binds to the loop on first
# use and tests run on fresh loops (same rationale as deno_backend).
_execution_slots: "asyncio.Semaphore | None" = None
_execution_slots_loop: "asyncio.AbstractEventLoop | None" = None


def _get_execution_slots() -> asyncio.Semaphore:
    global _execution_slots, _execution_slots_loop
    loop = asyncio.get_running_loop()
    if _execution_slots is None or _execution_slots_loop is not loop:
        _execution_slots = asyncio.Semaphore(_MAX_CONCURRENT_TENKI_EXECUTIONS)
        _execution_slots_loop = loop
    return _execution_slots


class TenkiSandboxBackend(BaseNoSessionBackend):
    """Stateless sandbox backend executing code in ephemeral Tenki microVMs.

    ``provider`` is intentionally left as the inherited ``""``: stateless
    backends bypass ``SandboxSessionManager``'s per-provider tracking, so a
    provider token would never be read. Because that also means Tenki gets no
    per-provider concurrency limit from the manager, this backend self-limits
    via a process-wide semaphore (``_get_execution_slots``).
    """

    def __init__(
        self,
        api_key: SecretStr,
        user_env: Optional[Mapping[str, str]] = None,
        allow_internet_access: bool = True,
        packages: Optional[Sequence[str]] = None,
        api_url: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> None:
        self._api_key = api_key
        self._user_env: dict[str, str] = dict(user_env or {})
        self._allow_internet_access = allow_internet_access
        self._packages: list[str] = list(packages) if packages else []
        self._api_url = api_url
        # ``project_id`` is required by the create RPC. When unset we resolve it
        # once from the API key's identity (first workspace with a project) and
        # cache it here — mirroring the auto-resolution other Tenki SDKs do.
        self._project_id = project_id
        self._resolved_project_id: Optional[str] = project_id
        # Serializes the one-time who_am_i() resolution so a concurrent first
        # batch fires the lookup once rather than once per in-flight call.
        self._project_id_lock = asyncio.Lock()
        self.secret_values = compose_secret_values(user_env, self._api_key)

    def _get_client(self) -> AsyncClient:
        """Build an ``AsyncClient``; tests patch this to avoid the tenki extra."""
        from tenki_sandbox import AsyncClient

        client_kwargs: dict[str, Any] = {"auth_token": self._api_key.get_secret_value()}
        if self._api_url is not None:
            client_kwargs["base_url"] = self._api_url
        return AsyncClient(**client_kwargs)

    async def _resolve_project_id(self, client: AsyncClient) -> str:
        """Return the pinned project, else the first project the key can see.

        The create RPC rejects a missing ``project_id`` ("project_id is
        required"), and the Python SDK does not auto-resolve it, so we do:
        ``who_am_i`` → first workspace that has a project. The lookup is cached
        and guarded by a lock, so a batch of evaluations pays the round-trip
        exactly once even if the first calls run concurrently.
        """
        if self._resolved_project_id is not None:
            return self._resolved_project_id
        async with self._project_id_lock:
            # Re-check under the lock: a concurrent caller may have resolved it
            # while we waited to acquire.
            if self._resolved_project_id is not None:
                return self._resolved_project_id
            identity = await client.who_am_i()
            for workspace in identity.workspaces:
                if workspace.projects:
                    self._resolved_project_id = workspace.projects[0].id
                    return self._resolved_project_id
            raise RuntimeError(
                "Tenki API key resolves to no workspace/project. Use an API key "
                "scoped to a workspace that has a project, or pin one via the Tenki "
                "provider's deployment config (project_id)."
            )

    def _max_duration(self, timeout: Optional[int]) -> int:
        """Total sandbox lifetime cap, derived from the evaluation timeout.

        A hardcoded cap would truncate any evaluation longer than it, so the
        cap tracks the configured timeout plus headroom for create, package
        install, and teardown. Falls back to a fixed default when no timeout is
        supplied so an orphan is still reaped.
        """
        if timeout is not None and timeout > 0:
            return int(timeout) + _LIFETIME_HEADROOM_SECONDS
        return _DEFAULT_MAX_DURATION_SECONDS

    def _create_kwargs(self, project_id: str, timeout: Optional[int], tag: str) -> dict[str, Any]:
        """Build kwargs for ``AsyncClient.create()``.

        Omitting ``image`` selects Tenki's stock guest image, which has
        ``python3`` and ``pip`` on PATH — the runtime our generated ``exec``
        and pip-install argv rely on. ``allow_outbound`` gates egress; we never
        request ``sticky``/``snapshot_id``/``volumes`` so the sandbox stays
        ephemeral and on stable features only. ``tags`` carries a unique
        per-execution marker so ``_reap`` can find a VM that ``create()``
        created remotely but was interrupted before returning a handle.
        """
        return {
            "project_id": project_id,
            "wait": True,
            "timeout": _CREATE_TIMEOUT_SECONDS,
            "allow_outbound": self._allow_internet_access,
            "max_duration": self._max_duration(timeout),
            "tags": [tag],
        }

    async def _install_packages(self, sandbox: AsyncSandbox) -> None:
        """pip-install ``self._packages`` inside the sandbox before user code.

        Tenki ``exec`` runs argv directly (execve, no shell), so package specs
        are passed as distinct argv elements — no shell quoting, so specs like
        ``numpy>=1.0`` and ``httpx[http2]`` pass through untouched.

        ``--break-system-packages`` is required because Tenki's stock guest
        image is a Debian PEP-668 externally-managed environment, which
        otherwise refuses a system-wide ``pip install``. The sandbox is an
        ephemeral throwaway, so there is no host Python installation to protect.
        """
        if not self._packages:
            return
        result = await sandbox.exec(
            "python3", "-m", "pip", "install", "--break-system-packages", *self._packages
        )
        if not result.ok:
            raise RuntimeError(f"pip install failed for {self._packages!r}: {result.stderr_text}")

    @override
    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """One-shot: create an ephemeral sandbox, install deps, run, tear down.

        ``session_key`` is unused — this backend is stateless, so the session
        manager routes every call straight here without tracking.
        """
        del session_key
        # Unique marker so a VM that create() spun up remotely but never
        # returned a handle for (failure/cancellation) can still be found and
        # terminated in _reap. Kept <= 32 chars to satisfy Tenki's tag limit.
        tag = f"{_SESSION_TAG_PREFIX}{uuid.uuid4().hex[:_SESSION_TAG_UUID_LEN]}"
        try:
            # Self-limit concurrent billable VMs (no per-provider cap applies to
            # stateless backends).
            async with _get_execution_slots():
                client = self._get_client()
                # The sandbox's data plane rides the client's channel, so the
                # client must outlive the exec; both are torn down in finally.
                try:
                    project_id = await self._resolve_project_id(client)
                    sandbox: Optional[AsyncSandbox] = None
                    try:
                        sandbox = await client.create(
                            **self._create_kwargs(project_id, timeout, tag)
                        )
                        await self._install_packages(sandbox)
                        # Pass the source via argv (``python3 -c <code>``) rather
                        # than a shell string so arbitrary code needs no escaping.
                        # User env is applied per-call, never baked into the image.
                        result = await sandbox.exec(
                            "python3",
                            "-c",
                            code,
                            env=self._user_env or None,
                            timeout=timeout,
                        )
                        return _command_result_to_execution_result(result)
                    finally:
                        await self._reap(client, sandbox, tag)
                finally:
                    await client.close()
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def _reap(
        self,
        client: AsyncClient,
        sandbox: Optional[AsyncSandbox],
        tag: str,
    ) -> None:
        """Terminate this call's sandbox — even if ``create()`` was interrupted.

        With a handle, close it. Without one (``create()`` failed or was
        cancelled after the VM came up), the VM may still be RUNNING, so find it
        by its unique ``tag`` and terminate it. Teardown is shielded so a
        cancellation of the enclosing evaluation still tears the VM down rather
        than leaking a billable sandbox.
        """
        task = asyncio.ensure_future(self._do_reap(client, sandbox, tag))
        try:
            await asyncio.shield(task)
        except asyncio.CancelledError:
            await task  # let teardown finish despite the cancellation, then re-raise
            raise

    async def _do_reap(
        self,
        client: AsyncClient,
        sandbox: Optional[AsyncSandbox],
        tag: str,
    ) -> None:
        try:
            if sandbox is not None:
                await sandbox.close_if_open()
                return
            for orphan in await client.list(tags=[tag]):
                try:
                    await orphan.close_if_open()
                except Exception as exc:
                    logger.warning("Tenki reap: failed to terminate orphan for %s: %s", tag, exc)
        except Exception as exc:
            logger.warning("Tenki reap failed for %s: %s", tag, exc)

    @override
    async def close(self) -> None:
        return None


def _command_result_to_execution_result(result: CommandResult) -> ExecutionResult:
    """Map a Tenki ``CommandResult`` to Phoenix's ``ExecutionResult``.

    A non-zero exit (or a terminating signal) surfaces as ``error`` so the
    evaluator run is marked failed; ``ExecutionResult`` strips ANSI on
    construction.
    """
    error: Optional[str] = None
    if not result.ok:
        error = result.stderr_text or f"process exited with code {result.exit_code}"
    return ExecutionResult(
        stdout=result.stdout_text,
        stderr=result.stderr_text,
        error=error,
    )


class TenkiAdapter(SandboxAdapter[TenkiConfig, TenkiCredentials, TenkiDeployment]):
    backend_type = "TENKI"
    display_name = "Tenki"
    hosting_type = "hosted"
    dependency_hints = (
        "Install Phoenix with the `tenki` extra.",
        "Provide `TENKI_API_KEY`.",
    )
    config_model = TenkiConfig
    credentials_model = TenkiCredentials
    deployment_config_model = TenkiDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        import tenki_sandbox  # noqa: F401

    def build_backend(
        self,
        config: TenkiConfig,
        *,
        credentials: TenkiCredentials,
        deployment: TenkiDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        # Fail-closed: an empty api_key would let the SDK silently fall back to
        # TENKI_AUTH_TOKEN / TENKI_API_KEY in the process env, bypassing
        # Phoenix's credential resolution.
        api_key = credentials.TENKI_API_KEY.get_secret_value()
        if not api_key:
            raise ValueError(
                "Tenki sandbox authentication is not configured. Set "
                "TENKI_API_KEY in Settings → Sandboxes → Tenki → Credentials, "
                "or as a process environment variable."
            )
        allow_internet_access = (
            config.internet_access is None or config.internet_access.mode != "deny"
        )
        packages: list[str] = (
            list(config.dependencies.packages) if config.dependencies is not None else []
        )
        return TenkiSandboxBackend(
            api_key=SecretStr(api_key),
            user_env=user_env,
            allow_internet_access=allow_internet_access,
            packages=packages or None,
            api_url=deployment.api_url,
            project_id=deployment.project_id,
        )
