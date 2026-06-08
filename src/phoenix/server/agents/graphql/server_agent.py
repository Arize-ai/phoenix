from __future__ import annotations

from typing import TYPE_CHECKING, Callable, Optional

from openinference.instrumentation import OITracer, TraceConfig
from opentelemetry.trace import NoOpTracerProvider, Tracer, TracerProvider
from pydantic_ai import Agent
from pydantic_ai.models import Model
from starlette.requests import Request as StarletteRequest

from phoenix.server.agents.graphql.toolset import GraphQLToolset
from phoenix.server.agents.graphql.types import ServerAgentDependencies
from phoenix.server.agents.pydantic_ai import OpenInferenceToolsetWrapper

if TYPE_CHECKING:
    import strawberry

    from phoenix.server.api.context import Context

SERVER_AGENT_INSTRUCTIONS = """\
You are the Phoenix GraphQL server agent. You answer questions by running queries \
against Phoenix's own GraphQL API using the `run_graphql_query` tool, which executes \
queries directly against the server (no network round-trip).

Guidelines:
- Do not guess field, type, or argument names. When you are not certain the schema \
matches what you intend to query, run an introspection query first (e.g. \
`{ __type(name: "Project") { fields { name args { name } type { name kind } } } }`) and \
write your query against what it returns.
- Write a single GraphQL query that retrieves exactly what is needed and pass query \
variables via `variable_values` rather than string interpolation.
- On success the tool returns a dict with the query `data`. If the query has errors the \
tool raises and you receive the error messages back — read them, introspect the schema \
if a field or argument may be wrong, correct the query, and retry.
- Return a concise, factual answer grounded in the data you retrieved.
"""

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


def build_server_agent(
    *,
    model: Model,
    schema: strawberry.Schema,
    build_context: Callable[..., Context],
    request: Optional[StarletteRequest],
    tool_description: str = RUN_GRAPHQL_QUERY_TOOL_DESCRIPTION,
    tracer_provider: TracerProvider | None = None,
) -> Agent[ServerAgentDependencies, str]:
    """Construct the per-request GraphQL server agent.

    The agent is built per request because it needs the per-request ``model``; the
    ``schema``/``build_context``/``request`` triple is closed over by its
    ``GraphQLToolset`` so the query tool can run networklessly with the caller's
    identity.

    The ``GraphQLToolset`` is wrapped in an ``OpenInferenceToolsetWrapper`` so each
    ``run_graphql_query`` invocation emits a ``TOOL`` span. Without this the server
    agent's GraphQL calls are invisible under the parent ``call_server_agent`` span
    (only its LLM spans surface, via the OpenInference-wrapped ``model``).
    """
    provider = tracer_provider or NoOpTracerProvider()
    tracer: Tracer = OITracer(
        provider.get_tracer("phoenix.server.agents"),
        config=TraceConfig(),
    )
    graphql_toolset = GraphQLToolset(
        schema=schema,
        build_context=build_context,
        request=request,
        tool_description=tool_description,
    )
    return Agent(
        model,
        name="ServerAgent",
        deps_type=ServerAgentDependencies,
        instructions=SERVER_AGENT_INSTRUCTIONS,
        toolsets=[OpenInferenceToolsetWrapper(graphql_toolset, tracer=tracer)],
    )
