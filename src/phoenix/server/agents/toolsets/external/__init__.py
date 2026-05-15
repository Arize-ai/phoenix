from __future__ import annotations

from phoenix.server.agents.prompts import AgentInstructions
from phoenix.server.agents.toolsets.external.external_tool_definitions import (
    ExternalToolDefinition,
)
from phoenix.server.agents.toolsets.external.tools import (
    build_ask_user_tool,
    build_bash_tool,
    build_clone_prompt_instance_tool,
    build_edit_prompt_tool,
    build_read_prompt_tool,
    build_set_spans_filter_tool,
    build_set_time_range_tool,
)


def build_external_tools(instructions: AgentInstructions) -> list[ExternalToolDefinition]:
    """Build the full set of external tool definitions for one agent, binding
    each tool's instructions text from ``instructions`` at construction time."""
    return [
        build_bash_tool(instructions.bash_tool),
        build_ask_user_tool(instructions.ask_user_tool),
        build_set_time_range_tool(instructions.set_time_range_tool),
        build_set_spans_filter_tool(instructions.set_spans_filter_tool),
        build_read_prompt_tool(instructions.read_prompt_instance_tool),
        build_clone_prompt_instance_tool(instructions.clone_prompt_instance_tool),
        build_edit_prompt_tool(instructions.edit_prompt_instance_tool),
    ]


__all__ = ["build_external_tools"]
