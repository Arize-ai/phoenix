import json
import shlex
from pathlib import Path
from typing import Any

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from evals.harbor.agents.atif import llm_latencies_ms, trajectory_from_ui_messages

_AGENT_DIR = "/installed-agent/phoenix-chat"
_CHAT_CLIENT = Path(__file__).with_name("chat_client.py")
_TURN_TIMEOUT_SECONDS = 1800.0
_START_PHOENIX_SERVER = "/opt/phoenix-eval/start_phoenix_server.sh"


class PhoenixChatAgent(BaseAgent):
    _step: int = 0
    _session_id: str | None = None
    _phoenix_version: str | None = None

    def __init__(self, *args: Any, mcp_code_mode: bool = True, **kwargs: Any) -> None:
        """``mcp_code_mode=False`` gives PXI one tool per endpoint instead of ``execute``."""
        super().__init__(*args, **kwargs)
        self._mcp_code_mode = mcp_code_mode

    @staticmethod
    def name() -> str:
        return "phoenix-chat-agent"

    def version(self) -> str | None:
        return self._phoenix_version

    async def setup(self, environment: BaseEnvironment) -> None:
        if not self._mcp_code_mode:
            # The task's healthcheck already started Phoenix with the default
            # surface; restart it as root, which can read the fixture.
            result = await environment.exec(
                f"sh {_START_PHOENIX_SERVER} --restart",
                env={"PHOENIX_AGENTS_ENABLE_MCP_CODE_MODE": "false"},
                user="root",
            )
            if result.return_code != 0:
                raise RuntimeError(f"Could not restart Phoenix: {result.stderr or result.stdout}")
        await environment.exec(f"mkdir -p {_AGENT_DIR}", user="root")
        await environment.upload_file(_CHAT_CLIENT, f"{_AGENT_DIR}/{_CHAT_CLIENT.name}")
        version = await self._exec(
            environment, "python -c 'import phoenix; print(phoenix.__version__)'"
        )
        self._phoenix_version = version.strip() or None

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        if not self.model_name:
            raise ValueError(
                "No model specified; pass one with the -m flag, e.g. -m anthropic/claude-sonnet-4-5."
            )
        command = [
            f"--instruction {shlex.quote(instruction)}",
            "--allow-mutations",
            f"--turn-timeout-seconds {_TURN_TIMEOUT_SECONDS}",
        ]
        if self._session_id is not None:
            command.append(f"--session-id {shlex.quote(self._session_id)}")
        await self._run_chat_client(environment, command)

    async def _run_chat_client(self, environment: BaseEnvironment, arguments: list[str]) -> None:
        """Run one turn through the chat client and save what it prints under ``steps/``."""
        self._step += 1
        command = [
            f"python {_AGENT_DIR}/{_CHAT_CLIENT.name}",
            f"--model {shlex.quote(self.model_name)}",
            *arguments,
        ]
        result = json.loads(await self._exec(environment, " ".join(command)))
        self._session_id = str(result["session_id"])
        step_dir = self.logs_dir / "steps" / str(self._step)
        step_dir.mkdir(parents=True, exist_ok=True)
        for name in ("turn_messages", "turn_spans", "stream_errors"):
            step_dir.joinpath(f"{name}.json").write_text(json.dumps(result[name], indent=2) + "\n")

    def populate_context_post_run(self, context: AgentContext) -> None:
        """Write the downloaded transcript as the ATIF ``trajectory.json``."""
        step_dir = self.logs_dir / "steps" / str(self._step)
        turn_path = step_dir / "turn_messages.json"
        if not turn_path.exists():
            self.logger.debug(f"No transcript at {turn_path}; skipping the ATIF trajectory")
            return
        spans_path = step_dir / "turn_spans.json"
        spans = json.loads(spans_path.read_text()) if spans_path.exists() else None
        trajectory = trajectory_from_ui_messages(
            json.loads(turn_path.read_text()),
            session_id=self._session_id,
            agent_name=self.name(),
            agent_version=self.version() or "unknown",
            model_name=self.model_name,
            spans=spans,
        )
        self.logs_dir.joinpath("trajectory.json").write_text(
            json.dumps(trajectory.to_json_dict(), indent=2, ensure_ascii=False)
        )
        if (metrics := trajectory.final_metrics) is not None:
            context.n_input_tokens = metrics.total_prompt_tokens
            context.n_cache_tokens = metrics.total_cached_tokens
            context.n_output_tokens = metrics.total_completion_tokens
        if (latencies := llm_latencies_ms(trajectory)) is not None:
            context.metadata = {**(context.metadata or {}), "api_request_times_msec": latencies}

    @staticmethod
    async def _exec(environment: BaseEnvironment, command: str) -> str:
        result = await environment.exec(command)
        if result.return_code != 0:
            raise RuntimeError(
                result.stderr
                or result.stdout
                or f"{command!r} failed with code {result.return_code}"
            )
        return result.stdout or ""
