from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field
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
class GetCurrentDatetimeCapability(AbstractStaticCapability[AgentDependencies]):
    """Capability that adds the current-datetime reader."""

    instructions: str

    def get_toolset(self) -> AgentToolset[AgentDependencies] | None:
        return GetCurrentDatetimeToolset()

    def get_static_instructions(self) -> str:
        return self.instructions
