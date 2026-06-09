from __future__ import annotations

from typing import Any, Optional

import strawberry
from strawberry.types import ExecutionResult
from strawberry.types.graphql import OperationType

from phoenix.server.api.context import Context

# Operation types this process is allowed to run against the schema. The agent's
# GraphQL surface (both the ``run_graphql_query`` tool and the ``phoenix-gql``
# bash command) is read-only, so only ``query`` operations are permitted.
# Strawberry raises ``InvalidOperationTypeError`` when a mutation or subscription
# is submitted, which callers translate into a user-facing error.
READ_ONLY_OPERATION_TYPES = frozenset({OperationType.QUERY})


async def execute_networkless_query(
    *,
    schema: strawberry.Schema,
    context: Context,
    query: str,
    variable_values: Optional[dict[str, Any]] = None,
) -> ExecutionResult:
    """Execute a read-only GraphQL query against ``schema`` without a network hop.

    Runs ``schema.execute`` directly in-process with the given Phoenix GraphQL
    ``context`` instead of issuing an HTTP request, restricting execution to
    ``query`` operations. Mutations and subscriptions raise
    ``strawberry.schema.exceptions.InvalidOperationTypeError``; GraphQL execution
    errors are returned on ``ExecutionResult.errors`` for the caller to handle.
    """
    return await schema.execute(
        query,
        variable_values=variable_values,
        context_value=context,
        allowed_operation_types=set(READ_ONLY_OPERATION_TYPES),
    )
