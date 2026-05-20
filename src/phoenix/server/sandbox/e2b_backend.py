"""E2B sandbox backend."""

from __future__ import annotations

import functools
import logging
from typing import TYPE_CHECKING, Any, ClassVar, Mapping, Optional, Sequence, cast

from pydantic import SecretStr
from typing_extensions import override

from .types import (
    E2BConfig,
    E2BCredentials,
    E2BDeployment,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
    compute_config_fingerprint,
)

if TYPE_CHECKING:
    from e2b.sandbox.sandbox_api import SandboxInfo
    from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
    from e2b_code_interpreter.models import Context, Execution


@functools.cache
def _e2b_session_gone_exception_classes() -> tuple[type[BaseException], ...]:
    """E2B SDK exception classes meaning the remote sandbox is gone (lazy import)."""
    try:
        from e2b.exceptions import SandboxNotFoundException
    except ImportError:
        return ()
    return (SandboxNotFoundException,)


logger = logging.getLogger(__name__)

ENV_E2B_API_KEY = "E2B_API_KEY"

# Metadata key binding a Phoenix session_key to its E2B sandbox.
_METADATA_SESSION_KEY = "phoenix_session_key"

# Provider-side max-lifetime ceiling so orphans get reaped after a hard
# Phoenix crash (SDK default is 300s).
_SESSION_TIMEOUT_SECONDS = 600


class E2BSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in E2B cloud sandboxes."""

    provider: ClassVar[str] = "E2B"

    def __init__(
        self,
        api_key: SecretStr,
        user_env: Optional[Mapping[str, str]] = None,
        allow_internet_access: bool = True,
        packages: Optional[Sequence[str]] = None,
        domain: Optional[str] = None,
        api_url: Optional[str] = None,
    ) -> None:
        self._api_key = api_key
        self._user_env: dict[str, str] = dict(user_env or {})
        self._allow_internet_access = allow_internet_access
        self._packages: list[str] = list(packages) if packages else []
        self._domain = domain
        self._api_url = api_url
        self.secret_values = compose_secret_values(user_env, self._api_key)

    @override
    def config_fingerprint(self) -> str:
        return compute_config_fingerprint(
            backend_type="E2B",
            packages=self._packages,
            internet_access_mode=str(self._allow_internet_access),
        )

    def _get_sandbox_cls(self) -> type[AsyncSandbox]:
        from e2b_code_interpreter.code_interpreter_async import AsyncSandbox

        return AsyncSandbox

    def _get_sandbox_query_cls(self) -> type[Any]:
        """Lazy-import ``SandboxQuery``; tests patch this to avoid the e2b extra."""
        from e2b.sandbox.sandbox_api import SandboxQuery

        return SandboxQuery

    def _api_opts(self) -> dict[str, Any]:
        """SDK-routing kwargs shared by ``create`` / ``connect`` / ``list`` / ``kill``.

        Do NOT pass ``template`` here: only the SDK default
        (code-interpreter-v1) runs the Jupyter server ``run_code()`` POSTs to;
        the "base" image responds "502 The sandbox is running but port is
        not open".
        """
        opts: dict[str, Any] = {
            "api_key": self._api_key.get_secret_value(),
        }
        if self._domain is not None:
            opts["domain"] = self._domain
        if self._api_url is not None:
            opts["api_url"] = self._api_url
        return opts

    def _create_kwargs(self, session_key: Optional[str]) -> dict[str, Any]:
        """Build kwargs for ``AsyncSandbox.create()``.

        Omitting ``template`` selects ``code-interpreter-v1`` — the only
        image running the Jupyter server ``run_code()`` POSTs to.
        """
        kwargs: dict[str, Any] = {
            "allow_internet_access": self._allow_internet_access,
            "timeout": _SESSION_TIMEOUT_SECONDS,
            **self._api_opts(),
        }
        if session_key is not None:
            kwargs["metadata"] = {_METADATA_SESSION_KEY: session_key}
        return kwargs

    async def _install_packages(self, sandbox: AsyncSandbox) -> None:
        # Do not shlex.quote: the generated code passes a list to
        # subprocess.run (no shell), so shell quoting would break specs like
        # 'numpy>=1.0'. The !r format renders correct Python list literals.
        if not self._packages:
            return
        install_code = (
            "import subprocess, sys\n"
            "r = subprocess.run(\n"
            f"    [sys.executable, '-m', 'pip', 'install', *{self._packages!r}],\n"
            "    capture_output=True, text=True\n"
            ")\n"
            "if r.returncode != 0:\n"
            "    raise RuntimeError(r.stderr)\n"
        )
        execution = await sandbox.run_code(install_code)
        if execution.error:
            raise RuntimeError(f"pip install failed for {self._packages!r}: {execution.error}")

    async def _list_sandboxes_for_key(self, session_key: str) -> list[SandboxInfo]:
        """List running E2B sandboxes tagged with ``session_key`` (server-side filter)."""
        sandbox_cls = self._get_sandbox_cls()
        sandbox_query_cls = self._get_sandbox_query_cls()
        paginator = sandbox_cls.list(
            query=sandbox_query_cls(metadata={_METADATA_SESSION_KEY: session_key}),
            **self._api_opts(),
        )
        results: list[SandboxInfo] = []
        while paginator.has_next:
            results.extend(await paginator.next_items())
        return results

    @override
    async def find_or_create_session(self, session_key: str) -> object:
        """List-by-metadata; connect to the oldest alive sandbox or create fresh.

        Install runs only on the create path. Post-create dedup re-lists and
        kills duplicates from competing replicas (oldest-by-``started_at``
        wins — deterministic across replicas).
        """
        sandbox_cls = self._get_sandbox_cls()

        existing = await self._list_sandboxes_for_key(session_key)
        if existing:
            existing.sort(key=lambda info: info.started_at)
            oldest = existing[0]
            try:
                # connect() is typed as base AsyncSandbox; cast restores the
                # code-interpreter subclass.
                sandbox = cast(
                    "AsyncSandbox",
                    await sandbox_cls.connect(
                        oldest.sandbox_id,
                        **self._api_opts(),
                    ),
                )
            except Exception as exc:
                # Fall through to create on stale handles / reaper races.
                logger.debug(
                    "E2B connect failed for session_key=%r sandbox_id=%s; "
                    "falling through to create: %s",
                    session_key,
                    oldest.sandbox_id,
                    exc,
                )
            else:
                if await self._is_alive(sandbox):
                    logger.debug(
                        "E2B session reuse: connected to sandbox_id=%s for key=%r",
                        oldest.sandbox_id,
                        session_key,
                    )
                    return sandbox
                logger.debug(
                    "E2B sandbox_id=%s for key=%r failed alive probe; creating a fresh one",
                    oldest.sandbox_id,
                    session_key,
                )

        sandbox = await sandbox_cls.create(**self._create_kwargs(session_key))
        await self._install_packages(sandbox)
        return await self._dedupe_after_create(session_key, sandbox)

    async def _dedupe_after_create(
        self,
        session_key: str,
        just_created: AsyncSandbox,
    ) -> AsyncSandbox:
        """Pick oldest-by-``started_at`` survivor; kill the rest (incl. ours if older lost)."""
        sandbox_cls = self._get_sandbox_cls()
        candidates = await self._list_sandboxes_for_key(session_key)
        if len(candidates) <= 1:
            return just_created
        candidates.sort(key=lambda info: info.started_at)
        survivor_info = candidates[0]
        if survivor_info.sandbox_id == just_created.sandbox_id:
            survivor: AsyncSandbox = just_created
        else:
            try:
                survivor = cast(
                    "AsyncSandbox",
                    await sandbox_cls.connect(
                        survivor_info.sandbox_id,
                        **self._api_opts(),
                    ),
                )
            except Exception as exc:
                # Keep our create live rather than enforce oldest-wins on a dead handle.
                logger.warning(
                    "E2B dedup: connect to older survivor sandbox_id=%s "
                    "failed (%s); keeping just-created sandbox_id=%s",
                    survivor_info.sandbox_id,
                    exc,
                    just_created.sandbox_id,
                )
                return just_created
        for loser in candidates[1:]:
            try:
                await sandbox_cls.kill(loser.sandbox_id, **self._api_opts())
            except Exception as exc:
                logger.warning(
                    "E2B dedup: failed to kill loser sandbox_id=%s for key=%r: %s",
                    loser.sandbox_id,
                    session_key,
                    exc,
                )
        return survivor

    async def _is_alive(self, sandbox: AsyncSandbox) -> bool:
        """Best-effort alive probe; treat any SDK error as not-alive."""
        try:
            return await sandbox.is_running()
        except Exception as exc:
            logger.debug(
                "E2B is_running probe failed for sandbox_id=%s: %s",
                getattr(sandbox, "sandbox_id", "<unknown>"),
                exc,
            )
            return False

    @override
    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Execute ``code`` in a per-call code context inside the shared sandbox.

        Each call gets its own kernel (fresh globals, parallel-safe) inside
        the shared sandbox container. Context is removed in ``finally``;
        orphans are reaped when ``close_session`` kills the sandbox.
        """
        sandbox: AsyncSandbox = handle  # type: ignore[assignment]
        ctx: Optional[Context] = None
        try:
            ctx = await sandbox.create_code_context(language="python")
            execution: Execution = await sandbox.run_code(
                code,
                context=ctx,
                envs=self._user_env or None,
                timeout=timeout,
            )
            return _execution_to_result(execution)
        except Exception as exc:
            if self.is_session_gone(exc):
                raise
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))
        finally:
            if ctx is not None:
                try:
                    await sandbox.remove_code_context(ctx)
                except Exception as cleanup_exc:
                    # Best-effort: orphan contexts are reaped on sandbox kill.
                    logger.warning(
                        "E2B remove_code_context failed for sandbox_id=%s: %s",
                        getattr(sandbox, "sandbox_id", "<unknown>"),
                        cleanup_exc,
                    )

    @override
    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Direct one-shot: ephemeral sandbox (untagged) with packages, run, kill."""
        try:
            sandbox_cls = self._get_sandbox_cls()
            async with await sandbox_cls.create(**self._create_kwargs(session_key=None)) as sb:
                await self._install_packages(sb)
                execution: Execution = await sb.run_code(
                    code,
                    envs=self._user_env or None,
                    timeout=timeout,
                )
                return _execution_to_result(execution)
        except Exception as exc:
            return ExecutionResult(
                stdout="",
                stderr=str(exc),
                error=str(exc),
            )

    @override
    async def close_session(self, session_key: str) -> None:
        """Kill every E2B sandbox tagged with ``session_key`` (idempotent)."""
        sandbox_cls = self._get_sandbox_cls()
        try:
            matches = await self._list_sandboxes_for_key(session_key)
        except Exception as exc:
            logger.warning(
                "E2B close_session: list failed for key=%r: %s",
                session_key,
                exc,
            )
            return
        for info in matches:
            try:
                await sandbox_cls.kill(info.sandbox_id, **self._api_opts())
            except Exception as exc:
                logger.warning(
                    "E2B close_session: kill failed for sandbox_id=%s key=%r: %s",
                    info.sandbox_id,
                    session_key,
                    exc,
                )

    @override
    async def close(self) -> None:
        return None

    @override
    def is_session_gone(self, exc: BaseException) -> bool:
        """Classify ``SandboxNotFoundException`` as session-gone.

        Other E2B exceptions are NOT classified — ``TimeoutException``
        conflates per-call timeout with sandbox-idle timeout, so classifying
        it would trigger spurious rebinds on long-running user code.
        """
        return isinstance(exc, _e2b_session_gone_exception_classes())


def _execution_to_result(execution: Execution) -> ExecutionResult:
    stdout = "\n".join(execution.logs.stdout) if execution.logs.stdout else ""
    stderr = "\n".join(execution.logs.stderr) if execution.logs.stderr else ""
    error_str: Optional[str] = str(execution.error) if execution.error else None
    return ExecutionResult(stdout=stdout, stderr=stderr, error=error_str)


class E2BAdapter(SandboxAdapter[E2BConfig, E2BCredentials, E2BDeployment]):
    backend_type = "E2B"
    display_name = "E2B"
    hosting_type = "hosted"
    dependency_hints = (
        "Install Phoenix with the `e2b` extra.",
        "Provide `E2B_API_KEY`.",
    )
    config_model = E2BConfig
    credentials_model = E2BCredentials
    deployment_config_model = E2BDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        import e2b_code_interpreter  # noqa: F401

    def build_backend(
        self,
        config: E2BConfig,
        *,
        credentials: E2BCredentials,
        deployment: E2BDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        # Fail-closed: empty api_key would let the SDK silently fall back to
        # os.getenv("E2B_API_KEY"), bypassing Phoenix's credential resolution.
        api_key = credentials.E2B_API_KEY.get_secret_value()
        if not api_key:
            raise ValueError(
                "E2B sandbox authentication is not configured. Set "
                "E2B_API_KEY in Settings → Sandboxes → E2B → Credentials, "
                "or as a process environment variable."
            )
        allow_internet_access = (
            config.internet_access is None or config.internet_access.mode != "deny"
        )
        packages: list[str] = (
            list(config.dependencies.packages) if config.dependencies is not None else []
        )
        return E2BSandboxBackend(
            api_key=SecretStr(api_key),
            user_env=user_env,
            allow_internet_access=allow_internet_access,
            packages=packages or None,
            domain=deployment.domain,
            api_url=deployment.api_url,
        )
