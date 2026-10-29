import logging
from itertools import chain
from typing import Any, Callable, Iterable, Iterator, Optional, Union

import strawberry
from graphql import GraphQLError
from pydantic import SecretStr
from strawberry.extensions import SchemaExtension
from strawberry.schema.config import StrawberryConfig
from strawberry.types.base import StrawberryObjectDefinition, StrawberryType
from strawberry.types.execution import ExecutionContext

from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import get_mask_errors_extension, is_expected_error
from phoenix.server.api.mutations import Mutation
from phoenix.server.api.queries import Query
from phoenix.server.api.subscriptions import Subscription
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionPayload,
)
from phoenix.server.api.types.CronExpression import (
    CronExpression,
    cron_expression_scalar_definition,
)
from phoenix.server.api.types.Evaluator import (
    Evaluator,
)
from phoenix.server.api.types.ExperimentTag import ExperimentTag
from phoenix.server.api.types.Identifier import identifier_scalar_definition
from phoenix.server.api.types.RedactedString import (
    RedactedString,
    redacted_string_scalar_definition,
)
from phoenix.server.api.types.SecretString import secret_string_scalar_definition

logger = logging.getLogger(__name__)


class PhoenixSchema(strawberry.Schema):
    """Strawberry logs each error as ``str(error)``, which embeds the message and an
    excerpt of the request document, and does so before the extensions mask it for
    the client. Expected errors echo what the user sent, so they are not logged at
    all; the rest are logged by operation and position only.
    """

    def process_errors(
        self,
        errors: list[GraphQLError],
        execution_context: Optional[ExecutionContext] = None,
    ) -> None:
        operation_name = execution_context.operation_name if execution_context else None
        for error in errors:
            if is_expected_error(error):
                continue
            if error.original_error is None:
                locations = [(loc.line, loc.column) for loc in error.locations or ()]
                logger.warning("GraphQL operation %s rejected at %s", operation_name, locations)
            else:
                logger.error(
                    "GraphQL operation %s failed at path %s",
                    operation_name,
                    error.path,
                    exc_info=error.original_error,
                )


def build_graphql_schema(
    extensions: Optional[
        Iterable[Union[type[SchemaExtension], Callable[[], SchemaExtension]]]
    ] = None,
) -> strawberry.Schema:
    """
    Builds a strawberry schema.
    """
    return PhoenixSchema(
        query=Query,
        mutation=Mutation,
        extensions=list(chain(extensions or [], [get_mask_errors_extension()])),
        subscription=Subscription,
        config=StrawberryConfig(
            scalar_map={
                Identifier: identifier_scalar_definition,
                CronExpression: cron_expression_scalar_definition,
                SecretStr: secret_string_scalar_definition,
                RedactedString: redacted_string_scalar_definition,
            },
        ),
        types=list(
            chain(
                [ExperimentTag],
                _implementing_types(ChatCompletionSubscriptionPayload),
                _implementing_types(Evaluator),
            )
        ),
    )


def _implementing_types(interface: Any) -> Iterator[StrawberryType]:
    """
    Iterates over strawberry types implementing the given strawberry interface.
    Recursively includes all subclasses, not just direct subclasses.
    """
    strawberry_definition = getattr(interface, "__strawberry_definition__", None)
    assert isinstance(strawberry_definition, StrawberryObjectDefinition)
    assert strawberry_definition.is_interface

    def _get_all_subclasses(cls: Any) -> Iterator[StrawberryType]:
        """Recursively yields all subclasses of the given class."""
        for subcls in cls.__subclasses__():
            if isinstance(
                getattr(subcls, "__strawberry_definition__", None),
                StrawberryObjectDefinition,
            ):
                yield subcls
                # Recursively yield subclasses of this subclass
                yield from _get_all_subclasses(subcls)

    yield from _get_all_subclasses(interface)


_EXPORTED_GRAPHQL_SCHEMA = build_graphql_schema()  # used to export the GraphQL schema to file
