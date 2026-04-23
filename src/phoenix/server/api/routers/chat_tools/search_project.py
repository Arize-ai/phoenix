"""The ``search_project`` contextual tool.

Gated on the ``project`` context. The project ID is injected via closure
(not exposed in the JSON schema) so the model cannot forge or omit it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Awaitable, Callable

from phoenix.server.api.routers.chat_context import ResolvedContexts

if TYPE_CHECKING:
    from phoenix.server.api.routers.chat_tools.registry import (
        ContextualTool,
        ToolExecutionEnv,
    )


def _build_search_project_callable(
    env: "ToolExecutionEnv",
    resolved: ResolvedContexts,
) -> Callable[[dict[str, Any]], Awaitable[str]]:
    assert resolved.project is not None
    project_id = resolved.project.project_id

    async def call(args: dict[str, Any]) -> str:
        query = str(args.get("query", "")).strip()
        # Placeholder implementation. A future PR will thread this through to
        # an actual search backend; the important invariant today is that
        # ``project_id`` comes from the closed-over context, not the args.
        return f"[search_project] project_id={project_id} query={query!r}"

    return call


SEARCH_PROJECT_NAME = "search_project"
SEARCH_PROJECT_DESCRIPTION = (
    "Search spans within the currently focused Phoenix project. "
    "Use this when the user asks about spans, traces, or telemetry "
    "and is viewing a project."
)
SEARCH_PROJECT_PARAMETERS: dict[str, Any] = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "Free-form search text.",
        }
    },
    "required": ["query"],
    "additionalProperties": False,
}
SEARCH_PROJECT_REQUIRED_CONTEXTS = frozenset({"project"})


def build_search_project_tool() -> "ContextualTool":
    from phoenix.server.api.routers.chat_tools.registry import ContextualTool

    return ContextualTool(
        name=SEARCH_PROJECT_NAME,
        description=SEARCH_PROJECT_DESCRIPTION,
        parameters_json_schema=SEARCH_PROJECT_PARAMETERS,
        required_contexts=SEARCH_PROJECT_REQUIRED_CONTEXTS,
        build_callable=_build_search_project_callable,
    )
