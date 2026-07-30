"""Harbor adapter for Phoenix's in-process ServerAgent."""

import shlex
import tempfile
from pathlib import Path

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

# Trial-wide state (conversation history, tracing session id) must survive
# across steps, but Harbor empties /logs/agent between steps, so it lives on
# the container filesystem instead.
_STATE_DIR = "/var/lib/phoenix-eval"
_STEPS_DIR = "/logs/agent/steps"
_LATEST_LINK = "/logs/agent/latest"
_INSTRUCTION_PATH = "/tmp/instruction.md"


class PhoenixServerAgent(BaseAgent):
    # Harbor reuses the same agent instance for every step of a trial, so the
    # step counter can live here instead of in the container.
    _step: int = 0

    @staticmethod
    def name() -> str:
        return "phoenix-server-agent"

    def version(self) -> str | None:
        return None

    @staticmethod
    def _to_pydantic_ai_model_name(harbor_model_name: str) -> str:
        """Convert a Harbor ``provider/model`` string to pydantic-ai's ``provider:model``."""
        return harbor_model_name.replace("/", ":", 1)

    async def setup(self, environment: BaseEnvironment) -> None:
        # Fixtures are downloaded by each step's workdir/setup.sh task hook.
        return None

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        harbor_model_name = self.model_name
        if not harbor_model_name:
            raise ValueError(
                "No model specified; pass one with the -m flag, "
                "e.g. -m anthropic/claude-sonnet-4-5."
            )
        model_name = self._to_pydantic_ai_model_name(harbor_model_name)
        self._step += 1
        out_dir = f"{_STEPS_DIR}/{self._step}"

        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as file:
            file.write(instruction)
            instruction_file = Path(file.name)
        try:
            await environment.upload_file(instruction_file, _INSTRUCTION_PATH)
        finally:
            instruction_file.unlink()

        # step-config.json is uploaded by Harbor from the step's workdir into
        # the exec working directory.
        command = " ".join(
            [
                "python /opt/phoenix-eval/run_server_agent.py",
                "--db-path /data/phoenix.db",
                f"--instruction-file {_INSTRUCTION_PATH}",
                f"--model {shlex.quote(model_name)}",
                f"--task-name {shlex.quote(environment.environment_name)}",
                "--step-config step-config.json",
                f"--out-dir {out_dir}",
                f"--history-file {_STATE_DIR}/messages.json",
                f"--session-id-file {_STATE_DIR}/tracing_session_id",
                f"--latest-symlink {_LATEST_LINK}",
            ]
        )
        result = await environment.exec(command)
        if result.return_code != 0:
            raise RuntimeError(
                result.stderr
                or result.stdout
                or f"Phoenix ServerAgent runner failed with code {result.return_code}"
            )
        answer = await environment.exec(f"cat {out_dir}/answer.md")
        if answer.return_code != 0:
            raise RuntimeError(
                answer.stderr or f"Runner succeeded but {out_dir}/answer.md is missing"
            )
        context.metadata = {"answer": answer.stdout or ""}
