from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable, Optional

import strawberry
from pydantic_ai import ModelRetry, Tool
from pydantic_ai.toolsets import AgentToolset, FunctionToolset

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.api.context import Context

RUN_GRAPHQL_QUERY_TOOL_DESCRIPTION = """\
Execute a GraphQL query against the Phoenix server and return its result.

Do NOT guess field, type, or argument names. If you are not certain that every field \
and argument in your query exists with the exact name and type you intend, first send an \
introspection query with this same tool to discover the real schema, then write your \
query against what introspection returns. Guessing produces queries that fail \
validation or execution.

Useful introspection patterns (run these before guessing):
- Fields and their arguments on a type: \
`{ __type(name: "Project") { fields { name args { name } type { name kind } } } }`
- Available root queries: `{ __schema { queryType { fields { name } } } }`

Args:
    query: A GraphQL query document string (a normal query or an introspection query).
    variable_values: Optional mapping of GraphQL variable names to values.

On success, returns a dict with `data` (the query result). If the query produces \
GraphQL errors, the tool raises with the formatted error messages so you can correct \
the query and retry. When errors indicate an unknown or misused field/argument, run an \
introspection query to confirm the schema rather than guessing again.
"""


class RunGraphQLQueryToolset(FunctionToolset[None]):
    """Toolset exposing a tool to execute GraphQL queries, but not over the network."""

    def __init__(
        self,
        *,
        schema: strawberry.Schema,
        build_graphql_context: Callable[[], Context],
    ) -> None:
        async def run_graphql_query(
            query: str,
            variable_values: Optional[dict[str, Any]] = None,
        ) -> dict[str, Any]:
            context = build_graphql_context()
            result = await schema.execute(
                query,
                variable_values=variable_values,
                context_value=context,
            )
            if result.errors:
                formatted_errors = [error.formatted for error in result.errors]
                raise ModelRetry(json.dumps({"data": result.data, "errors": formatted_errors}))
            return {"data": result.data}

        super().__init__(
            tools=[
                Tool(
                    run_graphql_query,
                    takes_ctx=False,
                    description=RUN_GRAPHQL_QUERY_TOOL_DESCRIPTION,
                )
            ]
        )


@dataclass
class RunGraphQLQueryCapability(AbstractStaticCapability[None]):
    """Capability that adds the networkless ``run_graphql_query`` tool to an agent."""

    schema: strawberry.Schema
    build_graphql_context: Callable[[], Context]
    instructions: str

    def get_toolset(self) -> AgentToolset[None] | None:
        return RunGraphQLQueryToolset(
            schema=self.schema,
            build_graphql_context=self.build_graphql_context,
        )

    def get_static_instructions(self) -> str:
        return self.instructions
