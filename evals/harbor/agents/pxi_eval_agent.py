"""PXI driven from a seeded session: one Harbor task per PXI eval example."""

from __future__ import annotations

import json
import shlex
from typing import Any

from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from evals.harbor.agents.phoenix_chat_agent import PhoenixChatAgent
from evals.harbor.pxi.examples import parse_instruction

_VERIFIER_PYTHONPATH = "/opt/verifier"
_HEREDOC_DELIMITER = "PXI_EXAMPLE"


class PxiEvalAgent(PhoenixChatAgent):
    """Seed the task's example into a fresh session, then run the continuation turn.

    The example arrives as the JSON block of the task instruction, the only file Harbor
    hands an agent at run time, and reaches the seeder on stdin. The seeder runs as root
    because the database is root-only; the chat client then runs as the agent user and
    reaches Phoenix over HTTP like the browser does. The verifier learns which messages
    were seeded from the trajectory's ``extra``, which Harbor carries to ``/logs/agent``.
    """

    _seed: dict[str, Any] | None = None

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
            f" --model {shlex.quote(self.model_name)}"
            f" <<'{_HEREDOC_DELIMITER}'\n{example}\n{_HEREDOC_DELIMITER}\n"
        )
        result = await environment.exec(seed_command, user="root")
        if result.return_code != 0:
            raise RuntimeError(result.stderr or result.stdout or "seeding the PXI session failed")
        plan = json.loads(result.stdout)
        self._seed = {"example": plan["example"], "scoring": plan["scoring"]}
        request = json.dumps(plan["request"])
        await self._run_chat_client(environment, [f"--request {shlex.quote(request)}"])

    def _trajectory_extra(self) -> dict[str, Any] | None:
        return None if self._seed is None else {"pxi": self._seed}
