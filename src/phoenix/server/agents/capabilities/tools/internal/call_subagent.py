from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from pydantic_ai import RunContext, Tool
from pydantic_ai.agent.abstract import AbstractAgent
from pydantic_ai.toolsets import AgentToolset, FunctionToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

#: Builds a fresh server agent. A new agent is constructed per ``call_subagent``
#: invocation so each delegation gets its own isolated bash virtual filesystem.
ServerAgentFactory = Callable[[], AbstractAgent[None, str]]

CALL_SUBAGENT_TOOL_DESCRIPTION = """\
Delegate a natural-language task to the Phoenix GraphQL server agent, which queries \
the Phoenix backend and returns a concise answer. Use for any task that requires \
data about projects, traces, spans, datasets, experiments, or evaluations.
"""


class CallSubAgentToolset(FunctionToolset[AgentDependencies]):
    """Toolset exposing the main agent's ``call_subagent`` delegation tool.

    The tool delegates a natural-language task to the GraphQL server agent and
    returns its answer, forwarding ``usage`` so token accounting aggregates into the
    parent run (the pydantic-ai agent-delegation pattern).
    """

    def __init__(
        self,
        *,
        server_agent_factory: ServerAgentFactory,
    ) -> None:
        async def call_subagent(ctx: RunContext[AgentDependencies], name: str, task: str) -> str:
            # Build a fresh server agent per invocation so its bash virtual
            # filesystem is scoped to this single delegation.
            server_agent = server_agent_factory()
            result = await server_agent.run(
                task,
                deps=None,
                usage=ctx.usage,
            )
            return result.output

        super().__init__(
            tools=[Tool(call_subagent, takes_ctx=True, description=CALL_SUBAGENT_TOOL_DESCRIPTION)]
        )


@dataclass
class CallSubAgentCapability(AbstractStaticCapability[AgentDependencies]):
    """Capability that adds the `call_subagent` tool to an agent."""

    server_agent_factory: ServerAgentFactory
    instructions: str

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return CallSubAgentToolset(
            server_agent_factory=self.server_agent_factory,
        )

    def get_static_instructions(self) -> str:
        return self.instructions
