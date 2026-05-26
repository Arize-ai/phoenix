from dataclasses import dataclass
from typing import Literal, TypeAlias

from pydantic_ai import DeferredToolRequests

from phoenix.server.agents.context import ResolvedContexts

AgentOutput: TypeAlias = str | DeferredToolRequests


@dataclass(frozen=True)
class SandboxAvailability:
    """Per-request snapshot of whether any usable sandbox config exists.

    ``has_usable`` is True when at least one ``SandboxConfig`` row is enabled
    AND its parent ``SandboxProvider`` is enabled. Capability gates use this
    to avoid advertising tools that would fail at execution time.
    """

    has_usable: bool


@dataclass
class AgentDependencies:
    contexts: ResolvedContexts
    edit_permission: Literal["manual", "bypass"] = "manual"
    is_viewer: bool = False
    sandbox_availability: SandboxAvailability = SandboxAvailability(has_usable=False)
