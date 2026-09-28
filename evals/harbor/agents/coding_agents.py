from __future__ import annotations

import shlex
from pathlib import Path
from typing import Any

from harbor.agents.installed.base import BaseInstalledAgent, EnvVar
from harbor.agents.installed.claude_code import ClaudeCode
from harbor.agents.installed.codex import Codex
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext
from harbor.models.task.config import MCPServerConfig
from harbor.models.trial.paths import EnvironmentPaths

PHOENIX_URL = "http://127.0.0.1:6006"
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CLI_ARCHIVE = _REPO_ROOT / "dist" / "phoenix-cli" / "phoenix-cli.tar.gz"
_CODEX_ARCHIVE_DIR = _REPO_ROOT / "dist" / "codex"
_INSTALL_SCRIPT = Path(__file__).with_name("install_node_archive.sh")
_NODE_ARCH_BY_MACHINE = {"x86_64": "x64", "aarch64": "arm64"}


async def _install_node_archive(
    environment: BaseEnvironment, archive: Path, name: str, *bins: str
) -> None:
    if not archive.is_file():
        raise RuntimeError(f"No {name} archive at {archive}; run `make harbor-stage`")
    upload_dir = f"/installed-agent/{name}"
    remote_archive = f"{upload_dir}/{archive.name}"
    remote_script = f"{upload_dir}/{_INSTALL_SCRIPT.name}"
    await _exec_as_root(environment, f"mkdir -p {upload_dir}")
    await environment.upload_file(archive, remote_archive)
    await environment.upload_file(_INSTALL_SCRIPT, remote_script)
    await _exec_as_root(
        environment, f"sh {remote_script} {remote_archive} /opt/{name} {' '.join(bins)}"
    )


async def _exec_as_root(environment: BaseEnvironment, command: str) -> None:
    result = await environment.exec(command, user="root")
    if result.return_code != 0:
        raise RuntimeError(
            f"`{command}` exited {result.return_code}\n{result.stdout}\n{result.stderr}"
        )


class PhoenixMcpMixin(BaseInstalledAgent):
    def __init__(
        self,
        logs_dir: Path,
        *args: Any,
        mcp_servers: list[MCPServerConfig] | None = None,
        **kwargs: Any,
    ) -> None:
        phoenix = MCPServerConfig(name="phoenix", transport="http", url=f"{PHOENIX_URL}/mcp")
        super().__init__(logs_dir, *args, mcp_servers=[*(mcp_servers or []), phoenix], **kwargs)


class PhoenixCliMixin(BaseInstalledAgent):
    """Keep px outside the task image so only CLI agents can access it."""

    async def install(self, environment: BaseEnvironment) -> None:
        await super().install(environment)
        await _install_node_archive(environment, _CLI_ARCHIVE, "phoenix-cli", "phoenix-cli", "px")
        await self.exec_as_agent(environment, "px --version")


class CodexArchiveMixin(Codex):
    """Harbor's installer downloads nvm and Node from hosts the job allowlist blocks, so
    the archive from ``make harbor-stage`` is uploaded first and the installer, finding
    the pinned version, does nothing."""

    async def install(self, environment: BaseEnvironment) -> None:
        if self.version() is None:
            raise RuntimeError("Codex agents need kwargs.version to select the archive")
        machine = (await environment.exec("uname -m")).stdout.strip()
        arch = _NODE_ARCH_BY_MACHINE[machine]
        archive = _CODEX_ARCHIVE_DIR / f"codex-{self.version()}-linux-{arch}.tar.gz"
        await _install_node_archive(environment, archive, "codex", "codex")
        result = await environment.exec(self._INSTALL_VERSION_COMMAND)
        if result.return_code != 0:
            raise RuntimeError(
                f"codex --version exited {result.return_code}\n{result.stdout}\n{result.stderr}"
            )
        await super().install(environment)


class AgentLogsOwnershipMixin(BaseInstalledAgent):
    """Hand ``/logs/agent`` back to the agent user before every step.

    Claude Code runs as ``environment.default_user`` and writes its session
    transcripts under ``/logs/agent/sessions``. On Daytona, Harbor uploads
    each step's files by extracting a tarball that keeps the uploader's
    ownership, so after step one the directory no longer belongs to the agent
    user and Claude Code cannot write there.

    Workaround for https://github.com/harbor-framework/harbor/issues/1959.
    """

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        if (user := environment.default_user) is not None:
            await environment.exec(
                f"chown -R {shlex.quote(str(user))} {EnvironmentPaths.agent_dir}", user="root"
            )
        await super().run(instruction, environment, context)


class ClaudeCodeMcpAgent(AgentLogsOwnershipMixin, PhoenixMcpMixin, ClaudeCode):
    @staticmethod
    def name() -> str:
        return "claude-code-mcp"


class ClaudeCodeCliAgent(AgentLogsOwnershipMixin, PhoenixCliMixin, ClaudeCode):
    ENV_VARS = [
        *ClaudeCode.ENV_VARS,
        EnvVar("phoenix_endpoint", env="PHOENIX_ENDPOINT", type="str", default=PHOENIX_URL),
    ]

    @staticmethod
    def name() -> str:
        return "claude-code-cli"


class CodexMcpAgent(PhoenixMcpMixin, CodexArchiveMixin):
    @staticmethod
    def name() -> str:
        return "codex-mcp"


class CodexCliAgent(PhoenixCliMixin, CodexArchiveMixin):
    @staticmethod
    def name() -> str:
        return "codex-cli"

    def __init__(
        self,
        logs_dir: Path,
        *args: Any,
        extra_env: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        # Codex has no ENV_VARS descriptors, so pass the endpoint through every shell.
        env = {"PHOENIX_ENDPOINT": PHOENIX_URL, **(extra_env or {})}
        super().__init__(logs_dir, *args, extra_env=env, **kwargs)
