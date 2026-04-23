from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import func, or_, select
from starlette.exceptions import HTTPException

from phoenix.db import models

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from phoenix.server.api.routers.chat_context import ResolvedContexts, ToolExecutionEnv
    from phoenix.server.api.routers.chat_tools.registry import ContextualTool


def _coerce_limit(value: Any) -> int:
    try:
        limit = int(value)
    except (TypeError, ValueError):
        limit = 5
    return max(1, min(limit, 10))


def _format_timestamp(value: datetime) -> str:
    return value.isoformat()


def _format_trace_line(*, trace_id: str, start_time: datetime, end_time: datetime) -> str:
    latency_ms = round((end_time - start_time).total_seconds() * 1000, 1)
    return f"- {trace_id} | start {_format_timestamp(start_time)} | latency {latency_ms:.1f} ms"


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


def _build_search_project_callable(
    env: "ToolExecutionEnv",
    resolved: "ResolvedContexts",
) -> "Callable[[dict[str, Any]], Awaitable[str]]":
    from strawberry.relay import GlobalID

    from phoenix.server.api.routers.v1.utils import get_project_by_identifier
    from phoenix.server.api.types.Span import Span as SpanNodeType

    assert resolved.project is not None
    project_id = resolved.project.project_id

    async def call(args: dict[str, Any]) -> str:
        query = str(args.get("query") or "").strip()
        limit = _coerce_limit(args.get("limit"))

        async with env.db.read() as session:
            try:
                project = await get_project_by_identifier(session, project_id)
            except HTTPException:
                return f"Project {project_id} is no longer available."

            project_rowid = int(project.id)
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
                            span_node_id=str(GlobalID(SpanNodeType.__name__, str(span_row.id))),
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

    return call


SEARCH_PROJECT_NAME = "search_project"
SEARCH_PROJECT_DESCRIPTION = (
    "Search the currently focused Phoenix project. Use this when the user asks about "
    "spans, traces, or telemetry and is viewing a project."
)
SEARCH_PROJECT_PARAMETERS: dict[str, Any] = {
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


def build_search_project_tool() -> "ContextualTool":
    from phoenix.server.api.routers.chat_tools.registry import ContextualTool

    return ContextualTool(
        name=SEARCH_PROJECT_NAME,
        description=SEARCH_PROJECT_DESCRIPTION,
        parameters_json_schema=SEARCH_PROJECT_PARAMETERS,
        required_contexts=frozenset({"project"}),
        build_callable=_build_search_project_callable,
    )
