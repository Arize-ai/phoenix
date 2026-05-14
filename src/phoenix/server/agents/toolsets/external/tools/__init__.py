from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.toolsets.external.tools.ask_user import build_ask_user_tool
from phoenix.server.agents.toolsets.external.tools.bash import build_bash_tool
from phoenix.server.agents.toolsets.external.tools.clone_prompt_instance import (
    build_clone_prompt_instance_tool,
)
from phoenix.server.agents.toolsets.external.tools.edit_prompt import build_edit_prompt_tool
from phoenix.server.agents.toolsets.external.tools.read_prompt import build_read_prompt_tool
from phoenix.server.agents.toolsets.external.tools.set_spans_filter import (
    build_set_spans_filter_tool,
)
from phoenix.server.agents.toolsets.external.tools.set_time_range import build_set_time_range_tool

# Registry of external tool metadata (name → ToolDefinition) for callers that
# need static tool descriptors (e.g. tool-span emission) without rebuilding the
# instructions-bound toolset per turn.
_EXTERNAL_TOOL_DEFINITIONS_BY_NAME: dict[str, ToolDefinition] = {
    tool_def.name: tool_def
    for tool_def in (
        build_ask_user_tool(instructions=""),
        build_bash_tool(instructions=""),
        build_clone_prompt_instance_tool(instructions=""),
        build_edit_prompt_tool(instructions=""),
        build_read_prompt_tool(instructions=""),
        build_set_spans_filter_tool(instructions=""),
        build_set_time_range_tool(instructions=""),
    )
}


def get_external_tool_definition(name: str) -> ToolDefinition | None:
    """Look up a registered external tool definition by name."""
    return _EXTERNAL_TOOL_DEFINITIONS_BY_NAME.get(name)


__all__ = [
    "build_ask_user_tool",
    "build_bash_tool",
    "build_clone_prompt_instance_tool",
    "build_edit_prompt_tool",
    "build_read_prompt_tool",
    "build_set_spans_filter_tool",
    "build_set_time_range_tool",
    "get_external_tool_definition",
]
