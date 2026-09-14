"""Harbor adapter that drives PXI through Phoenix's agent session chat route.

Phoenix serves inside the task container against the fixture database, and a
client in the same container submits each step through the chat route, so the
server owns the transcript exactly as it does for the browser assistant and the
``pxi`` CLI.
"""

import os
import shlex
import tempfile
from pathlib import Path

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

_ASSETS_DIR = "/opt/phoenix-eval"
_STEPS_DIR = "/logs/agent/steps"
_LATEST_LINK = "/logs/agent/latest"
_INSTRUCTION_PATH = "/tmp/instruction.md"
_TRACE_ENDPOINT_ENV_VAR = "HARBOR_PHOENIX_COLLECTOR_ENDPOINT"


class PhoenixChatAgent(BaseAgent):
    # Harbor reuses the same agent instance for every step of a trial, so the
    # session id and step counter live here; the server holds the transcript.
    _step: int = 0
    _session_id: str | None = None

    @staticmethod
    def name() -> str:
        return "phoenix-chat-agent"

    def version(self) -> str | None:
        return None

    async def setup(self, environment: BaseEnvironment) -> None:
        # Fixtures are downloaded by each step's setup hook, which runs after
        # this, so the server starts lazily from run().
        return None

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        if not self.model_name:
            raise ValueError(
                "No model specified; pass one with the -m flag, e.g. -m anthropic/claude-sonnet-4-5."
            )
        self._step += 1
        out_dir = f"{_STEPS_DIR}/{self._step}"
        await self._exec(environment, f"sh {_ASSETS_DIR}/start_phoenix_server.sh", timeout_sec=180)
        await self._upload_instruction(environment, instruction)
        # step-config.json is uploaded by Harbor from the step's workdir into
        # the exec working directory.
        command = [
            f"python {_ASSETS_DIR}/chat_client.py",
            f"--model {shlex.quote(self.model_name)}",
            f"--instruction-file {_INSTRUCTION_PATH}",
            "--step-config step-config.json",
            f"--out-dir {out_dir}",
            f"--latest-symlink {_LATEST_LINK}",
        ]
        if self._session_id is not None:
            command.append(f"--session-id {shlex.quote(self._session_id)}")
        if os.getenv(_TRACE_ENDPOINT_ENV_VAR):
            command.append("--export-remote-traces")
        await self._exec(environment, " ".join(command))
        self._session_id = (await self._exec(environment, f"cat {out_dir}/session_id")).strip()
        context.metadata = {"answer": await self._exec(environment, f"cat {out_dir}/answer.md")}

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
    async def _exec(
        environment: BaseEnvironment, command: str, timeout_sec: int | None = None
    ) -> str:
        result = await environment.exec(command, timeout_sec=timeout_sec)
        if result.return_code != 0:
            raise RuntimeError(
                result.stderr
                or result.stdout
                or f"{command!r} failed with code {result.return_code}"
            )
        return result.stdout or ""
