from dataclasses import dataclass, field
from typing import Literal, TypeAlias

from pydantic_ai import DeferredToolRequests

from phoenix.db.models import LanguageName
from phoenix.server.agents.context import ResolvedContexts

AgentOutput: TypeAlias = str | DeferredToolRequests


@dataclass(frozen=True)
class SandboxConfigCapabilities:
    """Per-request snapshot of one enabled sandbox config's identity, settings,
    and the backend capabilities that bound what the user can request.

    Identity fields name the config so the agent can pick one. Per-config
    setting fields describe what THIS row is configured to do. Backend
    capability fields describe what the underlying adapter is able to support
    — together they tell the agent both the choice the user has made and the
    ceiling of what edits would be legal."""

    # Identity
    sandbox_config_id: str
    """Relay GlobalID for the row (``GlobalID("SandboxConfig", str(row.id))``)."""
    name: str
    language: LanguageName

    # Per-config setting (what THIS config has)
    internet_access: Literal["allow", "deny", "unset"]
    """``"unset"`` when the per-backend ``_Config`` does not compose
    ``SupportsInternetAccess`` or the field is ``None``."""
    dependencies: list[str] = field(default_factory=list)
    env_var_names: list[str] = field(default_factory=list)

    # Backend capability (what this backend CAN support)
    internet_access_mode: Literal["none", "boolean", "allowlist"] = "none"
    supports_env_vars: bool = False
    supports_dependencies: bool = False


@dataclass(frozen=True)
class SandboxAvailability:
    """Per-request snapshot of usable sandbox configs.

    ``configs`` contains one entry per enabled ``SandboxConfig`` row whose
    parent ``SandboxProvider`` is also enabled. ``has_usable`` is derived —
    capability gates use it to avoid advertising tools that would fail at
    execution time."""

    configs: list[SandboxConfigCapabilities] = field(default_factory=list)

    @property
    def has_usable(self) -> bool:
        return bool(self.configs)


@dataclass(frozen=True)
class DatasetExampleSample:
    """A small, prompt-ready snapshot of one active dataset example revision."""

    dataset_example_id: str
    input_json: str
    output_json: str
    metadata_json: str


@dataclass(frozen=True)
class DatasetExampleSamples:
    """Per-request sample of active examples for the mounted dataset context."""

    samples: list[DatasetExampleSample] = field(default_factory=list)

    @property
    def has_samples(self) -> bool:
        return bool(self.samples)


@dataclass
class AgentDependencies:
    contexts: ResolvedContexts
    edit_permission: Literal["manual", "bypass"] = "manual"
    is_viewer: bool = False
    sandbox_availability: SandboxAvailability = field(default_factory=SandboxAvailability)
    dataset_example_samples: DatasetExampleSamples = field(default_factory=DatasetExampleSamples)
