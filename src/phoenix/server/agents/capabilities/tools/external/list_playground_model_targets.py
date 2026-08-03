from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "list_playground_model_targets"

DESCRIPTION = """\
List the model targets currently available in the mounted playground. Use this before suggesting \
playground model options, building model-choice questions with `ask_user`, or resolving exact \
provider/model/custom-provider target payloads for `set_playground_model`.
Use this tool instead of relying on general knowledge of model lineups, and pass the returned \
`target` payloads to `set_playground_model` exactly as returned.
If the user asks for a vague model family such as "sonnet" or "gpt", choose from the returned \
targets only when the family match is clear. When multiple returned targets match the same family, \
prefer the target whose returned model name appears to be the latest version in that family. If \
the returned targets do not make the latest version clear, ask the user which model to use instead \
of guessing from outside knowledge.
Call `set_playground_model` directly, without this tool, only when the user already provided an \
exact target and no model-choice ambiguity remains.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ListPlaygroundModelTargetsCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
