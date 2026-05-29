from dataclasses import dataclass, field
from typing import TypeAlias

from pydantic_ai import DeferredToolRequests

from phoenix.server.agents.context import ResolvedContexts

AgentOutput: TypeAlias = str | DeferredToolRequests


@dataclass(frozen=True)
class SandboxAvailability:
    """Pre-turn gate for sandbox-backed capabilities.

    ``has_usable`` is true when at least one enabled ``SandboxConfig`` sits
    under an enabled provider on an available backend. Capability gates use it
    to avoid advertising tools that would fail at execution time. The agent
    fetches the selectable inventory on-demand via ``phoenix-gql``, so no
    config list is held here."""

    has_usable: bool = False


@dataclass
class AgentDependencies:
    contexts: ResolvedContexts
    edit_permission: Literal["manual", "bypass"] = "manual"
    is_viewer: bool = False
    sandbox_availability: SandboxAvailability = field(default_factory=SandboxAvailability)
