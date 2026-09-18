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

# An operation larger than this is refused unexecuted. Enforced at admission,
# not transport, so it holds however the operation arrived.
MAX_QUERY_BYTES = 2 * 1024


class GraphQLRefusalCode(str, Enum):
    QUERY_TOO_LARGE = "query_too_large"
    PARSE_ERROR = "parse_error"
    SUBSCRIPTION_NOT_SUPPORTED = "subscription_not_supported"
    MUTATION_NOT_ALLOWED = "mutation_not_allowed"
    VALIDATION_FAILED = "validation_failed"
    AMBIGUOUS_OPERATION = "ambiguous_operation"


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


def operation_count(query: str) -> int:
    """How many operations ``query`` declares.

    Invalid syntax counts as one and is left for execution to report.

    >>> operation_count("query A { hello }\\nquery B { hello }")
    2
    >>> operation_count("not graphql")
    1
    """
    try:
        document = parse_graphql(query)
    except GraphQLSyntaxError:
        return 1
    return sum(isinstance(d, OperationDefinitionNode) for d in document.definitions)


def operation_types(query: str) -> set[GraphQLOperationType]:
    """Return the set of GraphQL operation types declared in ``query``.

    Read from the parsed document, so comments and the shorthand query form are
    classified correctly. Invalid syntax yields an empty set and is left for
    execution to report.

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


def admit(
    query: str, *, allow_mutations: bool, operation_name: Optional[str] = None
) -> set[GraphQLOperationType]:
    """Decide whether ``query`` may run, and return the operation types it declares.

    Args:
        query: The GraphQL document.
        allow_mutations: Whether mutation operations may execute.
        operation_name: The operation to run. Without one, a document declaring
            several operations is refused rather than left to execution, which
            would run the first and skip the rest.

    Returns:
        The operation types declared in the document.

    Raises:
        GraphQLRefusal: The operation is too large, contains a subscription,
            contains a mutation the caller may not run, or is one of several
            and not named.
    """
    if len(query.encode("utf-8")) > MAX_QUERY_BYTES:
        raise GraphQLRefusal(
            GraphQLRefusalCode.QUERY_TOO_LARGE,
            f"The GraphQL document exceeds {MAX_QUERY_BYTES // 1024} KiB and was not "
            "executed. Variable values do not count toward the limit: move large literals "
            "into variables, request fewer fields, or split the work across separate requests.",
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
    if operation_name is None and operation_count(query) > 1:
        raise GraphQLRefusal(
            GraphQLRefusalCode.AMBIGUOUS_OPERATION,
            "The document declares several operations and names none to run. Send one "
            "operation per request; one operation may select several fields.",
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
    # Validation runs against the compiled graphql-core schema, which
    # strawberry exposes only as ``_schema``.
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
    operation_name: Optional[str] = None,
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
        operation_name: Which operation to run when the document declares
            several. Required in that case; execution reports its absence.

    Returns:
        The operation's data and formatted errors.

    Raises:
        GraphQLRefusal: The operation was not admitted.
    """
    admit(query, allow_mutations=allow_mutations, operation_name=operation_name)
    allowed = (
        {OperationType.QUERY, OperationType.MUTATION} if allow_mutations else {OperationType.QUERY}
    )
    result = await schema.execute(
        query,
        variable_values=variables,
        context_value=context,
        operation_name=operation_name,
        allowed_operation_types=allowed,
    )
    return GraphQLOutcome(
        data=result.data,
        errors=tuple(error.formatted for error in result.errors or []),
    )
