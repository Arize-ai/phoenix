from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pydantic_ai.toolsets import AgentToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.capabilities.server_agents.toolset import ServerAgentToolset
from phoenix.server.agents.types import AgentDependencies

if TYPE_CHECKING:
    from pydantic_ai import Agent

    from phoenix.server.agents.graphql.types import ServerAgentDependencies

CALL_SERVER_AGENT_INSTRUCTIONS = """\
You can delegate to a GraphQL server agent that answers questions by querying Phoenix's \
own data (projects, traces, spans, datasets, experiments, evaluations, and more) via the \
`call_server_agent` tool. Use it whenever answering requires data from the Phoenix \
backend that you do not already have. Pass a single, self-contained natural-language \
question describing exactly what you need.
"""

CALL_SERVER_AGENT_TOOL_DESCRIPTION = """\
Delegate a natural-language question to the Phoenix GraphQL server agent, which queries \
the Phoenix backend and returns a concise answer. Use for any question that requires \
data about projects, traces, spans, datasets, experiments, or evaluations.
"""


@dataclass
class ServerAgentCapability(AbstractStaticCapability[AgentDependencies]):
    """Capability that adds the ``call_server_agent`` delegation tool to the main agent."""

    server_agent: Agent[ServerAgentDependencies, str]
    instructions: str = CALL_SERVER_AGENT_INSTRUCTIONS
    tool_description: str = CALL_SERVER_AGENT_TOOL_DESCRIPTION

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ServerAgentToolset(
            server_agent=self.server_agent,
            tool_description=self.tool_description,
        )

    def get_static_instructions(self) -> str:
        return self.instructions
