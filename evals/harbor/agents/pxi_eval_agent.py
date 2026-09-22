"""PXI driven from a seeded session: one Harbor task per PXI eval example."""

from __future__ import annotations

import json
import shlex
import tempfile
from pathlib import Path
from typing import Any

from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from evals.harbor.agents.phoenix_chat_agent import PhoenixChatAgent
from evals.harbor.pxi.examples import parse_instruction

_EXAMPLE_PATH = "/app/example.json"
_SEED_PATH = "/app/seed.json"
_VERIFIER_PYTHONPATH = "/opt/verifier"


class PxiEvalAgent(PhoenixChatAgent):
    """Seed the task's example into a fresh session, then run the continuation turn.

    The example arrives as the JSON block of the task instruction, the only file Harbor
    hands an agent at run time. The seeder runs as root because the database is
    root-only; the chat client then runs as the agent user and reaches Phoenix over HTTP
    like the browser does.
    """

    @staticmethod
    def name() -> str:
        return "pxi-eval-agent"

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        if not self.model_name:
            raise ValueError(
                "No model specified; pass one with the -m flag, e.g. -m openai/gpt-5.4."
            )
        await self._upload_example(environment, parse_instruction(instruction))
        seed_command = (
            f"PYTHONPATH={_VERIFIER_PYTHONPATH} python -m evals.harbor.pxi.insert_session_into_db {_EXAMPLE_PATH}"
            f" --model {shlex.quote(self.model_name)} --out {_SEED_PATH}"
        )
        result = await environment.exec(seed_command, user="root")
        if result.return_code != 0:
            raise RuntimeError(result.stderr or result.stdout or "seeding the PXI session failed")
        request = (result.stdout or "").strip()
        await self._run_chat_client(environment, [f"--request {shlex.quote(request)}"])

    async def _upload_example(self, environment: BaseEnvironment, example: dict[str, Any]) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as file:
            json.dump(example, file)
            example_file = Path(file.name)
        try:
            await self._upload_for_agent(environment, example_file, _EXAMPLE_PATH)
        finally:
            example_file.unlink()
