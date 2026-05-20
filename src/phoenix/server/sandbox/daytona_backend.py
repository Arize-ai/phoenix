"""Daytona sandbox backend."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Mapping, Optional, Sequence

from pydantic import SecretStr

from phoenix.db.models import LanguageName

from .types import (
    DaytonaConfig,
    DaytonaCredentials,
    DaytonaDeployment,
    ExecutionResult,
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
    # Daytona ExecuteResponse combines stdout/stderr in `result`.
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
        self._sessions: dict[str, AsyncSandbox] = {}
        self._client: Optional[AsyncDaytona] = None
        self.secret_values = compose_secret_values(user_env, self._api_key)

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

    def _create_params(self) -> CreateSandboxFromSnapshotParams:
        from daytona_sdk import CodeLanguage, CreateSandboxFromSnapshotParams

        code_language = (
            CodeLanguage.TYPESCRIPT if self._language == "TYPESCRIPT" else CodeLanguage.PYTHON
        )
        return CreateSandboxFromSnapshotParams(
            language=code_language,
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
