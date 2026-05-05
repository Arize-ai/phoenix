from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.toolsets import AbstractToolset, AgentToolset, ExternalToolset

from phoenix.server.agents.chat_v2.dependencies import ChatDependencies
from phoenix.server.agents.chat_v2.tools.bash import BASH_TOOL_DEFINITION


def bash_toolset(ctx: RunContext[ChatDependencies]) -> AbstractToolset[ChatDependencies]:
    return ExternalToolset([BASH_TOOL_DEFINITION])


CHAT_V2_TOOLSETS: list[AgentToolset[ChatDependencies]] = [bash_toolset]
