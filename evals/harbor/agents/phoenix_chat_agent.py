import json
import os
import shlex
import tempfile
from pathlib import Path

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from evals.harbor.agents.atif import trajectory_from_ui_messages

_ASSETS_DIR = "/opt/phoenix-eval"
_STEPS_DIR = "/logs/agent/steps"
_INSTRUCTION_PATH = "/tmp/instruction.md"
_TRACE_ENDPOINT_ENV_VAR = "HARBOR_PHOENIX_COLLECTOR_ENDPOINT"


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
            f"python {_ASSETS_DIR}/chat_client.py",
            f"--model {shlex.quote(self.model_name)}",
            f"--instruction-file {_INSTRUCTION_PATH}",
            "--step-config step-config.json",
            f"--out-dir {out_dir}",
        ]
        if self._session_id is not None:
            command.append(f"--session-id {shlex.quote(self._session_id)}")
        if os.getenv(_TRACE_ENDPOINT_ENV_VAR):
            command.append("--export-remote-traces")
        await self._exec(environment, " ".join(command))
        self._session_id = (await self._exec(environment, f"cat {out_dir}/session_id")).strip()

    def populate_context_post_run(self, context: AgentContext) -> None:
        """Harbor calls this after downloading ``/logs/agent``; the turn's transcript becomes
        the ATIF ``trajectory.json`` that Harbor uploads back for the verifier."""
        turn_path = self.logs_dir / "steps" / str(self._step) / "turn_messages.json"
        if not turn_path.exists():
            self.logger.debug(f"No transcript at {turn_path}; skipping the ATIF trajectory")
            return
        trajectory = trajectory_from_ui_messages(
            json.loads(turn_path.read_text()),
            session_id=self._session_id,
            agent_name=self.name(),
            agent_version=self.version() or "unknown",
            model_name=self.model_name,
        )
        self.logs_dir.joinpath("trajectory.json").write_text(
            json.dumps(trajectory.to_json_dict(), indent=2, ensure_ascii=False)
        )
        if (metrics := trajectory.final_metrics) is not None:
            context.n_input_tokens = metrics.total_prompt_tokens
            context.n_cache_tokens = metrics.total_cached_tokens
            context.n_output_tokens = metrics.total_completion_tokens

    @staticmethod
    async def _upload_instruction(environment: BaseEnvironment, instruction: str) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as file:
            file.write(instruction)
            instruction_file = Path(file.name)
        try:
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
