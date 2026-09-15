from __future__ import annotations

import shlex
from pathlib import Path
from typing import Any

from harbor.agents.installed.base import EnvVar
from harbor.agents.installed.claude_code import ClaudeCode
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext
from harbor.models.task.config import MCPServerConfig

PHOENIX_URL = "http://127.0.0.1:6006"
_STEPS_DIR = "/logs/agent/steps"
_STREAM_LOG = "/logs/agent/claude-code.txt"
_SERVER_LOG = "/var/lib/phoenix-eval/server.log"
_REPO_ROOT = Path(__file__).resolve().parents[3]
_CLI_TARBALLS_DIR = _REPO_ROOT / "dist" / "phoenix-cli"
_CLI_INSTALL_SCRIPT = Path(__file__).with_name("install_phoenix_cli.sh")
_CLI_UPLOAD_DIR = "/installed-agent/phoenix-cli"

# Claude Code's --print mode ends its stream-json output with a single ``result`` event
# whose ``result`` field is the final reply text.
_WRITE_ANSWER = r"""
import json, pathlib, sys
stream, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
answer = ""
for line in stream.read_text(errors="replace").splitlines():
    try:
        event = json.loads(line)
    except ValueError:
        continue
    if isinstance(event, dict) and event.get("type") == "result":
        answer = str(event.get("result") or "")
out_dir.mkdir(parents=True, exist_ok=True)
out_dir.joinpath("answer.md").write_text(answer)
sys.stdout.write(answer)
"""


class _PhoenixClaudeCode(ClaudeCode):
    _step: int = 0

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        self._step += 1
        try:
            await super().run(instruction, environment, context)
        finally:
            await self._collect_server_log(environment)
        answer = await self._write_answer(environment)
        context.metadata = {**(context.metadata or {}), "answer": answer}

    async def _write_answer(self, environment: BaseEnvironment) -> str:
        out_dir = f"{_STEPS_DIR}/{self._step}"
        result = await environment.exec(
            f"python -c {shlex.quote(_WRITE_ANSWER)} {_STREAM_LOG} {out_dir}"
        )
        if result.return_code != 0:
            raise RuntimeError(result.stderr or f"writing {out_dir}/answer.md failed")
        return result.stdout or ""

    async def _collect_server_log(self, environment: BaseEnvironment) -> None:
        result = await environment.exec(f"cat {_SERVER_LOG}")
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.joinpath("phoenix-server.log").write_text(result.stdout or "")


class ClaudeCodeMcpAgent(_PhoenixClaudeCode):
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


class ClaudeCodeCliAgent(_PhoenixClaudeCode):
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
