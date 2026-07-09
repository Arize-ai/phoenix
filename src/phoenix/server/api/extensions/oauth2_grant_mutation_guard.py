from __future__ import annotations

from collections.abc import Iterator

from graphql import GraphQLError
from graphql.language import OperationType
from graphql.utilities import get_operation_ast
from strawberry.extensions import SchemaExtension

from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.types import AccessTokenAttributes


class OAuth2GrantMutationGuard(SchemaExtension):
    """Reject GraphQL mutations authenticated with OAuth2 grant-linked access tokens."""

    def on_execute(self) -> Iterator[None]:
        if _is_mutation(self) and _has_grant_linked_access_token(self):
            raise GraphQLError("OAuth2 grant-linked tokens cannot perform GraphQL mutations")
        yield


def _is_mutation(extension: SchemaExtension) -> bool:
    document = extension.execution_context.graphql_document
    if document is None:
        return False
    operation = get_operation_ast(document, extension.execution_context.operation_name)
    return operation is not None and operation.operation is OperationType.MUTATION


def _has_grant_linked_access_token(extension: SchemaExtension) -> bool:
    context = extension.execution_context.context
    user = getattr(context, "user", None)
    if not isinstance(user, PhoenixUser):
        return False
    claims = getattr(user, "claims", None)
    attributes = getattr(claims, "attributes", None)
    return isinstance(attributes, AccessTokenAttributes) and attributes.grant_id is not None
