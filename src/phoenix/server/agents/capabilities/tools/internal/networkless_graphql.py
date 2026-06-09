from __future__ import annotations

from typing import Any, Optional

import strawberry
from strawberry.types import ExecutionResult
from strawberry.types.graphql import OperationType

from phoenix.server.api.context import Context

READ_ONLY_OPERATION_TYPES = frozenset({OperationType.QUERY})


async def execute_networkless_query(
    *,
    schema: strawberry.Schema,
    context: Context,
    query: str,
    variable_values: Optional[dict[str, Any]] = None,
) -> ExecutionResult:
    """Execute a read-only GraphQL query against ``schema`` without a network hop."""
    return await schema.execute(
        query,
        variable_values=variable_values,
        context_value=context,
        allowed_operation_types=set(READ_ONLY_OPERATION_TYPES),
    )
