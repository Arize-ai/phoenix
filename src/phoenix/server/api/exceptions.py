from collections.abc import Iterator
from typing import Any, Optional

from graphql.error import GraphQLError
from graphql.execution.execute import ExecutionResult as GraphQLExecutionResult
from strawberry.extensions.base_extension import SchemaExtension
from strawberry.types.execution import ExecutionResult as StrawberryExecutionResult

from phoenix.config import get_env_mask_internal_server_errors


class CustomGraphQLError(Exception):
    """
    An error that represents an expected error scenario in a GraphQL resolver.
    """


class BadRequest(CustomGraphQLError):
    """
    An error raised due to a malformed or invalid request.
    """


class NotFound(CustomGraphQLError):
    """
    An error raised when the requested resource is not found.
    """


class Unauthorized(CustomGraphQLError):
    """
    An error raised when login fails or a user or other entity is not authorized
    to access a resource.
    """


class InsufficientStorage(CustomGraphQLError):
    """
    An error raised when the database has insufficient storage to complete a request.
    """


class Conflict(CustomGraphQLError):
    """
    An error raised when a mutation cannot be completed due to a conflict with
    the current state of one or more resources.
    """


_GENERIC_MASK_MESSAGE = "an unexpected error occurred"


def _find_custom_error(error: BaseException) -> Optional[CustomGraphQLError]:
    """Walk the original_error / __cause__ chain looking for a CustomGraphQLError.

    graphql-core wraps scalar `parse_value` errors in an outer GraphQLError and
    prefixes the message with the variable path + type name, which leaks
    implementation detail to the UI. The inner CustomGraphQLError is what we
    want to surface.
    """
    current: Optional[BaseException] = error
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        if isinstance(current, CustomGraphQLError):
            return current
        seen.add(id(current))
        current = getattr(current, "original_error", None) or current.__cause__
    return None


class PhoenixErrorMasker(SchemaExtension):
    """Replace error messages with the inner CustomGraphQLError's message
    if present; otherwise mask with a generic message (when enabled)."""

    def _rewrite(self, error: GraphQLError) -> GraphQLError:
        inner = _find_custom_error(error)
        if inner is not None:
            return GraphQLError(
                message=str(inner),
                nodes=error.nodes,
                source=error.source,
                positions=error.positions,
                path=error.path,
                original_error=None,
            )
        if not get_env_mask_internal_server_errors():
            return error
        return GraphQLError(
            message=_GENERIC_MASK_MESSAGE,
            nodes=error.nodes,
            source=error.source,
            positions=error.positions,
            path=error.path,
            original_error=None,
        )

    def _process_result(self, result: Any) -> None:
        if not result.errors:
            return
        result.errors = [self._rewrite(e) for e in result.errors]

    def on_operation(self) -> Iterator[None]:
        yield
        result = self.execution_context.result
        if isinstance(result, (GraphQLExecutionResult, StrawberryExecutionResult)):
            self._process_result(result)
        elif result:
            self._process_result(result.initial_result)


def get_mask_errors_extension() -> type[SchemaExtension]:
    return PhoenixErrorMasker
