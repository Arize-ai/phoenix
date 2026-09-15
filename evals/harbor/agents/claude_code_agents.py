from __future__ import annotations

from pathlib import Path
from typing import Any

from harbor.agents.installed.base import EnvVar
from harbor.agents.installed.claude_code import ClaudeCode
from harbor.environments.base import BaseEnvironment
from harbor.models.task.config import MCPServerConfig

PHOENIX_URL = "http://127.0.0.1:6006"
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CLI_TARBALLS_DIR = _REPO_ROOT / "dist" / "phoenix-cli"
_CLI_INSTALL_SCRIPT = Path(__file__).with_name("install_phoenix_cli.sh")
_CLI_UPLOAD_DIR = "/installed-agent/phoenix-cli"


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
        phoenix = MCPServerConfig(name="phoenix", transport="http", url=f"{PHOENIX_URL}/mcp")
        super().__init__(logs_dir, *args, mcp_servers=[*(mcp_servers or []), phoenix], **kwargs)


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
        if not any(_CLI_TARBALLS_DIR.glob("*.tgz")):
            raise RuntimeError(
                f"No px CLI tarballs in {_CLI_TARBALLS_DIR}; "
                "run 'make harbor-stage-environments' first"
            )
        tarballs_dir = f"{_CLI_UPLOAD_DIR}/tarballs"
        script = f"{_CLI_UPLOAD_DIR}/{_CLI_INSTALL_SCRIPT.name}"
        await environment.exec(f"mkdir -p {tarballs_dir}", user="root")
        await environment.upload_dir(_CLI_TARBALLS_DIR, tarballs_dir)
        await environment.upload_file(_CLI_INSTALL_SCRIPT, script)
        await self.exec_as_agent(environment, f"sh {script} {tarballs_dir} && px --version")
