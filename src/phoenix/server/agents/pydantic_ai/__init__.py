# Import order matters here. ``OpenInferenceToolsetWrapper`` must be bound on
# the package namespace before ``openinference_agent_wrapper`` is loaded —
# the agent wrapper hoists ``get_external_tool_definition`` from
# ``capabilities.tools.external``, whose tool-capability modules pull
# ``OpenInferenceToolsetWrapper`` back through this package. Loading the
# toolset wrapper first breaks the cycle. Keep this manual order — do not
# alphabetize.
# ruff: noqa: I001
from phoenix.server.agents.pydantic_ai.openinference_toolset_wrapper import (
    OpenInferenceToolsetWrapper,
)
from phoenix.server.agents.pydantic_ai.openinference_capability_wrapper import (
    OpenInferenceCapabilityWrapper,
)
from phoenix.server.agents.pydantic_ai.openinference_model_wrapper import (
    OpenInferenceModelWrapper,
)
from phoenix.server.agents.pydantic_ai.openinference_agent_wrapper import (
    OpenInferenceAgentWrapper,
)

__all__ = [
    "OpenInferenceAgentWrapper",
    "OpenInferenceCapabilityWrapper",
    "OpenInferenceModelWrapper",
    "OpenInferenceToolsetWrapper",
]
