from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.tools.base import AbstractGatedToolCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "read_playground_output"

DESCRIPTION = """\
Read the output from the currently mounted playground's latest run. The result includes each \
matching instance's raw output, run status, errors, tool calls, and traceId when the run produced \
a Phoenix trace. Use this after `run_playground` finishes so you can inspect or compare the model \
response, and when you need the run `traceId` to analyze why a response behaved a certain way.
Omit arguments to read every visible comparison instance and repetition. Pass `instanceId` when \
the user asks about a specific comparison instance, and `repetitionNumber` when the playground has \
multiple repetitions and the user asks about one run.
The returned `rawOutput` is the playground's stored model output. If the run is still pending or \
streaming, wait for it to finish before drawing conclusions from the output.\
"""

PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "instanceId": {
            "type": "integer",
            "description": (
                "Optional playground instance ID to read. Omit to read outputs for all "
                "visible comparison instances."
            ),
        },
        "repetitionNumber": {
            "type": "integer",
            "minimum": 1,
            "description": (
                "Optional repetition number to read for each selected instance. Omit to "
                "read every available repetition."
            ),
        },
    },
    "additionalProperties": False,
}

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class ReadPlaygroundOutputCapability(AbstractGatedToolCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def include_for_run(self, ctx: RunContext[AgentDependencies]) -> bool:
        return ctx.deps.contexts.playground is not None
