"""PXI driven from a seeded session: one Harbor task per PXI eval example."""

from __future__ import annotations

import json
import shlex

from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from evals.harbor.agents.phoenix_chat_agent import PhoenixChatAgent
from evals.harbor.pxi.examples import parse_instruction

_SEED_PATH = "/app/seed.json"
_VERIFIER_PYTHONPATH = "/opt/verifier"
_HEREDOC_DELIMITER = "PXI_EXAMPLE"


class PxiEvalAgent(PhoenixChatAgent):
    """Seed the task's example into a fresh session, then run the continuation turn.

    The example arrives as the JSON block of the task instruction, the only file Harbor
    hands an agent at run time, and reaches the seeder on stdin. The seeder runs as root
    because the database is root-only and leaves the seed file for the verifier; the chat
    client then runs as the agent user and reaches Phoenix over HTTP like the browser does.
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
        example = json.dumps(parse_instruction(instruction))
        seed_command = (
            f"PYTHONPATH={_VERIFIER_PYTHONPATH} python -m evals.harbor.pxi.insert_session_into_db"
            f" --model {shlex.quote(self.model_name)} --out {_SEED_PATH}"
            f" <<'{_HEREDOC_DELIMITER}'\n{example}\n{_HEREDOC_DELIMITER}\n"
        )
        result = await environment.exec(seed_command, user="root")
        if result.return_code != 0:
            raise RuntimeError(result.stderr or result.stdout or "seeding the PXI session failed")
        request = (result.stdout or "").strip()
        await self._run_chat_client(environment, [f"--request {shlex.quote(request)}"])
