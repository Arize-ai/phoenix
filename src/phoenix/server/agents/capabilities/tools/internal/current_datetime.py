"""Server-side tool that reads the browser clock stamped on the newest user message.

The clock is deliberately surfaced through a tool instead of the system prompt:
a per-turn timestamp in the instructions changes the request prefix every turn
and defeats provider prompt caching, while a tool result lands at the tail of
the message history and replays byte-stable.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from pydantic_ai import RunContext, Tool
from pydantic_ai.toolsets import AgentToolset, FunctionToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.agents.types import AgentDependencies

GET_CURRENT_DATETIME_TOOL_NAME = "get_current_datetime"

_GET_CURRENT_DATETIME_DESCRIPTION = (
    "Read the current date and time. Returns the browser clock captured when the "
    "user sent their most recent message (local time with offset, plus IANA "
    "timezone), falling back to the server's UTC clock when no browser clock is "
    "available. Call this before resolving any relative date or time phrase such "
    "as 'today', 'yesterday', or 'last hour'; never guess the current date from "
    "prior knowledge."
)


class GetCurrentDatetimeToolset(FunctionToolset[AgentDependencies]):
    """Toolset exposing the server-side browser-clock reader."""

    def __init__(self) -> None:
        async def get_current_datetime(
            ctx: RunContext[AgentDependencies],
        ) -> dict[str, str]:
            app_context = ctx.deps.contexts.app
            if app_context is not None:
                return {
                    "currentDateTime": app_context.current_date_time,
                    "timeZone": app_context.time_zone,
                    "source": "browser",
                    "asOf": "when the user sent their most recent message",
                }
            return {
                "currentDateTime": datetime.now(timezone.utc).isoformat(),
                "timeZone": "UTC",
                "source": "server",
                "asOf": "now, from the server clock; the user's local timezone is unknown",
            }

        super().__init__(
            tools=[
                Tool(
                    get_current_datetime,
                    name=GET_CURRENT_DATETIME_TOOL_NAME,
                    description=_GET_CURRENT_DATETIME_DESCRIPTION,
                    takes_ctx=True,
                )
            ]
        )


@dataclass
class GetCurrentDatetimeCapability(AbstractStaticCapability[AgentDependencies]):
    """Capability that adds the current-datetime reader."""

    instructions: str

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return GetCurrentDatetimeToolset()

    def get_static_instructions(self) -> str:
        return self.instructions
