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
_CLI_INSTALL_SCRIPT = Path(__file__).with_name("install_phoenix_cli.sh")
_CLI_UPLOAD_DIR = "/installed-agent/phoenix-cli"


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
    """Keep px outside the task image so only CLI agents can access it.

    Installation requires root access because the script links px into ``/usr/local/bin``.
    """

    async def install(self, environment: BaseEnvironment) -> None:
        await super().install(environment)
        if not _CLI_ARCHIVE.is_file():
            raise RuntimeError(f"No px CLI archive at {_CLI_ARCHIVE}")
        archive = f"{_CLI_UPLOAD_DIR}/{_CLI_ARCHIVE.name}"
        script = f"{_CLI_UPLOAD_DIR}/{_CLI_INSTALL_SCRIPT.name}"
        await environment.exec(f"mkdir -p {_CLI_UPLOAD_DIR}", user="root")
        await environment.upload_file(_CLI_ARCHIVE, archive)
        await environment.upload_file(_CLI_INSTALL_SCRIPT, script)
        await environment.exec(f"sh {script} {archive}", user="root")
        await self.exec_as_agent(environment, "px --version")


class AgentLogsOwnershipMixin(BaseInstalledAgent):
    """Give the agent user back its log directory before each step.

    Between steps Harbor re-uploads the host copy of /logs/agent as a tarball and
    extracts it as root, which preserves the host uid. The agent user then cannot create
    its Claude Code config directories under /logs/agent/sessions. Remove once Harbor
    extracts uploads with --no-same-owner.
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


class CodexMcpAgent(PhoenixMcpMixin, Codex):
    @staticmethod
    def name() -> str:
        return "codex-mcp"


class CodexCliAgent(PhoenixCliMixin, Codex):
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
