"""Contextual tool registry for the chat agent.

A *contextual tool* is exposed to the model only when the user's current
UI context provides everything the tool needs. For example, the span
filter tool is only advertised when the user is viewing a project page
that has a span filter field mounted.

Adding a new contextual tool
----------------------------
1. Create ``agents/tools/<your_tool>.py`` with a builder function that
   returns a ``ContextualTool``.
2. Append the builder's result to ``CONTEXTUAL_TOOLS`` at the bottom of
   this file.
3. Set ``required_contexts`` to the names recognised by
   ``_available_context_types`` (``project``, ``span_filter``, ``trace``,
   ``span``); add a new name there if the UI exposes new state.
4. For ``executes_on="server"`` tools, supply a ``build_callable`` that
   takes ``(ToolExecutionEnv, ResolvedContexts)`` and returns an async
   callable. For ``executes_on="client"`` tools, leave it ``None`` —
   dispatch happens via the data-stream protocol.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Literal, Optional

from phoenix.server.agents.context import ResolvedContexts, ToolCallable, ToolExecutionEnv

if TYPE_CHECKING:
    from collections.abc import Callable

    from pydantic_ai.tools import ToolDefinition


@dataclass(frozen=True)
class ContextualTool:
    name: str
    description: str
    parameters_json_schema: dict[str, Any]
    required_contexts: frozenset[str]
    # Where the tool runs. ``"server"`` tools are executed in-process via
    # ``build_callable``; ``"client"`` tools advertise a ``ToolDefinition`` to
    # the model but are dispatched to the browser by the data-stream protocol
    # (the same path frontend tool calls take).
    executes_on: Literal["server", "client"] = "server"
    # Required when ``executes_on == "server"``; must be ``None`` for client
    # tools (asserted in ``__post_init__``).
    build_callable: Optional["Callable[[ToolExecutionEnv, ResolvedContexts], ToolCallable]"] = None

    def __post_init__(self) -> None:
        if self.executes_on == "server" and self.build_callable is None:
            raise ValueError(
                f"Server-executed contextual tool {self.name!r} requires build_callable"
            )
        if self.executes_on == "client" and self.build_callable is not None:
            raise ValueError(
                f"Client-executed contextual tool {self.name!r} must not define build_callable"
            )


def _available_context_types(resolved: ResolvedContexts) -> frozenset[str]:
    names: set[str] = set()
    if resolved.project is not None:
        names.add("project")
        # ``span_filter`` is a virtual context name derived from the project
        # carrying a span_filter field. The presence of the field — even when
        # the condition is an empty string — signals that the on-screen filter
        # input is mounted and tools that drive it can be advertised.
        if resolved.project.span_filter is not None:
            names.add("span_filter")
    if resolved.trace is not None:
        names.add("trace")
    if resolved.span is not None:
        names.add("span")
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
        if tool.executes_on == "server":
            assert tool.build_callable is not None  # noqa: S101
            dispatch[tool.name] = tool.build_callable(env, resolved)

    return defs, dispatch


from phoenix.server.agents.tools.apply_span_filter_condition import (  # noqa: E402
    build_apply_span_filter_condition_tool,
)

CONTEXTUAL_TOOLS: list[ContextualTool] = [build_apply_span_filter_condition_tool()]
