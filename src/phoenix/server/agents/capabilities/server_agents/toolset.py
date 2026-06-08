from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic_ai import RunContext, Tool
from pydantic_ai.toolsets import FunctionToolset

from phoenix.server.agents.graphql.types import ServerAgentDependencies
from phoenix.server.agents.types import AgentDependencies

if TYPE_CHECKING:
    from pydantic_ai import Agent


class ServerAgentToolset(FunctionToolset[AgentDependencies]):
    """Toolset exposing the main agent's ``call_server_agent`` delegation tool.

    The tool delegates a natural-language question to the GraphQL server agent and
    returns its answer, forwarding ``usage`` so token accounting aggregates into the
    parent run (the pydantic-ai agent-delegation pattern).
    """

    def __init__(
        self,
        *,
        server_agent: Agent[ServerAgentDependencies, str],
        tool_description: str,
    ) -> None:
        async def call_server_agent(ctx: RunContext[AgentDependencies], question: str) -> str:
            result = await server_agent.run(
                question,
                deps=ServerAgentDependencies(),
                usage=ctx.usage,
            )
            return result.output

        super().__init__(
            tools=[Tool(call_server_agent, takes_ctx=True, description=tool_description)]
        )
