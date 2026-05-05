from __future__ import annotations

from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AbstractToolset, ExternalToolset

from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.tools.ask_user import ASK_USER_TOOL_DEFINITION
from phoenix.server.agents.chat_v2.tools.bash import BASH_TOOL_DEFINITION
from phoenix.server.agents.chat_v2.tools.set_spans_filter import SET_SPANS_FILTER_TOOL_DEFINITION
from phoenix.server.agents.context import ResolvedContexts


def build_chat_v2_toolsets(contexts: ResolvedContexts) -> AbstractToolset[ChatDependencies]:
    """Build the combined chat-v2 toolset from the user's resolved UI contexts.

    Some tools are always mounted; others are gated on the user's current UI
    state via ``contexts``.
    """
    tools: list[ToolDefinition] = [BASH_TOOL_DEFINITION, ASK_USER_TOOL_DEFINITION]
    project = contexts.project
    if project is not None and project.span_filter is not None:
        tools.append(SET_SPANS_FILTER_TOOL_DEFINITION)
    return ExternalToolset(tools)
