"""Backend tool resolution for PXI chat requests."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from functools import partial
from typing import TYPE_CHECKING, Any

from sqlalchemy import func, or_, select

from phoenix.db import models
from phoenix.server.api.routers.data_stream_protocol import (
    NormalizedAgentContext,
    NormalizedProjectContext,
    NormalizedSpanContext,
    NormalizedSpanFilterConditionContext,
    NormalizedTraceContext,
)
from phoenix.server.types import DbSessionFactory

if TYPE_CHECKING:
    from pydantic_ai.tools import ToolDefinition

    from phoenix.server.api.routers.mcp_tools import MintlifyDocsClient

logger = logging.getLogger(__name__)

_SEARCH_PROJECT_TOOL_NAME = "search_project"
_SEARCH_PROJECT_TOOL_DESCRIPTION = (
    "Search the currently viewed Phoenix project. Use this to look up matching "
    "traces and spans in the active project, or to get a quick project summary "
    "when no query is provided."
)
_SEARCH_PROJECT_TOOL_PARAMETERS = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": (
                "Optional case-insensitive substring to match against trace IDs, "
                "span names, span input text, and span output text. Leave empty "
                "to get a project summary."
            ),
        },
        "limit": {
            "type": "integer",
            "description": "Maximum number of traces and spans to include. Defaults to 5.",
            "minimum": 1,
            "maximum": 10,
        },
    },
    "additionalProperties": False,
}


@dataclass(frozen=True)
class RegisteredBackendTool:
    definition: "ToolDefinition"
    execute: Callable[[dict[str, Any]], Awaitable[str]]


@dataclass
class ResolvedBackendTools:
    tools_by_name: dict[str, RegisteredBackendTool]

    @property
    def definitions(self) -> list["ToolDefinition"]:
        return [tool.definition for tool in self.tools_by_name.values()]

    @property
    def tool_names(self) -> frozenset[str]:
        return frozenset(self.tools_by_name)

    @property
    def raw_tool_definitions(self) -> list[dict[str, Any]]:
        raw_tools: list[dict[str, Any]] = []

        for tool in self.tools_by_name.values():
            function: dict[str, Any] = {
                "name": tool.definition.name,
                "parameters": tool.definition.parameters_json_schema,
            }
            if tool.definition.description is not None:
                function["description"] = tool.definition.description
            raw_tools.append({"type": "function", "function": function})

        return raw_tools

    def add_tool(self, tool: RegisteredBackendTool) -> None:
        if tool.definition.name in self.tools_by_name:
            logger.debug("Skipping duplicate backend tool: %s", tool.definition.name)
            return
        self.tools_by_name[tool.definition.name] = tool

    async def execute(self, name: str, args: dict[str, Any]) -> str:
        return await self.tools_by_name[name].execute(args)


def _coerce_limit(value: Any) -> int:
    try:
        limit = int(value)
    except (TypeError, ValueError):
        limit = 5
    return max(1, min(limit, 10))


def _format_timestamp(value: datetime) -> str:
    return value.isoformat()


def _format_trace_line(
    *,
    trace_id: str,
    start_time: datetime,
    end_time: datetime,
) -> str:
    latency_ms = round((end_time - start_time).total_seconds() * 1000, 1)
    return (
        f"- {trace_id} | start {_format_timestamp(start_time)} | "
        f"latency {latency_ms:.1f} ms"
    )


def _format_span_line(
    *,
    span_node_id: str,
    trace_id: str,
    name: str,
    span_kind: str,
    status_code: str,
    start_time: datetime,
) -> str:
    return (
        f"- {name} | span {span_node_id} | trace {trace_id} | "
        f"{span_kind} | {status_code} | start {_format_timestamp(start_time)}"
    )


def _find_project_scope(
    contexts: Sequence[NormalizedAgentContext],
) -> tuple[str, int] | None:
    for context in contexts:
        if isinstance(context, NormalizedProjectContext):
            return context.project_id, context.project_rowid

    for context in contexts:
        if isinstance(
            context,
            (
                NormalizedTraceContext,
                NormalizedSpanContext,
                NormalizedSpanFilterConditionContext,
            ),
        ):
            return context.project_id, context.project_rowid

    return None


def _build_search_project_tool(
    *,
    db: DbSessionFactory,
    project_id: str,
    project_rowid: int,
) -> RegisteredBackendTool:
    from pydantic_ai.tools import ToolDefinition
    from strawberry.relay import GlobalID

    from phoenix.server.api.types.Span import Span as SpanNodeType

    async def execute(args: dict[str, Any]) -> str:
        query = str(args.get("query") or "").strip()
        limit = _coerce_limit(args.get("limit"))

        async with db.read() as session:
            project = await session.get(models.Project, project_rowid)
            if project is None:
                return f"Project {project_id} is no longer available."

            trace_count = await session.scalar(
                select(func.count(models.Trace.id)).where(
                    models.Trace.project_rowid == project_rowid
                )
            )
            span_count = await session.scalar(
                select(func.count(models.Span.id))
                .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                .where(models.Trace.project_rowid == project_rowid)
            )

            lines = [
                f'Project "{project.name}" ({project_id})',
                f"- Total traces: {trace_count or 0}",
                f"- Total spans: {span_count or 0}",
            ]

            if query == "":
                latest_traces = (
                    await session.execute(
                        select(
                            models.Trace.trace_id,
                            models.Trace.start_time,
                            models.Trace.end_time,
                        )
                        .where(models.Trace.project_rowid == project_rowid)
                        .order_by(models.Trace.start_time.desc())
                        .limit(limit)
                    )
                ).all()

                lines.append(f"- Latest traces (up to {limit}):")
                if latest_traces:
                    for trace_row in latest_traces:
                        lines.append(
                            _format_trace_line(
                                trace_id=trace_row.trace_id,
                                start_time=trace_row.start_time,
                                end_time=trace_row.end_time,
                            )
                        )
                else:
                    lines.append("- No traces found.")

                return "\n".join(lines)

            match_condition = or_(
                models.CaseInsensitiveContains(models.Trace.trace_id, query),
                models.CaseInsensitiveContains(models.Span.name, query),
                models.CaseInsensitiveContains(models.Span.input_value, query),
                models.CaseInsensitiveContains(models.Span.output_value, query),
            )

            matching_traces = (
                await session.execute(
                    select(
                        models.Trace.trace_id,
                        models.Trace.start_time,
                        models.Trace.end_time,
                    )
                    .join(models.Span, models.Span.trace_rowid == models.Trace.id)
                    .where(models.Trace.project_rowid == project_rowid)
                    .where(match_condition)
                    .group_by(
                        models.Trace.id,
                        models.Trace.trace_id,
                        models.Trace.start_time,
                        models.Trace.end_time,
                    )
                    .order_by(models.Trace.start_time.desc())
                    .limit(limit)
                )
            ).all()

            matching_spans = (
                await session.execute(
                    select(
                        models.Span.id,
                        models.Span.name,
                        models.Span.span_kind,
                        models.Span.status_code,
                        models.Span.start_time,
                        models.Trace.trace_id,
                    )
                    .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                    .where(models.Trace.project_rowid == project_rowid)
                    .where(match_condition)
                    .order_by(models.Span.start_time.desc())
                    .limit(limit)
                )
            ).all()

            lines.append(f'- Search query: "{query}"')
            lines.append(f"- Matching traces (up to {limit}):")
            if matching_traces:
                for trace_row in matching_traces:
                    lines.append(
                        _format_trace_line(
                            trace_id=trace_row.trace_id,
                            start_time=trace_row.start_time,
                            end_time=trace_row.end_time,
                        )
                    )
            else:
                lines.append("- No matching traces found.")

            lines.append(f"- Matching spans (up to {limit}):")
            if matching_spans:
                for span_row in matching_spans:
                    lines.append(
                        _format_span_line(
                            span_node_id=str(
                                GlobalID(SpanNodeType.__name__, str(span_row.id))
                            ),
                            trace_id=span_row.trace_id,
                            name=span_row.name,
                            span_kind=span_row.span_kind,
                            status_code=span_row.status_code,
                            start_time=span_row.start_time,
                        )
                    )
            else:
                lines.append("- No matching spans found.")

            return "\n".join(lines)

    return RegisteredBackendTool(
        definition=ToolDefinition(
            name=_SEARCH_PROJECT_TOOL_NAME,
            description=_SEARCH_PROJECT_TOOL_DESCRIPTION,
            parameters_json_schema=_SEARCH_PROJECT_TOOL_PARAMETERS,
        ),
        execute=execute,
    )


async def resolve_backend_tool_registry(
    *,
    db: DbSessionFactory,
    contexts: Sequence[NormalizedAgentContext],
    mcp_client: "MintlifyDocsClient | None" = None,
) -> ResolvedBackendTools:
    from pydantic_ai.tools import ToolDefinition

    resolved_tools = ResolvedBackendTools(tools_by_name={})

    if mcp_client is not None:
        try:
            mcp_tool_definitions = await mcp_client.get_tool_definitions()
        except Exception:
            logger.exception("Failed to resolve backend MCP tools")
        else:
            for definition in mcp_tool_definitions:
                resolved_tools.add_tool(
                    RegisteredBackendTool(
                        definition=ToolDefinition(
                            name=definition.name,
                            description=definition.description,
                            parameters_json_schema=definition.parameters_json_schema,
                        ),
                        execute=partial(mcp_client.call_tool, definition.name),
                    )
                )

    project_scope = _find_project_scope(contexts)
    if project_scope is not None:
        project_id, project_rowid = project_scope
        resolved_tools.add_tool(
            _build_search_project_tool(
                db=db,
                project_id=project_id,
                project_rowid=project_rowid,
            )
        )

    return resolved_tools
