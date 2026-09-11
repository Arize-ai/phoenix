from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai import RunContext, Tool
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.toolsets import AgentToolset, FunctionToolset

from phoenix.server.agents.types import AgentDependencies

GET_CURRENT_DATETIME_TOOL_NAME = "get_current_datetime"

_GET_CURRENT_DATETIME_DESCRIPTION = (
    "Read the current date and time. Returns the browser clock captured when the "
    "user sent their most recent message (local time with offset, plus IANA "
    "timezone), falling back to the server's UTC clock when no browser clock is "
    "available. Call this before resolving any relative date or time phrase such "
    "as 'today', 'yesterday', 'last hour', or 'since 9am' into concrete "
    "timestamps, before setting a `custom` time-range window (via an `execute_browser_action` "
    "script) derived from relative language, and whenever an answer depends on knowing what time "
    "it is now. Never guess the current date or time from prior knowledge; your "
    'training data is stale. Treat a `browser` result as "now" for the user\'s '
    "most recent message and interpret it in the returned timezone. Reuse the "
    "returned value for the rest of the turn instead of calling repeatedly."
)


class CurrentDatetimeToolResult(BaseModel):
    """Current time returned to the model."""

    current_date_time: str = Field(serialization_alias="currentDateTime")
    time_zone: str = Field(serialization_alias="timeZone")
    source: Literal["browser", "server"]
    as_of: str = Field(serialization_alias="asOf")


class GetCurrentDatetimeToolset(FunctionToolset[AgentDependencies]):
    """Toolset exposing the server-side browser-clock reader."""

    def __init__(self) -> None:
        async def get_current_datetime(
            ctx: RunContext[AgentDependencies],
        ) -> CurrentDatetimeToolResult:
            app_context = ctx.deps.contexts.app
            if app_context is not None:
                return CurrentDatetimeToolResult(
                    current_date_time=app_context.current_date_time,
                    time_zone=app_context.time_zone,
                    source="browser",
                    as_of="when the user sent their most recent message",
                )
            return CurrentDatetimeToolResult(
                current_date_time=datetime.now(timezone.utc).isoformat(),
                time_zone="UTC",
                source="server",
                as_of="now, from the server clock; the user's local timezone is unknown",
            )

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
class GetCurrentDatetimeCapability(AbstractCapability[AgentDependencies]):
    """Capability that adds the current-datetime reader."""

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return GetCurrentDatetimeToolset()
