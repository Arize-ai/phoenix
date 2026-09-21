import json
import shlex
import tempfile
from pathlib import Path

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from evals.harbor.agents.atif import llm_latencies_ms, trajectory_from_ui_messages

_AGENT_DIR = "/installed-agent/phoenix-chat"
_CHAT_CLIENT = Path(__file__).with_name("chat_client.py")
_STEPS_DIR = "/logs/agent/steps"
_INSTRUCTION_PATH = "/tmp/instruction.md"
_WORLD_READABLE = 0o644
_TURN_TIMEOUT_SECONDS = 1800.0


class PhoenixChatAgent(BaseAgent):
    _step: int = 0
    _session_id: str | None = None
    _phoenix_version: str | None = None

    @staticmethod
    def name() -> str:
        return "phoenix-chat-agent"

    def version(self) -> str | None:
        return self._phoenix_version

    async def setup(self, environment: BaseEnvironment) -> None:
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
        self._step += 1
        out_dir = f"{_STEPS_DIR}/{self._step}"
        await self._upload_instruction(environment, instruction)
        command = [
            f"python {_AGENT_DIR}/{_CHAT_CLIENT.name}",
            f"--model {shlex.quote(self.model_name)}",
            f"--instruction-file {_INSTRUCTION_PATH}",
            "--allow-mutations",
            "--approve-tool-calls",
            f"--turn-timeout-seconds {_TURN_TIMEOUT_SECONDS}",
            f"--out-dir {out_dir}",
        ]
        if self._session_id is not None:
            command.append(f"--session-id {shlex.quote(self._session_id)}")
        await self._exec(environment, " ".join(command))
        self._session_id = (await self._exec(environment, f"cat {out_dir}/session_id")).strip()

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
    async def _upload_instruction(environment: BaseEnvironment, instruction: str) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as file:
            file.write(instruction)
            instruction_file = Path(file.name)
        try:
            instruction_file.chmod(_WORLD_READABLE)
            await environment.upload_file(instruction_file, _INSTRUCTION_PATH)
        finally:
            instruction_file.unlink()

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
