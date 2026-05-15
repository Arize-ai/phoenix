"""
Daytona sandbox backend.

Requires the ``daytona_sdk`` package (optional extra). Imports of the SDK are
lazy (in ``DaytonaSandboxBackend._get_client`` and ``execute``) so the module
remains importable when the extra is absent. Adapter availability is gated by
``DaytonaPythonAdapter.probe_dependencies`` /
``DaytonaTypescriptAdapter.probe_dependencies`` at registration time, which
surfaces a missing extra as ``status=NOT_INSTALLED`` instead of a runtime
error during evaluation.

Language routing
----------------
- PYTHON     → CreateSandboxFromSnapshotParams(language=CodeLanguage.PYTHON),
               install via subprocess.run([sys.executable, "-m", "pip", "install", ...])
- TYPESCRIPT → CreateSandboxFromSnapshotParams(language=CodeLanguage.TYPESCRIPT),
               install via node:child_process spawnSync("npm", ["install", ...])
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence

from starlette.datastructures import Secret

from ._text import strip_ansi
from .types import (
    DaytonaPythonConfig,
    DaytonaTypescriptConfig,
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
    output = strip_ansi(response.result or "")
    failed = response.exit_code != 0
    return ExecutionResult(
        stdout="" if failed else output,
        stderr=output if failed else "",
        error=output or f"exit code {response.exit_code}" if failed else None,
    )


_DEFAULT_LANGUAGE = "PYTHON"


class DaytonaSandboxBackend(SandboxBackend):
    """Sandbox backend executing code in Daytona workspaces.

    Language routing is driven by ``language`` (PYTHON | TYPESCRIPT). The default
    preserves binary compatibility with every existing call site that does not
    pass ``language=`` explicitly. PYTHON routes ``CreateSandboxFromSnapshotParams``
    to ``CodeLanguage.PYTHON`` and installs packages via ``pip``; TYPESCRIPT
    routes to ``CodeLanguage.TYPESCRIPT`` and installs via ``npm``.
    """

    def __init__(
        self,
        api_key: Secret,
        server_url: str = "",
        user_env: Optional[Mapping[str, str]] = None,
        packages: Optional[Sequence[str]] = None,
        network_block_all: bool = False,
        language: str = _DEFAULT_LANGUAGE,
    ) -> None:
        self._api_key = api_key
        self._server_url = server_url
        self._user_env: dict[str, str] = dict(user_env or {})
        self._packages: list[str] = list(packages) if packages else []
        self._network_block_all = network_block_all
        self._language = language.upper() if language else _DEFAULT_LANGUAGE
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
        """Run language-routed install for configured packages before first user execute.

        PYTHON     → ``subprocess.run([sys.executable, '-m', 'pip', 'install', *pkgs])``
                     argv-style call from a small generated Python snippet.
        TYPESCRIPT → ``spawnSync('npm', ['install', ...pkgs])`` from
                     ``node:child_process`` — package names embedded as a JSON
                     array literal, NOT shell-string interpolation.

        Raises ``RuntimeError`` on non-zero exit so callers (start_session and
        ephemeral execute) propagate the failure.
        """
        if not self._packages:
            return
        if self._language == "TYPESCRIPT":
            packages_json = json.dumps(self._packages)
            # Install into /tmp/node_modules so the package is resolvable
            # from subsequent code_run invocations. Daytona's TS workspace
            # writes each code_run snippet to /tmp/dtn_*.ts and executes it
            # there; Node's require resolver walks /tmp/node_modules first
            # (verified via require.resolve.paths from a live workspace).
            # Default cwd is /home/daytona, and `npm install -g` lands in
            # nvm's lib/node_modules which is NOT on the legacy GLOBAL_FOLDERS
            # lookup path (Node searches lib/node, singular). Pinning cwd
            # to /tmp puts the package exactly where the resolver looks.
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
            return ExecutionResult(
                stdout="", stderr=strip_ansi(str(exc)), error=strip_ansi(str(exc))
            )

    async def close(self) -> None:
        for key in list(self._sessions):
            await self.stop_session(key)
        if self._client is not None:
            try:
                await self._client.close()  # type: ignore[no-untyped-call]  # SDK 0.140 lacks return annotation
            except Exception:
                logger.warning("Failed to close Daytona client", exc_info=True)
            self._client = None


_DAYTONA_CREDENTIAL_SPECS = [
    ProviderCredentialSpec(
        key="PHOENIX_SANDBOX_DAYTONA_API_KEY",
        display_name="Daytona API Key",
        description="API key for the Daytona sandbox service.",
    ),
]


def _build_daytona_backend(
    config: Mapping[str, Any],
    *,
    language: str,
    user_env: Optional[Mapping[str, str]] = None,
) -> SandboxBackend:
    """Construct a DaytonaSandboxBackend for either language adapter.

    Fail-closed on missing credential. Passing an empty api_key would let the
    Daytona SDK silently fall back to ``DAYTONA_API_KEY`` from the process env
    (daytona_sdk/_async/daytona.py:168). The SDK's autodiscovery name differs
    from Phoenix's declared name (``PHOENIX_SANDBOX_DAYTONA_API_KEY``) so that
    fallback would bypass Phoenix's credential resolution entirely.
    """
    api_key: str = config.get("PHOENIX_SANDBOX_DAYTONA_API_KEY") or ""
    if not api_key:
        raise ValueError(
            "Daytona sandbox authentication is not configured. Set "
            "PHOENIX_SANDBOX_DAYTONA_API_KEY via setSandboxCredential or as "
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
        language=language,
    )


def _probe_daytona_sdk() -> None:
    """Verify ``daytona_sdk`` is installed; ImportError → NOT_INSTALLED."""
    import daytona_sdk  # noqa: F401


class DaytonaPythonAdapter(SandboxAdapter):
    key = "DAYTONA_PYTHON"
    family = "DAYTONA"
    display_name = "Daytona"
    language = "PYTHON"
    config_model = DaytonaPythonConfig
    credential_specs = _DAYTONA_CREDENTIAL_SPECS

    @classmethod
    def probe_dependencies(cls) -> None:
        _probe_daytona_sdk()

    def build_backend(
        self, config: Mapping[str, Any], user_env: Optional[Mapping[str, str]] = None
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        return _build_daytona_backend(config, language="PYTHON", user_env=user_env)


class DaytonaTypescriptAdapter(SandboxAdapter):
    key = "DAYTONA_TYPESCRIPT"
    family = "DAYTONA"
    display_name = "Daytona"
    language = "TYPESCRIPT"
    config_model = DaytonaTypescriptConfig
    credential_specs = _DAYTONA_CREDENTIAL_SPECS

    @classmethod
    def probe_dependencies(cls) -> None:
        _probe_daytona_sdk()

    def build_backend(
        self, config: Mapping[str, Any], user_env: Optional[Mapping[str, str]] = None
    ) -> SandboxBackend:
        self._enforce_capabilities(config, user_env)
        return _build_daytona_backend(config, language="TYPESCRIPT", user_env=user_env)
