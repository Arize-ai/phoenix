from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai import Agent, RunContext, Tool
from pydantic_ai.toolsets import AgentToolset, FunctionToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

CALL_SUBAGENT_INSTRUCTIONS = """\
You can delegate to a GraphQL server agent that answers questions by querying Phoenix's \
own data (projects, traces, spans, datasets, experiments, evaluations, and more) via the \
`call_subagent` tool. Use it whenever answering requires data from the Phoenix \
backend that you do not already have. Pass a single, self-contained natural-language \
question describing exactly what you need.
"""

CALL_SUBAGENT_TOOL_DESCRIPTION = """\
Delegate a natural-language question to the Phoenix GraphQL server agent, which queries \
the Phoenix backend and returns a concise answer. Use for any question that requires \
data about projects, traces, spans, datasets, experiments, or evaluations.
"""


class CallSubAgentToolset(FunctionToolset[AgentDependencies]):
    """Toolset exposing the main agent's ``call_subagent`` delegation tool.

    The tool delegates a natural-language question to the GraphQL server agent and
    returns its answer, forwarding ``usage`` so token accounting aggregates into the
    parent run (the pydantic-ai agent-delegation pattern).
    """

    def __init__(
        self,
        *,
        server_agent: Agent[None, str],
        tool_description: str,
    ) -> None:
        async def call_subagent(ctx: RunContext[AgentDependencies], question: str) -> str:
            result = await server_agent.run(
                question,
                deps=None,
                usage=ctx.usage,
            )
            return result.output

        super().__init__(tools=[Tool(call_subagent, takes_ctx=True, description=tool_description)])


@dataclass
class CallSubAgentCapability(AbstractStaticCapability[AgentDependencies]):
    """Capability that adds the `call_subagent` tool to an agent."""

    server_agent: Agent[None, str]
    instructions: str = CALL_SUBAGENT_INSTRUCTIONS
    tool_description: str = CALL_SUBAGENT_TOOL_DESCRIPTION

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return CallSubAgentToolset(
            server_agent=self.server_agent,
            tool_description=self.tool_description,
        )

    def get_static_instructions(self) -> str:
        return self.instructions
