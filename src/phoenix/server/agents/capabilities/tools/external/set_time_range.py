from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jinja2 import Template
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

NAME = "set_time_range"

# Drift warning: the ``timeRangeKey`` enum below must stay in sync with:
#   - ``parseSetTimeRangeInput`` in app/src/agent/extensions/toolRegistry.ts
#   - ``TimeRangeKey`` in app/src/components/datetime/types.ts
PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "timeRangeKey": {
            "type": "string",
            "enum": ["15m", "1h", "12h", "1d", "7d", "30d", "custom"],
            "description": (
                "Preset to apply, or `custom` when specifying explicit start/end times. "
                "Use the current local date/time from the Phoenix UI context when resolving "
                "relative user requests like 'today', 'yesterday', or 'last hour'."
            ),
        },
        "startTime": {
            "type": "string",
            "description": (
                "Optional ISO 8601 start datetime for a custom range. Include a timezone "
                "offset or `Z` when possible; otherwise the browser interprets it in the "
                "user's local timezone."
            ),
        },
        "endTime": {
            "type": "string",
            "description": (
                "Optional ISO 8601 end datetime for a custom range. Omit for open-ended "
                "ranges such as 'since 9am'."
            ),
        },
    },
    "required": ["timeRangeKey"],
    "additionalProperties": False,
}

DESCRIPTION = (
    "Set the Phoenix app time range selector. Use preset `timeRangeKey` values for "
    "standard relative windows (15m, 1h, 12h, 1d, 7d, 30d). Use `custom` with "
    "`startTime` and optional `endTime` for specific calendar windows. The Phoenix UI "
    "context includes the current date/time in the user's browser timezone; base "
    "relative calendar phrases on that value, not on the currently selected time range."
)

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetTimeRangeCapability(AbstractStaticCapability[AgentDependencies]):
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])

    def get_static_instructions(self) -> str:
        return self.instructions.render()
