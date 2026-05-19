from __future__ import annotations

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
    render_generative_ui,
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
from phoenix.server.agents.capabilities.tools.external.render_generative_ui import (
    RenderGenerativeUICapability,
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
        render_generative_ui.RENDER_GENERATIVE_UI_TOOL_DEFINITION,
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
) -> CapabilityFunc[AgentDependencies]:
    """Return a ``CapabilityFunc`` that assembles the per-run external-tool
    capability bundle. Static capabilities are always included; dynamic
    capabilities self-gate via ``include_for_run``.
    """
    static_capabilities: list[AbstractStaticCapability[AgentDependencies]] = [
        BashCapability(instructions=instructions.bash_tool),
        AskUserCapability(instructions=instructions.ask_user_tool),
        SetTimeRangeCapability(instructions=instructions.set_time_range_tool),
        RenderGenerativeUICapability(instructions=instructions.render_generative_ui_tool),
    ]
    dynamic_capabilities: list[AbstractDynamicCapability[AgentDependencies]] = [
        SetSpansFilterCapability(instructions=instructions.set_spans_filter_tool),
        ReadPromptInstanceCapability(instructions=instructions.read_prompt_instance_tool),
        ClonePromptInstanceCapability(instructions=instructions.clone_prompt_instance_tool),
        EditPromptInstanceCapability(instructions=instructions.edit_prompt_instance_tool),
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
    "RenderGenerativeUICapability",
    "SetSpansFilterCapability",
    "SetTimeRangeCapability",
    "get_external_tool_capability_function",
    "get_external_tool_definition",
]
