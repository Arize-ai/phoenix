from __future__ import annotations

from pydantic_ai.toolsets import AbstractToolset, ExternalToolset

from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.tools.ask_user import ASK_USER_TOOL_DEFINITION
from phoenix.server.agents.chat_v2.tools.bash import BASH_TOOL_DEFINITION


def build_chat_v2_toolsets(deps: ChatDependencies) -> AbstractToolset[ChatDependencies]:
    """Build the combined chat-v2 toolset from request dependencies.

    Currently always mounts bash and ask_user. Future slices (set_spans_filter, MCP)
    will conditionally include subtools based on ``deps.contexts``.
    """
    return ExternalToolset([BASH_TOOL_DEFINITION, ASK_USER_TOOL_DEFINITION])
