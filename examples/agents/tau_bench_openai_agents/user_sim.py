# mypy: ignore-errors
"""
Simulated user for tau-bench tasks.

Wraps tau-bench's LLMUserSimulationEnv to provide a simple interface
for the agent run loop. The simulated user is NOT instrumented — in
production, the user would be a real human sending messages.
"""

from __future__ import annotations

import os
import sys

# Add vendor path so we can import tau-bench
sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "vendor", "tau-bench"),
)

from tau_bench.envs.user import LLMUserSimulationEnv


class SimulatedUser:
    """Wrapper around tau-bench's LLM user simulator.

    Provides a clean interface for the multi-turn conversation loop:
    - reset(instruction) -> first user message
    - step(agent_response) -> next user message or stop signal
    - is_stop(message) -> whether the conversation should end
    """

    STOP_SIGNAL = "###STOP###"

    def __init__(self, model: str = "gpt-4o", provider: str = "openai") -> None:
        self._model = model
        self._provider = provider
        self._user: LLMUserSimulationEnv | None = None

    def reset(self, instruction: str) -> str:
        """Start a new conversation with the given task instruction.

        Creates the LLM user simulator on first call (deferred to avoid
        the eager LLM call in LLMUserSimulationEnv.__init__).

        Returns the first user message.
        """
        # Build the user sim fresh each time — its __init__ calls reset()
        # which would use a stale/no instruction, so we construct here
        # and immediately call reset with the real instruction.
        self._user = object.__new__(LLMUserSimulationEnv)
        self._user.messages = []
        self._user.model = self._model
        self._user.provider = self._provider
        self._user.total_cost = 0.0
        return self._user.reset(instruction=instruction)

    def step(self, agent_response: str) -> str:
        """Pass the agent's response and get the next user message.

        If the user is satisfied, returns a message containing ###STOP###.
        """
        return self._user.step(agent_response)

    @staticmethod
    def is_stop(message: str) -> bool:
        """Check if a user message signals conversation end."""
        return SimulatedUser.STOP_SIGNAL in message
