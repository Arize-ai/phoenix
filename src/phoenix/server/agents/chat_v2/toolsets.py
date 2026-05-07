from __future__ import annotations

from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AbstractToolset, CombinedToolset, ExternalToolset

from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.tools.ask_user import ASK_USER_TOOL_DEFINITION
from phoenix.server.agents.chat_v2.tools.bash import BASH_TOOL_DEFINITION
from phoenix.server.agents.chat_v2.tools.edit_prompt import EDIT_PROMPT_TOOL_DEFINITION
from phoenix.server.agents.chat_v2.tools.read_prompt import READ_PROMPT_TOOL_DEFINITION
from phoenix.server.agents.chat_v2.tools.set_spans_filter import SET_SPANS_FILTER_TOOL_DEFINITION


def build_chat_v2_toolsets(deps: ChatDependencies) -> AbstractToolset[ChatDependencies]:
    """Build the combined chat-v2 toolset from request dependencies."""
    external_tools: list[ToolDefinition] = [BASH_TOOL_DEFINITION, ASK_USER_TOOL_DEFINITION]
    project = deps.contexts.project
    playground = deps.contexts.playground
    if project is not None and project.span_filter is not None:
        external_tools.append(SET_SPANS_FILTER_TOOL_DEFINITION)
    if playground is not None:
        external_tools.extend([READ_PROMPT_TOOL_DEFINITION, EDIT_PROMPT_TOOL_DEFINITION])
    toolsets: list[AbstractToolset[ChatDependencies]] = [ExternalToolset(external_tools)]
    if deps.docs_mcp_toolset is not None:
        toolsets.append(deps.docs_mcp_toolset)
    return CombinedToolset(toolsets)
