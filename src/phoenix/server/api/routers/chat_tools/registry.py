from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from phoenix.server.api.routers.chat_context import (
    ResolvedContexts,
    ToolCallable,
    ToolExecutionEnv,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from pydantic_ai.tools import ToolDefinition


@dataclass(frozen=True)
class ContextualTool:
    name: str
    description: str
    parameters_json_schema: dict[str, Any]
    required_contexts: frozenset[str]
    build_callable: Callable[[ToolExecutionEnv, ResolvedContexts], "ToolCallable"]


def _available_context_types(resolved: ResolvedContexts) -> frozenset[str]:
    names: set[str] = set()
    if resolved.project is not None:
        names.add("project")
    if resolved.trace is not None:
        names.add("trace")
    if resolved.span is not None:
        names.add("span")
    if resolved.span_filter is not None:
        names.add("span_filter")
    return frozenset(names)


def resolve_contextual_tools(
    resolved: ResolvedContexts,
    env: ToolExecutionEnv,
) -> tuple[list["ToolDefinition"], dict[str, "ToolCallable"]]:
    from pydantic_ai.tools import ToolDefinition

    available = _available_context_types(resolved)
    defs: list[ToolDefinition] = []
    dispatch: dict[str, ToolCallable] = {}

    for tool in CONTEXTUAL_TOOLS:
        if not tool.required_contexts.issubset(available):
            continue
        defs.append(
            ToolDefinition(
                name=tool.name,
                description=tool.description,
                parameters_json_schema=tool.parameters_json_schema,
            )
        )
        dispatch[tool.name] = tool.build_callable(env, resolved)

    return defs, dispatch


from phoenix.server.api.routers.chat_tools.search_project import (  # noqa: E402
    build_search_project_tool,
)

CONTEXTUAL_TOOLS: list[ContextualTool] = [build_search_project_tool()]
