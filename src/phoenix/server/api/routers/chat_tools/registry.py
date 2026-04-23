"""Registry for contextual backend tools.

A contextual tool is gated on one or more *required contexts* being present
in the advertised frontend ``contexts`` payload. When the gates are met,
the registry binds the tool's callable to the resolved contexts and the
per-request environment via closure — context-derived identifiers (project
IDs, etc.) deliberately do not appear in the tool's JSON schema, so the
model cannot forge or miss them.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Awaitable, Callable

from phoenix.server.api.routers.chat_context import ResolvedContexts

if TYPE_CHECKING:
    from pydantic_ai.tools import ToolDefinition


ToolCallable = Callable[[dict[str, Any]], Awaitable[str]]


@dataclass
class ToolExecutionEnv:
    """Per-request handles a contextual tool may close over when building its callable."""

    user: Any
    db: Any


@dataclass(frozen=True)
class ContextualTool:
    """Static descriptor for a tool that is conditionally registered based on context."""

    name: str
    description: str
    parameters_json_schema: dict[str, Any]
    required_contexts: frozenset[str]
    build_callable: Callable[[ToolExecutionEnv, ResolvedContexts], ToolCallable]


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
    resolved: ResolvedContexts, env: ToolExecutionEnv
) -> tuple[list["ToolDefinition"], dict[str, ToolCallable]]:
    """Build the per-request list of ToolDefinitions and the name→callable dispatch map.

    Only tools whose ``required_contexts`` are satisfied by ``resolved``
    are included.
    """
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


# Import tool builders after the registry types are declared to avoid
# import cycles. Each builder returns a ``ContextualTool`` instance.
from phoenix.server.api.routers.chat_tools.search_project import (  # noqa: E402
    build_search_project_tool,
)

CONTEXTUAL_TOOLS: list[ContextualTool] = [build_search_project_tool()]
