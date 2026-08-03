from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_playground_repetitions"
MIN_REPETITIONS = 1
MAX_REPETITIONS = 30

DESCRIPTION = """\
Set the playground-wide repetitions count in the currently mounted playground. Use this before \
running when the user asks to run a prompt multiple times, check for flakiness, build confidence, \
or validate nondeterministic behavior — including when structured output, tool-call behavior, or \
pre-save validation needs more confidence than a single run provides.
Set repetitions before calling `run_playground`; changing repetitions after a run starts is not \
allowed.
Use repetitions to build confidence because LLM outputs are nondeterministic. Do not claim a \
prompt is reliable based on one successful run.
After a repeated run finishes, inspect every repetition with `read_playground_output` before \
summarizing confidence or recommending that the user save the prompt.
Keep the requested value between 1 and 30. If the user asks for more than 30, explain that the \
playground supports up to 30 repetitions.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "repetitions": {
            "type": "integer",
            "minimum": MIN_REPETITIONS,
            "maximum": MAX_REPETITIONS,
            "description": "The number of times each playground task should run.",
        },
    },
    "required": ["repetitions"],
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetPlaygroundRepetitionsCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
