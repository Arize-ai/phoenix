"""Daytona sandbox backend."""

from __future__ import annotations

import functools
import json
import logging
from typing import TYPE_CHECKING, ClassVar, Mapping, Optional, Sequence

from pydantic import SecretStr
from typing_extensions import override

from phoenix.db.models import LanguageName

from .types import (
    DaytonaConfig,
    DaytonaCredentials,
    DaytonaDeployment,
    ExecutionResult,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
    compute_config_fingerprint,
)

if TYPE_CHECKING:
    from daytona_sdk import (
        AsyncDaytona,
        AsyncSandbox,
        CreateSandboxFromSnapshotParams,
        ExecuteResponse,
    )

logger = logging.getLogger(__name__)


@functools.cache
def _daytona_session_gone_exception_classes() -> tuple[type[BaseException], ...]:
    """Daytona SDK exception classes that mean the remote sandbox is gone.

    ``process.code_run`` can surface either the raw toolbox-client
    ``NotFoundException`` or the wrapped ``DaytonaNotFoundError`` depending
    on whether the call went through ``intercept_errors``. Lazy import keeps
    this module loadable without the optional extra.
    """
    classes: list[type[BaseException]] = []
    try:
        from daytona_sdk import DaytonaNotFoundError

        classes.append(DaytonaNotFoundError)
    except ImportError:
        pass
    try:
        from daytona_toolbox_api_client_async.exceptions import NotFoundException

        classes.append(NotFoundException)
    except ImportError:
        pass
    return tuple(classes)


def _to_execution_result(response: ExecuteResponse) -> ExecutionResult:
    # Daytona ExecuteResponse combines stdout/stderr in `result`.
    output = response.result or ""
    failed = response.exit_code != 0
    return ExecutionResult(
        stdout="" if failed else output,
        stderr=output if failed else "",
        error=output or f"exit code {response.exit_code}" if failed else None,
    )


# Label binding a Phoenix session_key to its Daytona sandbox.
_LABEL_SESSION_KEY = "phoenix_session_key"

# Provider-side TTL ceilings (minutes) — bound the lifetime of a leaked
# sandbox after a hard Phoenix crash.
_AUTO_STOP_INTERVAL_MIN = 5
_AUTO_ARCHIVE_INTERVAL_MIN = 15


class DaytonaSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in Daytona workspaces."""

    provider: ClassVar[str] = "DAYTONA"

    def __init__(
        self,
        api_key: SecretStr,
        language: LanguageName,
        api_url: Optional[str] = None,
        target: Optional[str] = None,
        user_env: Optional[Mapping[str, str]] = None,
        packages: Optional[Sequence[str]] = None,
        network_block_all: bool = False,
    ) -> None:
        self._api_key = api_key
        self._api_url = api_url
        self._target = target
        self._user_env: dict[str, str] = dict(user_env or {})
        self._packages: list[str] = list(packages) if packages else []
        self._network_block_all = network_block_all
        self._language = language
        self._client: Optional[AsyncDaytona] = None
        self.secret_values = compose_secret_values(user_env, self._api_key)

    @override
    def config_fingerprint(self) -> str:
        return compute_config_fingerprint(
            backend_type="DAYTONA",
            packages=self._packages,
            internet_access_mode=str(self._network_block_all),
            language=self._language,
        )

    def _get_client(self) -> AsyncDaytona:
        if self._client is not None:
            return self._client
        # Local alias prevents shadowing Phoenix's DaytonaConfig pydantic model.
        from daytona_sdk import AsyncDaytona
        from daytona_sdk import DaytonaConfig as _SDKDaytonaConfig

        self._client = AsyncDaytona(
            _SDKDaytonaConfig(
                api_key=self._api_key.get_secret_value(),
                api_url=self._api_url,
                target=self._target,
            )
        )
        return self._client

    async def _install_packages(self, workspace: AsyncSandbox) -> None:
        if not self._packages:
            return
        if self._language == "TYPESCRIPT":
            packages_json = json.dumps(self._packages)
            # cwd=/tmp puts node_modules where Daytona's code_run snippets
            # (written to /tmp/dtn_*.ts) can resolve them. npm install -g
            # lands in a path Node's resolver does not search.
            install_code = (
                f"const {{ spawnSync }} = require('node:child_process');\n"
                f"const pkgs = {packages_json};\n"
                f"const r = spawnSync('npm', "
                f"['install', '--no-audit', '--no-fund', '--silent', ...pkgs], "
                f"{{ cwd: '/tmp', encoding: 'utf8' }});\n"
                f"if (r.status !== 0) {{\n"
                f"  throw new Error("
                f"`npm install failed (status=${{r.status}}): "
                f"${{r.stderr || r.stdout}}`);\n"
                f"}}\n"
            )
        else:
            install_code = (
                f"import subprocess, sys\n"
                f"r = subprocess.run(\n"
                f"    [sys.executable, '-m', 'pip', 'install', *{self._packages!r}],\n"
                f"    capture_output=True, text=True\n"
                f")\n"
                f"if r.returncode != 0:\n"
                f"    raise RuntimeError(r.stderr)\n"
            )
        result = await workspace.process.code_run(install_code)
        if result.exit_code != 0:
            tool = "npm" if self._language == "TYPESCRIPT" else "pip"
            raise RuntimeError(
                f"{tool} install {self._packages!r} failed "
                f"(exit {result.exit_code}): {result.result}"
            )

    def _create_params(self, session_key: Optional[str] = None) -> CreateSandboxFromSnapshotParams:
        """Build params for ``client.create()``.

        Reuse path: tag with ``_LABEL_SESSION_KEY``, ``ephemeral=False``.
        One-shot path (no ``session_key``): ``ephemeral=True`` so Daytona
        auto-deletes after stop.
        """
        from daytona_sdk import CodeLanguage, CreateSandboxFromSnapshotParams

        code_language = (
            CodeLanguage.TYPESCRIPT if self._language == "TYPESCRIPT" else CodeLanguage.PYTHON
        )
        labels: Optional[dict[str, str]] = None
        if session_key:
            labels = {_LABEL_SESSION_KEY: session_key}
        return CreateSandboxFromSnapshotParams(
            language=code_language,
            network_block_all=True if self._network_block_all else None,
            labels=labels,
            ephemeral=session_key is None,
            auto_stop_interval=_AUTO_STOP_INTERVAL_MIN,
            auto_archive_interval=_AUTO_ARCHIVE_INTERVAL_MIN,
        )

    async def _list_sandboxes_for_key(self, session_key: str) -> list[AsyncSandbox]:
        """Return all Daytona sandboxes tagged with ``session_key`` (server-side filter)."""
        from daytona_sdk import ListSandboxesQuery

        client = self._get_client()
        query = ListSandboxesQuery(labels={_LABEL_SESSION_KEY: session_key})
        return [sandbox async for sandbox in client.list(query)]

    @override
    async def find_or_create_session(self, session_key: str) -> object:
        """List-by-label; reuse the oldest STARTED sandbox or create fresh.

        Install runs ONLY on the create path — reusing must not re-install.
        Duplicates from races are reaped by provider TTLs.
        """
        client = self._get_client()

        try:
            existing = await self._list_sandboxes_for_key(session_key)
        except Exception as exc:
            # Fall through to create on transient list failures.
            logger.debug(
                "Daytona list failed for session_key=%r; falling through to create: %s",
                session_key,
                exc,
            )
            existing = []

        if existing:
            from daytona_api_client_async.models.sandbox_state import SandboxState

            # Oldest STARTED wins; id tiebreak for determinism.
            for candidate in sorted(existing, key=lambda sb: (sb.created_at, sb.id)):
                if candidate.state == SandboxState.STARTED:
                    logger.debug(
                        "Daytona session reuse: attached to sandbox_id=%s for key=%r",
                        candidate.id,
                        session_key,
                    )
                    return candidate
            logger.debug(
                "Daytona list returned %d candidate(s) for key=%r but none STARTED; "
                "creating a fresh one",
                len(existing),
                session_key,
            )

        sandbox = await client.create(self._create_params(session_key=session_key))
        await self._install_packages(sandbox)
        logger.debug(
            "Daytona session create: sandbox_id=%s for key=%r",
            sandbox.id,
            session_key,
        )
        return sandbox

    @override
    async def execute_in_session(
        self,
        handle: object,
        code: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        """Execute ``code`` via Daytona ``process.code_run``.

        Each ``code_run`` is a fresh subprocess (no Python-global persistence),
        but the sandbox's OS (filesystem, packages, ports, network) is shared
        across concurrent executes.
        """
        try:
            from daytona_sdk import CodeRunParams

            sandbox: AsyncSandbox = handle  # type: ignore[assignment]
            result = await sandbox.process.code_run(
                code,
                params=CodeRunParams(env=self._user_env or None),
                timeout=timeout,
            )
            return _to_execution_result(result)
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
        """Direct one-shot: create ephemeral sandbox, install, run, delete.

        Packages must be (re)installed here because callers reach ``execute``
        without going through ``find_or_create_session``. No label is set,
        so the ephemeral sandbox is invisible to reuse lookups.
        """
        try:
            from daytona_sdk import CodeRunParams

            client = self._get_client()
            workspace = await client.create(self._create_params(session_key=None))
            try:
                await self._install_packages(workspace)
                result = await workspace.process.code_run(
                    code,
                    params=CodeRunParams(env=self._user_env or None),
                    timeout=timeout,
                )
                return _to_execution_result(result)
            finally:
                try:
                    await client.delete(workspace)
                except Exception:
                    logger.warning("Failed to delete ephemeral Daytona workspace", exc_info=True)
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    @override
    async def close_session(self, session_key: str) -> None:
        """Delete every Daytona sandbox tagged with ``session_key`` (idempotent)."""
        client = self._get_client()
        try:
            matches = await self._list_sandboxes_for_key(session_key)
        except Exception as exc:
            logger.warning(
                "Daytona close_session: list failed for key=%r: %s",
                session_key,
                exc,
            )
            return
        for sandbox in matches:
            try:
                await client.delete(sandbox)
            except Exception as exc:
                logger.warning(
                    "Daytona close_session: delete failed for sandbox_id=%s key=%r: %s",
                    sandbox.id,
                    session_key,
                    exc,
                )

    @override
    async def close(self) -> None:
        """Close the lazy SDK client so the httpx pool doesn't leak.

        Per-session cleanup is the manager's job via ``close_session``.
        """
        if self._client is not None:
            try:
                await self._client.close()  # type: ignore[no-untyped-call]  # SDK 0.140 lacks return annotation
            except Exception:
                logger.warning("Failed to close Daytona client", exc_info=True)
            self._client = None

    @override
    def is_session_gone(self, exc: BaseException) -> bool:
        """Classify 404-from-Daytona as session-gone (rebind-recoverable)."""
        return isinstance(exc, _daytona_session_gone_exception_classes())


def _probe_daytona_sdk() -> None:
    import daytona_sdk  # noqa: F401


class DaytonaAdapter(SandboxAdapter[DaytonaConfig, DaytonaCredentials, DaytonaDeployment]):
    backend_type = "DAYTONA"
    display_name = "Daytona"
    hosting_type = "hosted"
    dependency_hints = (
        "Install Phoenix with the `daytona` extra.",
        "Provide `DAYTONA_API_KEY`.",
    )
    config_model = DaytonaConfig
    credentials_model = DaytonaCredentials
    deployment_config_model = DaytonaDeployment

    @classmethod
    def probe_dependencies(cls) -> None:
        _probe_daytona_sdk()

    def build_backend(
        self,
        config: DaytonaConfig,
        *,
        credentials: DaytonaCredentials,
        deployment: DaytonaDeployment,
        user_env: Optional[Mapping[str, str]] = None,
    ) -> SandboxBackend:
        # Fail-closed: empty api_key would let the SDK silently fall back to
        # os.getenv("DAYTONA_API_KEY"), bypassing Phoenix's credential resolution.
        lang = config.language
        api_key = credentials.DAYTONA_API_KEY.get_secret_value()
        if not api_key:
            raise ValueError(
                "Daytona sandbox authentication is not configured. Set "
                "DAYTONA_API_KEY in Settings → Sandboxes → "
                "Daytona → Credentials, or as a process environment variable."
            )
        packages: list[str] = (
            list(config.dependencies.packages) if config.dependencies is not None else []
        )
        network_block_all = (
            config.internet_access is not None and config.internet_access.mode == "deny"
        )
        return DaytonaSandboxBackend(
            api_key=SecretStr(api_key),
            api_url=deployment.api_url,
            target=deployment.target,
            user_env=user_env,
            packages=packages,
            network_block_all=network_block_all,
            language=lang,
        )
