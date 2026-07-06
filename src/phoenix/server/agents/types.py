from dataclasses import dataclass, field
from typing import Literal, TypeAlias

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


@dataclass(frozen=True)
class ModelProviderAvailability:
    """Pre-turn gate for model-provider-backed capabilities (the LLM-as-a-judge evaluator).

    ``has_usable`` is true when at least one generative provider has its SDK
    installed. It is a heuristic for tool advertisement, not a guarantee the
    evaluator will succeed: per-request credentials can arrive at run time, so the
    gate deliberately does not consider ``credentials_set``. The agent prefers
    providers with credentials already configured and alerts the user to gaps by
    fetching ``modelProviders`` on-demand via ``phoenix-gql``; runtime failures
    still surface downstream via the test result's evaluation error."""

    has_usable: bool = False


@dataclass
class AgentDependencies:
    contexts: ResolvedContexts
    edit_permission: Literal["manual", "bypass"] = "manual"
    is_viewer: bool = False
    sandbox_availability: SandboxAvailability = field(default_factory=SandboxAvailability)
    model_provider_availability: ModelProviderAvailability = field(
        default_factory=ModelProviderAvailability
    )
