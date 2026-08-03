from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import AgentToolset
from pydantic_ai.toolsets.external import ExternalToolset

from phoenix.server.agents.types import AgentDependencies

NAME = "set_time_range"

# Drift warning: the ``timeRangeKey`` enum below must stay in sync with:
#   - ``parseSetTimeRangeInput`` in js/app/src/agent/extensions/toolRegistry.ts
#   - ``TimeRangeKey`` in js/app/src/components/datetime/types.ts
PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "timeRangeKey": {
            "type": "string",
            "enum": ["15m", "1h", "12h", "1d", "7d", "30d", "custom"],
            "description": (
                "Preset to apply, or `custom` when specifying explicit start/end times. "
                "Use the current local date/time from the `get_current_datetime` tool when "
                "resolving relative user requests like 'today', 'yesterday', or 'last hour'."
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

DESCRIPTION = """\
Set the Phoenix app time range selector, scoping traces, spans, evaluations, and other \
time-windowed views to the period the user cares about. Use it when the user asks to look at data \
over a specific window ("last hour", "yesterday", "since 9am", "this week"), when the current \
selection is clearly wrong for the question being asked, or when you need to widen or narrow the \
window before applying further filters.
Prefer preset `timeRangeKey` values (15m, 1h, 12h, 1d, 7d, 30d) when the request maps cleanly to \
one. Use `custom` with `startTime` and optional `endTime` only when the user names specific \
calendar times; omit `endTime` for open-ended ranges ("since 9am").
Call the `get_current_datetime` tool first to read the current date/time in the user's browser \
timezone, and base relative calendar phrases on that value — never on prior knowledge or on the \
currently selected time range.
Include a timezone offset (or `Z`) on custom ISO 8601 timestamps when possible; otherwise the \
browser interprets them in the user's local timezone.
Confirm in your response which window was applied so the user knows what scope subsequent answers \
are based on.\
"""

TOOL_DEFINITION = ToolDefinition(
    name=NAME,
    description=DESCRIPTION,
    parameters_json_schema=PARAMETERS,
    kind="external",
)


@dataclass
class SetTimeRangeCapability(AbstractCapability[AgentDependencies]):
    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return ExternalToolset[AgentDependencies]([TOOL_DEFINITION])
