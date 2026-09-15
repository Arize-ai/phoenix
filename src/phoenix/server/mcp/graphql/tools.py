"""MCP tools for reading and querying Phoenix's GraphQL API."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any, Optional, Union

from fastmcp import FastMCP
from graphql import OperationType as GraphQLOperationType
from pydantic import TypeAdapter

from phoenix.server.api.graphql_execute import (
    GraphQLRefusal,
    GraphQLRefusalCode,
    admit,
    execute_operation,
    operation_types,
    validate_document,
)
from phoenix.server.api.schema_search import cached_index, describe
from phoenix.server.mcp.graphql.output import (
    ExecuteGraphqlErrorEnvelope,
    ExecuteGraphqlMutationOutput,
    ExecuteGraphqlOutput,
    ExecuteGraphqlResultEnvelope,
    ValidateGraphqlEnvelope,
)
from phoenix.server.mcp_server import (
    _DEFAULT_ANNOTATIONS,
    _META_ANNOTATIONS,
    _current_mcp_principal,
)

if TYPE_CHECKING:
    from fastapi import FastAPI

_GRAPHQL_TAG = "phoenix-graphql"

# The character budget for one describeGraphqlSchema answer.
_SEARCH_BUDGET = 4000

# FastMCP requires the root schema to be an object even when it has multiple
# valid shapes. Pydantic owns every member schema so validation and MCP
# documentation cannot drift apart.
_EXECUTE_GRAPHQL_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "oneOf": TypeAdapter(ExecuteGraphqlOutput).json_schema()["anyOf"],
    "$defs": TypeAdapter(ExecuteGraphqlOutput).json_schema().get("$defs", {}),
}
_EXECUTE_GRAPHQL_MUTATION_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "oneOf": TypeAdapter(ExecuteGraphqlMutationOutput).json_schema()["anyOf"],
    "$defs": TypeAdapter(ExecuteGraphqlMutationOutput).json_schema().get("$defs", {}),
}


def _listed(value: Union[str, list[str], None]) -> list[str]:
    """``value`` as the non-empty strings it holds, whether one string or a list."""
    items = [value] if isinstance(value, str) else list(value or [])
    return [item.strip() for item in items if item and item.strip()]


def register_graphql_tools(mcp: FastMCP, *, app: "FastAPI", allow_mutations: bool = False) -> None:
    """Register the GraphQL schema and query tools against an application.

    Executes as the caller. Every resolver's permission classes run against the
    principal the MCP request authenticates as, so this surface reaches exactly
    what that caller could reach through the GraphQL endpoint itself.

    Args:
        mcp: The server to register on.
        app: Application owning the schema and the GraphQL context factory.
        allow_mutations: Register `executeGraphqlMutation` alongside the read
            tools, and let the schema tool describe mutations. The read tools
            themselves never admit a mutation either way.
    """

    # Resolved per call rather than closed over: the MCP servers are built
    # before the application publishes its schema and context factory, so
    # reading these at registration time would capture nothing.
    def _schema() -> Any:
        return app.state.graphql_schema

    def _context() -> Any:
        return app.state.build_graphql_context(_current_mcp_principal())

    # `output_schema=None` suppresses the structured mirror, which for prose is
    # a verbatim repeat: the text block is what every client can read, and
    # `{"result": <the same text>}` adds no structure to read.
    @mcp.tool(tags={_GRAPHQL_TAG}, annotations=_META_ANNOTATIONS, output_schema=None)
    async def describeGraphqlSchema(
        search: Optional[Union[str, list[str]]] = None,
        names: Optional[Union[str, list[str]]] = None,
    ) -> str:
        """Search Phoenix's GraphQL schema for the types and fields to write an operation.

        The schema is far too large to read whole, so this returns only the part
        asked for. With no arguments it returns the query root, which is where
        every read begins. It lists every field whatever your permissions; one
        you may not read fails at execution.

        `search` is free text ("cost summary time range", "annotate spans"), one
        string or a list of them. Each returns ranked field signatures grouped
        under the types that own them, followed by the best hit in full. `names`
        is exact `Type`, `Type.field`, or mutation names, as a list or one
        comma-separated string; each comes back in full, with the paths that
        reach it, the input types it takes, and the members it returns. Pass
        both to look names up and search in one call; several of either share
        the answer's budget.

        Name the return types and input types you see rather than repeating the
        same search terms. Where mutations are enabled, include the word
        "mutations" in a search to see only them. Write `Type.words` to search
        within one type.
        """
        index = cached_index(_schema()._schema, include_mutations=allow_mutations)
        wanted = [n for item in _listed(names) for n in re.split(r"[,\s]+", item) if n]
        return describe(index, search=_listed(search), names=wanted, budget=_SEARCH_BUDGET)

    @mcp.tool(
        tags={_GRAPHQL_TAG},
        annotations=_META_ANNOTATIONS,
        output_schema=_EXECUTE_GRAPHQL_OUTPUT_SCHEMA,
    )
    async def executeGraphqlQuery(
        query: str,
        variables: Optional[dict[str, Any]] = None,
    ) -> ExecuteGraphqlOutput:
        """Execute a read-only GraphQL query against Phoenix's API.

        Returns either `{data, errors}` as the GraphQL specification defines
        them, or `{error: {code, message}}` when Phoenix refused the document
        before GraphQL saw it. `errors` carries syntax, validation, and resolver
        failures alike, and `data` may still carry the fields that succeeded;
        an `error` key means nothing executed.

        Queries only, one operation per document. A document containing a
        mutation, a subscription, or several operations is refused unexecuted,
        as is one over 2 KiB of UTF-8.

        Pass large or dynamic values through `variables`, declared with the
        argument types the schema shows, nullability included. Variable values
        do not count toward the size limit and need no GraphQL string escaping.

        A field you may not read fails at execution with a permission error.
        GraphQL nulls that field, or its nearest nullable ancestor when the
        field is non-null, and keeps the rest of `data` -- so check `errors`
        even when `data` is present.

        Run documents directly: one that fails validation comes back as
        `errors` with nothing executed.
        """
        try:
            outcome = await execute_operation(
                _schema(),
                query=query,
                variables=variables,
                context=_context(),
                allow_mutations=False,
            )
            return ExecuteGraphqlResultEnvelope(
                data=outcome.data,
                errors=[dict(error) for error in outcome.errors],
            )
        except GraphQLRefusal as refusal:
            return ExecuteGraphqlErrorEnvelope.from_refusal(refusal)

    if not allow_mutations:
        return

    # Annotated destructive: this transport has no approval step, so any
    # confirmation is the client's. The call is bounded by the caller's own
    # permissions, enforced by the same resolvers the GraphQL endpoint runs.
    @mcp.tool(
        tags={_GRAPHQL_TAG},
        annotations=_DEFAULT_ANNOTATIONS,
        output_schema=_EXECUTE_GRAPHQL_MUTATION_OUTPUT_SCHEMA,
    )
    async def executeGraphqlMutation(
        mutation: str,
        variables: Optional[dict[str, Any]] = None,
        validate_only: bool = False,
    ) -> ExecuteGraphqlMutationOutput:
        """Execute a GraphQL mutation against Phoenix's API. This changes stored data.

        Confirm the change with the person you are acting for before calling
        this. There is no second chance: the mutation runs when called, and
        Phoenix keeps no undo.

        Call `describeGraphqlSchema` with the mutation's name first. It returns
        the input types the mutation requires, which are not guessable from the
        name, and says what the mutation does.

        Returns the same two shapes as `executeGraphqlQuery`: `{data, errors}`
        when the operation ran, `{error: {code, message}}` when it was refused
        and never ran. A mutation that reports `errors` may still have committed
        part of its work, so read them rather than retrying blindly.

        Only mutations. A document containing only queries is refused; use
        `executeGraphqlQuery` for those. `validate_only=True` admits and checks
        the document against the schema without running it, answering
        `{valid, notes}`; it does not check variable values or permissions.
        """
        try:
            if GraphQLOperationType.MUTATION not in operation_types(mutation):
                raise GraphQLRefusal(
                    GraphQLRefusalCode.NOT_A_MUTATION,
                    "This tool runs mutations. Use executeGraphqlQuery to read.",
                )
            if validate_only:
                admit(mutation, allow_mutations=True)
                validate_document(_schema(), mutation)
                return ValidateGraphqlEnvelope.passed()
            outcome = await execute_operation(
                _schema(),
                query=mutation,
                variables=variables,
                context=_context(),
                allow_mutations=True,
            )
            return ExecuteGraphqlResultEnvelope(
                data=outcome.data,
                errors=[dict(error) for error in outcome.errors],
            )
        except GraphQLRefusal as refusal:
            return ExecuteGraphqlErrorEnvelope.from_refusal(refusal)
