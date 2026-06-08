from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, Callable, Optional

from pydantic_ai import ModelRetry, Tool
from pydantic_ai.toolsets import FunctionToolset
from starlette.requests import Request as StarletteRequest

from phoenix.server.agents.graphql.types import ServerAgentDependencies

if TYPE_CHECKING:
    import strawberry

    from phoenix.server.api.context import Context


class GraphQLToolset(FunctionToolset[ServerAgentDependencies]):
    """Toolset exposing a tool to execute GraphQL queries, but not over the network."""

    def __init__(
        self,
        *,
        schema: strawberry.Schema,
        build_context: Callable[..., Context],
        request: Optional[StarletteRequest],
        tool_description: str,
    ) -> None:
        async def run_graphql_query(
            query: str,
            variable_values: Optional[dict[str, Any]] = None,
        ) -> dict[str, Any]:
            result = await schema.execute(
                query,
                variable_values=variable_values,
                context_value=build_context(request=request),
            )
            if result.errors:
                # ``schema.execute`` does not raise on GraphQL errors. Raise here so
                # the failure is recorded on the enclosing TOOL span (ERROR status +
                # exception event) instead of looking like a clean success. pydantic-ai
                # converts ``ModelRetry`` into a retry prompt, so the model still sees
                # the error messages and can correct the query and retry.
                formatted_errors = [error.formatted for error in result.errors]
                raise ModelRetry(json.dumps({"data": result.data, "errors": formatted_errors}))
            return {"data": result.data}

        super().__init__(
            tools=[Tool(run_graphql_query, takes_ctx=False, description=tool_description)]
        )
