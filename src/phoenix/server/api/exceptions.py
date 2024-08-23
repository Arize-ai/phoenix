from graphql.error import GraphQLError
from strawberry.extensions import MaskErrors


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


def get_mask_errors_extension() -> MaskErrors:
    return MaskErrors(
        should_mask_error=_should_mask_error,
        error_message="an unexpected error occurred",
    )


def _should_mask_error(error: GraphQLError) -> bool:
    """
    Masks unexpected errors raised from GraphQL resolvers.
    """
    return not isinstance(error.original_error, CustomGraphQLError)
