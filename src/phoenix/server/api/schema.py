from itertools import chain
from typing import Any, Callable, Iterable, Iterator, Optional, Union

import strawberry
from graphql import GraphQLObjectType
from graphql.execution.collect_fields import CollectedFields, FieldDetailsList
from pydantic import SecretStr
from strawberry.extensions import SchemaExtension
from strawberry.schema.config import StrawberryConfig
from strawberry.schema.schema import StrawberryGraphQLCoreExecutionContext
from strawberry.types.base import StrawberryObjectDefinition, StrawberryType

from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import get_mask_errors_extension
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


def build_graphql_schema(
    extensions: Optional[
        Iterable[Union[type[SchemaExtension], Callable[[], SchemaExtension]]]
    ] = None,
) -> strawberry.Schema:
    """
    Builds a strawberry schema.
    """
    return strawberry.Schema(
        query=Query,
        mutation=Mutation,
        extensions=list(chain(extensions or [], [get_mask_errors_extension()])),
        subscription=Subscription,
        execution_context_class=RetainFieldDetailsExecutionContext,
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


class RetainFieldDetailsExecutionContext(StrawberryGraphQLCoreExecutionContext):
    """
    Works around a use-after-free cache collision in graphql-core 3.3.0
    (https://github.com/graphql-python/graphql-core/issues/284).

    `collect_subfields` memoizes its results keyed by the `id()` of the
    transient `FieldDetails` items in `field_details_list` without keeping
    them alive. Once a fast root field completes, its items can be freed and
    their addresses reused by a slower sibling, which then gets the wrong
    selection set from the cache. Holding a reference to every list for the
    lifetime of the execution context keeps those ids unique, mirroring the
    upstream fix (https://github.com/graphql-python/graphql-core/pull/285).

    TODO: remove once graphql-core>=3.3.1 is required.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._retained_field_details_lists: dict[int, FieldDetailsList] = {}

    def collect_subfields(
        self,
        return_type: GraphQLObjectType,
        field_details_list: FieldDetailsList,
    ) -> CollectedFields:
        # Keyed by id so lists shared across list items are retained only once;
        # the id is stable because the list itself is kept alive.
        self._retained_field_details_lists[id(field_details_list)] = field_details_list
        return super().collect_subfields(return_type, field_details_list)


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
