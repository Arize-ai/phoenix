"""Claude Code agents for the Phoenix Harbor tasks.

Two thin subclasses of Harbor's installed ``ClaudeCode`` agent, one per external surface
Phoenix ships for coding agents:

* ``ClaudeCodeMcpAgent`` registers the Phoenix remote MCP server that the task's Phoenix
  instance mounts at ``/mcp``. The server serves the error-analysis skill itself, so
  nothing is installed on disk.
* ``ClaudeCodeCliAgent`` points the preinstalled ``@arizeai/phoenix-cli`` at the task's
  Phoenix instance, installing it only when the image lacks it or a version override is
  given. Pass the public skills with Harbor's ``--skill`` flag; Harbor uploads them and
  registers them with Claude Code.

Both run with Harbor's defaults for Claude Code (``bypassPermissions``), so the comparison
against the PXI chat agent, whose tool calls are auto-approved, does not measure approval
friction. Run multi-step tasks with ``--resume-trajectory`` so step 2 continues step 1's
conversation, the way the chat agent continues its agent session.

After each step the agent writes the final reply to ``/logs/agent/steps/<n>/answer.md``,
where the task verifiers read it.
"""

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

    def __init__(
        self, logs_dir: Path, *args: Any, phoenix_cli_version: str | None = None, **kwargs: Any
    ) -> None:
        self._phoenix_cli_version = phoenix_cli_version
        super().__init__(logs_dir, *args, **kwargs)

    async def install(self, environment: BaseEnvironment) -> None:
        await super().install(environment)
        if self._phoenix_cli_version is None:
            preinstalled = await environment.exec("px --version")
            if preinstalled.return_code == 0:
                return
        spec = "@arizeai/phoenix-cli" + (
            f"@{self._phoenix_cli_version}" if self._phoenix_cli_version else ""
        )
        await self.exec_as_agent(environment, f"npm install -g {shlex.quote(spec)} && px --version")
