from __future__ import annotations

from opentelemetry.trace import NoOpTracerProvider, TracerProvider
from pydantic_ai import RunContext
from pydantic_ai.capabilities import AbstractCapability, CapabilityFunc, CombinedCapability
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.capabilities.base import (
    AbstractDynamicCapability,
    AbstractStaticCapability,
)
from phoenix.server.agents.capabilities.tools.external import (
    ask_user,
    bash,
    clone_prompt_instance,
    edit_prompt_instance,
    read_prompt_instance,
    set_spans_filter,
    set_time_range,
)
from phoenix.server.agents.capabilities.tools.external.ask_user import AskUserCapability
from phoenix.server.agents.capabilities.tools.external.bash import BashCapability
from phoenix.server.agents.capabilities.tools.external.clone_prompt_instance import (
    ClonePromptInstanceCapability,
)
from phoenix.server.agents.capabilities.tools.external.edit_prompt_instance import (
    EditPromptInstanceCapability,
)
from phoenix.server.agents.capabilities.tools.external.read_prompt_instance import (
    ReadPromptInstanceCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_spans_filter import (
    SetSpansFilterCapability,
)
from phoenix.server.agents.capabilities.tools.external.set_time_range import (
    SetTimeRangeCapability,
)
from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.types import AgentDependencies

_EXTERNAL_TOOL_DEFINITIONS_BY_NAME: dict[str, ToolDefinition] = {
    tool_def.name: tool_def
    for tool_def in (
        ask_user.TOOL_DEFINITION,
        bash.TOOL_DEFINITION,
        clone_prompt_instance.TOOL_DEFINITION,
        edit_prompt_instance.TOOL_DEFINITION,
        read_prompt_instance.TOOL_DEFINITION,
        set_spans_filter.TOOL_DEFINITION,
        set_time_range.TOOL_DEFINITION,
    )
}


def get_external_tool_definition(name: str) -> ToolDefinition | None:
    """Look up a registered external tool definition by name."""
    return _EXTERNAL_TOOL_DEFINITIONS_BY_NAME.get(name)


def get_external_tool_capability_function(
    *,
    instructions: AgentInstructions,
    tracer_provider: TracerProvider | None = None,
) -> CapabilityFunc[AgentDependencies]:
    """Return a ``CapabilityFunc`` that assembles the per-run external-tool
    capability bundle. Static capabilities are always included; dynamic
    capabilities self-gate via ``include_for_run``.
    """
    provider = tracer_provider or NoOpTracerProvider()
    static_capabilities: list[AbstractStaticCapability[AgentDependencies]] = [
        BashCapability(instructions=instructions.bash_tool, tracer_provider=provider),
        AskUserCapability(instructions=instructions.ask_user_tool, tracer_provider=provider),
        SetTimeRangeCapability(
            instructions=instructions.set_time_range_tool, tracer_provider=provider
        ),
    ]
    dynamic_capabilities: list[AbstractDynamicCapability[AgentDependencies]] = [
        SetSpansFilterCapability(
            instructions=instructions.set_spans_filter_tool, tracer_provider=provider
        ),
        ReadPromptInstanceCapability(
            instructions=instructions.read_prompt_instance_tool, tracer_provider=provider
        ),
        ClonePromptInstanceCapability(
            instructions=instructions.clone_prompt_instance_tool, tracer_provider=provider
        ),
        EditPromptInstanceCapability(
            instructions=instructions.edit_prompt_instance_tool, tracer_provider=provider
        ),
    ]

    def _build(ctx: RunContext[AgentDependencies]) -> AbstractCapability[AgentDependencies]:
        included_dynamic = [cap for cap in dynamic_capabilities if cap.include_for_run(ctx)]
        return CombinedCapability(capabilities=[*static_capabilities, *included_dynamic])

    return _build


__all__ = [
    "AskUserCapability",
    "BashCapability",
    "ClonePromptInstanceCapability",
    "EditPromptInstanceCapability",
    "ReadPromptInstanceCapability",
    "SetSpansFilterCapability",
    "SetTimeRangeCapability",
    "get_external_tool_capability_function",
    "get_external_tool_definition",
]
