from __future__ import annotations

from pathlib import Path
from typing import Any

from harbor.agents.installed.base import BaseInstalledAgent, EnvVar
from harbor.agents.installed.claude_code import ClaudeCode
from harbor.agents.installed.codex import Codex
from harbor.environments.base import BaseEnvironment
from harbor.models.task.config import MCPServerConfig

PHOENIX_URL = "http://127.0.0.1:6006"
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CLI_ARCHIVE = _REPO_ROOT / "dist" / "phoenix-cli" / "phoenix-cli.tar.gz"
_CLI_INSTALL_SCRIPT = Path(__file__).with_name("install_phoenix_cli.sh")
_CLI_UPLOAD_DIR = "/installed-agent/phoenix-cli"


def _with_phoenix_mcp(mcp_servers: list[MCPServerConfig] | None) -> list[MCPServerConfig]:
    phoenix = MCPServerConfig(name="phoenix", transport="http", url=f"{PHOENIX_URL}/mcp")
    return [*(mcp_servers or []), phoenix]


async def _install_phoenix_cli(agent: BaseInstalledAgent, environment: BaseEnvironment) -> None:
    """Upload the px CLI archive built from this checkout and install it for the agent.

    The archive stays out of the task image, so only the CLI agents ever see px.
    """
    if not _CLI_ARCHIVE.is_file():
        raise RuntimeError(f"No px CLI archive at {_CLI_ARCHIVE}")
    archive = f"{_CLI_UPLOAD_DIR}/{_CLI_ARCHIVE.name}"
    script = f"{_CLI_UPLOAD_DIR}/{_CLI_INSTALL_SCRIPT.name}"
    await environment.exec(f"mkdir -p {_CLI_UPLOAD_DIR}", user="root")
    await environment.upload_file(_CLI_ARCHIVE, archive)
    await environment.upload_file(_CLI_INSTALL_SCRIPT, script)
    await agent.exec_as_agent(environment, f"sh {script} {archive} && px --version")


class ClaudeCodeMcpAgent(ClaudeCode):
    """Claude Code with the Phoenix remote MCP server."""

    @staticmethod
    def name() -> str:
        return "claude-code-mcp"

    def __init__(
        self,
        logs_dir: Path,
        *args: Any,
        mcp_servers: list[MCPServerConfig] | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(logs_dir, *args, mcp_servers=_with_phoenix_mcp(mcp_servers), **kwargs)


class ClaudeCodeCliAgent(ClaudeCode):
    """Claude Code with the px CLI and the public Phoenix skills."""

    ENV_VARS = [
        *ClaudeCode.ENV_VARS,
        EnvVar("phoenix_endpoint", env="PHOENIX_ENDPOINT", type="str", default=PHOENIX_URL),
    ]

    @staticmethod
    def name() -> str:
        return "claude-code-cli"

    async def install(self, environment: BaseEnvironment) -> None:
        await super().install(environment)
        await _install_phoenix_cli(self, environment)


class CodexMcpAgent(Codex):
    """Codex with the Phoenix remote MCP server."""

    @staticmethod
    def name() -> str:
        return "codex-mcp"

    def __init__(
        self,
        logs_dir: Path,
        *args: Any,
        mcp_servers: list[MCPServerConfig] | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(logs_dir, *args, mcp_servers=_with_phoenix_mcp(mcp_servers), **kwargs)


class CodexCliAgent(Codex):
    """Codex with the px CLI and the public Phoenix skills."""

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
        # Codex has no ENV_VARS descriptors; its shells see extra_env on every exec.
        env = {"PHOENIX_ENDPOINT": PHOENIX_URL, **(extra_env or {})}
        super().__init__(logs_dir, *args, extra_env=env, **kwargs)

    async def install(self, environment: BaseEnvironment) -> None:
        await super().install(environment)
        await _install_phoenix_cli(self, environment)
