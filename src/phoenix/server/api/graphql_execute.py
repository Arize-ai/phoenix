"""Transport-neutral admission and execution of GraphQL operations.

Callers supply an operation and a context; this module decides whether the
operation may run at all, runs it, and returns the GraphQL result. How that
result is serialized, capped, or reported belongs to the transport.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Mapping, Optional

import strawberry
from graphql import GraphQLSyntaxError
from graphql import OperationType as GraphQLOperationType
from graphql import parse as parse_graphql
from graphql import validate as validate_graphql
from graphql.language.ast import OperationDefinitionNode
from strawberry.types.graphql import OperationType

from phoenix.server.api.context import Context

# An operation larger than this is refused unexecuted. Admission rather than
# transport: the reason a caller should split the work does not depend on how
# the operation arrived. Generous next to the SQL surface's 2 KiB because a
# GraphQL document carries its own fragments and variable definitions.
MAX_QUERY_BYTES = 16 * 1024


class GraphQLRefusalCode(str, Enum):
    QUERY_TOO_LARGE = "query_too_large"
    PARSE_ERROR = "parse_error"
    SUBSCRIPTION_NOT_SUPPORTED = "subscription_not_supported"
    MUTATION_NOT_ALLOWED = "mutation_not_allowed"
    VALIDATION_FAILED = "validation_failed"


class GraphQLRefusal(Exception):
    """An operation that was not executed.

    Distinct from a GraphQL error: the operation never ran, so there is no
    partial data and no resolver had a chance to report anything.
    """

    def __init__(self, code: GraphQLRefusalCode, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class GraphQLOutcome:
    """The result of an operation that was admitted and run."""

    data: Optional[dict[str, Any]]
    errors: tuple[Mapping[str, Any], ...]

    @property
    def failed_outright(self) -> bool:
        """Whether the operation produced errors and no data at all."""
        return bool(self.errors) and self.data is None


def operation_types(query: str) -> set[GraphQLOperationType]:
    """Return the set of GraphQL operation types declared in ``query``.

    Comments abutting the keyword and shorthand syntax defeat a naive regex, but the
    AST-based classifier handles them. Invalid syntax yields an empty set and is left
    for execution to report.

    >>> operation_types("mutation# do it later\\n{ deleteEverything }")
    {<OperationType.MUTATION: 'mutation'>}
    >>> operation_types("# subscription example\\nquery { hello }")
    {<OperationType.QUERY: 'query'>}
    >>> operation_types("subscription { hello }")
    {<OperationType.SUBSCRIPTION: 'subscription'>}
    >>> operation_types("{ hello }")
    {<OperationType.QUERY: 'query'>}
    >>> operation_types("this is not graphql !!")
    set()

    A document declaring several operations reports every type it contains (sorted here
    for a stable repr):

    >>> doc = "query A { hello }\\nmutation B { deleteEverything }"
    >>> sorted(op.value for op in operation_types(doc))
    ['mutation', 'query']
    """
    try:
        document = parse_graphql(query)
    except GraphQLSyntaxError:
        return set()
    return {
        definition.operation
        for definition in document.definitions
        if isinstance(definition, OperationDefinitionNode)
    }


def admit(query: str, *, allow_mutations: bool) -> set[GraphQLOperationType]:
    """Decide whether ``query`` may run, and return the operation types it declares.

    Args:
        query: The GraphQL document.
        allow_mutations: Whether mutation operations may execute.

    Returns:
        The operation types declared in the document.

    Raises:
        GraphQLRefusal: The operation is too large, contains a subscription, or
            contains a mutation the caller may not run.
    """
    if len(query.encode("utf-8")) > MAX_QUERY_BYTES:
        raise GraphQLRefusal(
            GraphQLRefusalCode.QUERY_TOO_LARGE,
            f"The operation exceeds {MAX_QUERY_BYTES // 1024} KiB and was not executed. "
            "Request fewer fields, or split the work across several operations.",
        )
    declared = operation_types(query)
    if GraphQLOperationType.SUBSCRIPTION in declared:
        raise GraphQLRefusal(
            GraphQLRefusalCode.SUBSCRIPTION_NOT_SUPPORTED,
            "Subscriptions are not supported.",
        )
    if GraphQLOperationType.MUTATION in declared and not allow_mutations:
        raise GraphQLRefusal(
            GraphQLRefusalCode.MUTATION_NOT_ALLOWED,
            "Mutations are not permitted.",
        )
    return declared


def validate_document(schema: strawberry.Schema, query: str) -> None:
    """Check ``query`` against the schema without executing it.

    This answers whether the document typechecks: fields exist on the types
    they are selected from, arguments and fragments are well-formed, variables
    are declared where used. It does not check the values supplied for those
    variables, and it does not evaluate permissions -- those live in resolvers
    and only run during execution.

    Raises:
        GraphQLRefusal: The document could not be parsed or did not validate.
    """
    try:
        document = parse_graphql(query)
    except GraphQLSyntaxError as error:
        raise GraphQLRefusal(GraphQLRefusalCode.PARSE_ERROR, str(error)) from error
    # The compiled graphql-core schema, which is what validation runs against;
    # strawberry exposes it only as a private attribute and is pinned to an
    # exact version.
    if errors := validate_graphql(schema._schema, document):
        raise GraphQLRefusal(
            GraphQLRefusalCode.VALIDATION_FAILED,
            "; ".join(error.message for error in errors),
        )


async def execute_operation(
    schema: strawberry.Schema,
    *,
    query: str,
    variables: Optional[dict[str, Any]],
    context: Context,
    allow_mutations: bool,
) -> GraphQLOutcome:
    """Admit and run one GraphQL operation.

    Args:
        schema: The Strawberry schema to execute against.
        query: The GraphQL document.
        variables: Variable values for the operation, if it declares any.
        context: The request context resolvers receive, carrying the principal
            whose permissions apply.
        allow_mutations: Whether mutation operations may execute. Enforced twice
            -- here on the parsed document, and by the schema itself -- so a
            document this module misreads still cannot mutate.

    Returns:
        The operation's data and formatted errors.

    Raises:
        GraphQLRefusal: The operation was not admitted.
    """
    admit(query, allow_mutations=allow_mutations)
    allowed = (
        {OperationType.QUERY, OperationType.MUTATION} if allow_mutations else {OperationType.QUERY}
    )
    result = await schema.execute(
        query,
        variable_values=variables,
        context_value=context,
        allowed_operation_types=allowed,
    )
    return GraphQLOutcome(
        data=result.data,
        errors=tuple(error.formatted for error in result.errors or []),
    )
