from __future__ import annotations

from dataclasses import dataclass

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies


@dataclass
class UIContextsCapability(AbstractStaticCapability[AgentDependencies]):
    """Documents every UI surface the agent can be looking at.

    Deliberately static. This text used to be eleven per-run capabilities that
    each rendered — or withheld — a block based on what was mounted, which put
    the current page inside the cacheable prefix: navigating rewrote the prefix
    and threw away the cached work for the whole conversation behind it. The
    prose now covers every case unconditionally, and the per-turn data that
    decides which case applies rides on the user's message as a
    ``<phoenix_ui_state>`` block instead (see
    :mod:`phoenix.server.agents.ui_state`).
    """

    instructions: str

    def get_static_instructions(self) -> str:
        return self.instructions
