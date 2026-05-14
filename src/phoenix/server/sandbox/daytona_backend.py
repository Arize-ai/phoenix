"""
Daytona sandbox backend.

Requires the ``daytona_sdk`` package (optional extra). Imports of the SDK are
lazy (in ``DaytonaSandboxBackend._get_client`` and ``execute``) so the module
remains importable when the extra is absent. Adapter availability is gated by
``DaytonaPythonAdapter.probe_dependencies`` at registration time, which
surfaces a missing extra as ``status=NOT_INSTALLED`` instead of a runtime
error during evaluation.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from starlette.datastructures import Secret

from .types import (
    DaytonaPythonConfig,
    ExecutionResult,
    ProviderCredentialSpec,
    SandboxAdapter,
    SandboxBackend,
    compose_secret_values,
)

if TYPE_CHECKING:
    from daytona_sdk import (
        AsyncDaytona,
        AsyncSandbox,
        CreateSandboxFromSnapshotParams,
        ExecuteResponse,
    )

logger = logging.getLogger(__name__)


def _to_execution_result(response: ExecuteResponse) -> ExecutionResult:
    """Map daytona ExecuteResponse (combined stdout/stderr in `result`) to ExecutionResult."""
    output = response.result or ""
    failed = response.exit_code != 0
    return ExecutionResult(
        stdout="" if failed else output,
        stderr=output if failed else "",
        error=output or f"exit code {response.exit_code}" if failed else None,
    )


class DaytonaSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in Daytona workspaces."""

    def __init__(
        self,
        api_key: Secret,
        server_url: str = "",
        user_env: Optional[Mapping[str, str]] = None,
        packages: Optional[Sequence[str]] = None,
        network_block_all: bool = False,
    ) -> None:
        self._api_key = api_key
        self._server_url = server_url
        self._user_env: dict[str, str] = dict(user_env or {})
        self._packages: list[str] = list(packages) if packages else []
        self._network_block_all = network_block_all
        self._sessions: dict[str, AsyncSandbox] = {}
        self._client: Optional[AsyncDaytona] = None
        self.secret_values = compose_secret_values(user_env, self._api_key)

    def _get_client(self) -> AsyncDaytona:
        if self._client is not None:
            return self._client
        from daytona_sdk import AsyncDaytona, DaytonaConfig

        self._client = AsyncDaytona(
            DaytonaConfig(
                api_key=str(self._api_key),
                api_url=self._server_url or None,
            )
        )
        return self._client

    async def _install_packages(self, workspace: AsyncSandbox) -> None:
        """Run pip install for configured packages before first user execute."""
        if not self._packages:
            return
        pkg_args = " ".join(self._packages)
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
            raise RuntimeError(
                f"pip install {pkg_args!r} failed (exit {result.exit_code}): {result.result}"
            )

    def _create_params(self) -> CreateSandboxFromSnapshotParams:
        from daytona_sdk import CodeLanguage, CreateSandboxFromSnapshotParams

        return CreateSandboxFromSnapshotParams(
            language=CodeLanguage.PYTHON,
            network_block_all=True if self._network_block_all else None,
        )

    async def start_session(self, session_key: str) -> None:
        if session_key in self._sessions:
            logger.debug(f"Daytona session '{session_key}' already exists; reusing")
            return
        client = self._get_client()
        workspace = await client.create(self._create_params())
        await self._install_packages(workspace)
        self._sessions[session_key] = workspace
        logger.debug(f"Started Daytona session '{session_key}'")

    async def stop_session(self, session_key: str) -> None:
        workspace = self._sessions.pop(session_key, None)
        if workspace is not None:
            client = self._get_client()
            await client.delete(workspace)
            logger.debug(f"Stopped Daytona session '{session_key}'")

    async def execute(
        self,
        code: str,
        session_key: str,
        timeout: Optional[int] = None,
    ) -> ExecutionResult:
        try:
            from daytona_sdk import CodeRunParams

            workspace = self._sessions.get(session_key)
            if workspace is not None:
                result = await workspace.process.code_run(
                    code, params=CodeRunParams(env=self._user_env or None)
                )
                return _to_execution_result(result)
            else:
                client = self._get_client()
                workspace = await client.create(self._create_params())
                try:
                    await self._install_packages(workspace)
                    result = await workspace.process.code_run(
                        code, params=CodeRunParams(env=self._user_env or None)
                    )
                    return _to_execution_result(result)
                finally:
                    try:
                        await client.delete(workspace)
                    except Exception:
                        logger.warning(
                            "Failed to delete ephemeral Daytona workspace", exc_info=True
                        )
        except Exception as exc:
            return ExecutionResult(stdout="", stderr=str(exc), error=str(exc))

    async def close(self) -> None:
        for key in list(self._sessions):
            await self.stop_session(key)
        if self._client is not None:
            try:
                await self._client.close()  # type: ignore[no-untyped-call]  # SDK 0.140 lacks return annotation
            except Exception:
                logger.warning("Failed to close Daytona client", exc_info=True)
            self._client = None


class DaytonaPythonAdapter(SandboxAdapter):
    key = "DAYTONA_PYTHON"
    family = "DAYTONA"
    display_name = "Daytona"
    language = "PYTHON"
    config_model = DaytonaPythonConfig
    credential_specs = [
        ProviderCredentialSpec(
            key="DAYTONA_API_KEY",
            display_name="Daytona API Key",
            description="API key for the Daytona sandbox service.",
        ),
    ]

    @classmethod
    def probe_dependencies(cls) -> None:
        """Verify ``daytona_sdk`` is installed; ImportError → NOT_INSTALLED."""
        import daytona_sdk  # noqa: F401

    def build_backend(
        self, config: Mapping[str, Any], user_env: Optional[Mapping[str, str]] = None
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        # Fail-closed on missing credential. Passing an empty api_key would let
        # the Daytona SDK silently fall back to ``DAYTONA_API_KEY`` from the
        # process env (daytona_sdk/_async/daytona.py:168). Phoenix's resolver
        # already consults that env var, so reaching this branch with an empty
        # key means Phoenix decided "no credential available"; raise rather
        # than let the SDK auto-discover and bypass that decision.
        api_key: str = config.get("DAYTONA_API_KEY") or ""
        if not api_key:
            raise ValueError(
                "Daytona sandbox authentication is not configured. Set "
                "DAYTONA_API_KEY via setSandboxCredential or as "
                "a process environment variable."
            )
        deps = config.get("dependencies") or {}
        packages: list[str] = deps.get("packages", []) if isinstance(deps, dict) else []
        internet_access = config.get("internet_access") or {}
        mode: str = internet_access.get("mode", "") if isinstance(internet_access, dict) else ""
        network_block_all = mode == "deny"
        return DaytonaSandboxBackend(
            api_key=Secret(api_key),
            server_url="",
            user_env=user_env,
            packages=packages,
            network_block_all=network_block_all,
        )
