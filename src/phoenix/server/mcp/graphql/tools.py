"""MCP tools for reading and querying Phoenix's GraphQL API."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional

from fastmcp import FastMCP
from pydantic import TypeAdapter

from phoenix.server.api.graphql_execute import (
    MAX_QUERY_BYTES,
    GraphQLRefusal,
    execute_operation,
    validate_document,
)
from phoenix.server.api.schema_search import cached_index, lookup, search
from phoenix.server.mcp.graphql.output import (
    ExecuteGraphqlErrorEnvelope,
    ExecuteGraphqlOutput,
    ExecuteGraphqlResultEnvelope,
)
from phoenix.server.mcp_server import _META_ANNOTATIONS, _current_mcp_principal

if TYPE_CHECKING:
    from fastapi import FastAPI

_GRAPHQL_TAG = "phoenix-graphql"

# The search budget for one describeGraphqlSchema answer. Larger than the shell
# builtin's, which shares a terminal with the rest of a command's output; here
# the answer is the whole response.
_SEARCH_BUDGET = 4000

# FastMCP requires the root schema to be an object even when it has multiple
# valid shapes. Pydantic owns every member schema so validation and MCP
# documentation cannot drift apart.
_EXECUTE_GRAPHQL_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "oneOf": TypeAdapter(ExecuteGraphqlOutput).json_schema()["anyOf"],
    "$defs": TypeAdapter(ExecuteGraphqlOutput).json_schema().get("$defs", {}),
}


def _preamble(query_root: str) -> str:
    """The properties that hold for every operation, stated once.

    They belong to the surface rather than to any one answer, so a caller reads
    them here and the answers carry only what varies.
    """
    return "\n".join(
        [
            "# Phoenix GraphQL. Write operations against the types below.",
            f"# Entry point: {query_root}. Every field reached from it is readable by whoever "
            "this session authenticates as; a field its permissions withhold errors at "
            "execution, not here.",
            "# Search returns one line per field. Call this tool again with an exact "
            "`Type`, `Type.field`, or mutation name to see that definition in full, with "
            "the paths that reach it.",
            f"# executeGraphqlQuery accepts at most {MAX_QUERY_BYTES // 1024} KiB of "
            "GraphQL per call and runs queries only.",
        ]
    )


def register_graphql_tools(mcp: FastMCP, *, app: "FastAPI", allow_mutations: bool = False) -> None:
    """Register the GraphQL schema and query tools against an application.

    Executes as the caller. Every resolver's permission classes run against the
    principal the MCP request authenticates as, so this surface reaches exactly
    what that caller could reach through the GraphQL endpoint itself -- no more,
    and nothing that needs a separate allowlist to bound it.

    Args:
        mcp: The server to register on.
        app: Application owning the schema and the GraphQL context factory.
        allow_mutations: Whether a mutation tool may be registered alongside the
            read tools. Reserved for the mutation surface; the read tools
            registered here never admit a mutation.
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
    async def describeGraphqlSchema(search_terms: Optional[str] = None) -> str:
        """Search Phoenix's GraphQL schema for the types and fields to write an operation.

        The schema is far too large to read whole, so this returns only the part
        that matches. With no arguments it returns the query root, which is
        where every read begins.

        `search_terms` is either free text ("cost summary time range", "annotate
        spans") or one exact name. Free text returns ranked one-line field
        signatures, each marked with the type that owns it. An exact `Type`,
        `Type.field`, or mutation name returns that definition in full, together
        with the paths that reach it from a root and the input types it needs.

        Search again with the return types and input types you see rather than
        repeating the same terms.
        """
        index = cached_index(_schema()._schema, include_mutations=allow_mutations)
        if not (terms := (search_terms or "").strip()):
            return "\n\n".join([_preamble(index.query_root), lookup(index, index.query_root)])
        return "\n\n".join([_preamble(index.query_root), search(index, terms, _SEARCH_BUDGET)])

    @mcp.tool(
        tags={_GRAPHQL_TAG},
        annotations=_META_ANNOTATIONS,
        output_schema=_EXECUTE_GRAPHQL_OUTPUT_SCHEMA,
    )
    async def executeGraphqlQuery(
        query: str,
        variables: Optional[dict[str, Any]] = None,
        validate_only: bool = False,
    ) -> ExecuteGraphqlOutput:
        """Execute a read-only GraphQL query against Phoenix's API.

        Returns either `{data, errors}` as the GraphQL specification defines
        them, or `{error: {code, message}}` when the operation was refused and
        never ran. Those two are different outcomes: an `errors` list means
        resolvers ran and some failed, and `data` may still carry the fields
        that succeeded; an `error` key means nothing executed.

        Queries only. A document containing a mutation or a subscription is
        refused unexecuted, as is one over 16 KiB.

        Fields you may not read fail individually at execution with a
        permission error, leaving the rest of `data` populated -- so check
        `errors` even when `data` is present.

        With `validate_only=True`, the document is checked against the schema
        and not executed. That answers whether it typechecks; it does not check
        the values in `variables`, and it does not evaluate permissions, which
        run only during execution. A clean result is not a guarantee the query
        will succeed.
        """
        try:
            if validate_only:
                validate_document(_schema(), query)
                return ExecuteGraphqlResultEnvelope(data=None, errors=[])
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
