"""PXI driven from a seeded session: one step per PXI eval example."""

from __future__ import annotations

import shlex

from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from evals.harbor.agents.phoenix_chat_agent import (
    _AGENT_DIR,
    _CHAT_CLIENT,
    _STEPS_DIR,
    PhoenixChatAgent,
)

_EXAMPLE_PATH = "/app/example.json"
_SEED_PATH = "/app/seed.json"
_VERIFIER_PYTHONPATH = "/opt/verifier"


class PxiEvalAgent(PhoenixChatAgent):
    """Seed the step's example into a fresh session, then run the continuation turn.

    Harbor uploads each step's ``workdir/example.json`` to the working directory. The
    seeder runs as root because the database is root-only; the chat client then runs as
    the agent user and reaches Phoenix over HTTP like the browser does.
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
        self._step += 1
        out_dir = f"{_STEPS_DIR}/{self._step}"
        seed_command = (
            f"PYTHONPATH={_VERIFIER_PYTHONPATH} python -m evals.harbor.pxi.seed {_EXAMPLE_PATH}"
            f" --model {shlex.quote(self.model_name)} --out {_SEED_PATH}"
        )
        result = await environment.exec(seed_command, user="root")
        if result.return_code != 0:
            raise RuntimeError(result.stderr or result.stdout or "seeding the PXI session failed")
        if (user := environment.default_user) is not None:
            await environment.exec(f"chown {shlex.quote(str(user))} {_SEED_PATH}", user="root")
        command = [
            f"python {_AGENT_DIR}/{_CHAT_CLIENT.name}",
            f"--model {shlex.quote(self.model_name)}",
            f"--seed-file {_SEED_PATH}",
            f"--out-dir {out_dir}",
        ]
        await self._exec(environment, " ".join(command))
        self._session_id = (await self._exec(environment, f"cat {out_dir}/session_id")).strip()
