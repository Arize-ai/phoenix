from pydantic_ai.models.test import TestModel
from pydantic_ai.tools import RunContext
from pydantic_ai.usage import RunUsage

from phoenix.server.agents.capabilities.tools.internal.current_datetime import (
    GET_CURRENT_DATETIME_TOOL_NAME,
    CurrentDatetimeToolResult,
    GetCurrentDatetimeToolset,
)
from phoenix.server.agents.context import AppContext, ResolvedContexts
from phoenix.server.agents.types import AgentDependencies


def _get_run_context(contexts: ResolvedContexts) -> RunContext[AgentDependencies]:
    return RunContext(
        deps=AgentDependencies(contexts=contexts),
        model=TestModel(),
        usage=RunUsage(),
    )


async def _call_tool(ctx: RunContext[AgentDependencies]) -> CurrentDatetimeToolResult:
    toolset = GetCurrentDatetimeToolset()
    tools = await toolset.get_tools(ctx)
    result: CurrentDatetimeToolResult = await toolset.call_tool(
        GET_CURRENT_DATETIME_TOOL_NAME, {}, ctx, tools[GET_CURRENT_DATETIME_TOOL_NAME]
    )
    return result


async def test_returns_browser_clock_from_resolved_app_context() -> None:
    ctx = _get_run_context(
        ResolvedContexts(
            app=AppContext(
                type="app",
                current_date_time="2026-05-05T09:30:00-07:00",
                time_zone="America/Los_Angeles",
            ),
        )
    )
    result = await _call_tool(ctx)
    assert result.current_date_time == "2026-05-05T09:30:00-07:00"
    assert result.time_zone == "America/Los_Angeles"
    assert result.source == "browser"
    assert result.model_dump(by_alias=True)["currentDateTime"] == "2026-05-05T09:30:00-07:00"


async def test_falls_back_to_server_clock_without_app_context() -> None:
    ctx = _get_run_context(ResolvedContexts())
    result = await _call_tool(ctx)
    assert result.source == "server"
    assert result.time_zone == "UTC"
    assert result.current_date_time
