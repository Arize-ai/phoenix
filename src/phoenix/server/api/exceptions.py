from graphql.error import GraphQLError
from strawberry.extensions import MaskErrors

from phoenix.exceptions import PhoenixException as _PhoenixException


class PhoenixGraphQLException(_PhoenixException):
    """
    An error that represents an expected error scenario in a GraphQL resolver.
    """

    pass


def get_mask_errors_extension() -> MaskErrors:
    return MaskErrors(
        should_mask_error=_should_mask_error,
        error_message="an unexpected error occurred",
    )


def _should_mask_error(error: GraphQLError) -> bool:
    """
    Masks expected errors raised from GraphQL resolvers.
    """
    return not isinstance(error.original_error, PhoenixGraphQLException)
