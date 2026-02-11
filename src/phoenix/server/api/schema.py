from itertools import chain
from typing import Any, Iterable, Iterator, Optional, Union

import strawberry
from strawberry.extensions import SchemaExtension
from strawberry.types.base import StrawberryObjectDefinition, StrawberryType

from phoenix.server.api.exceptions import get_mask_errors_extension
from phoenix.server.api.mutations import Mutation
from phoenix.server.api.queries import Query
from phoenix.server.api.subscriptions import Subscription
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import (
    ChatCompletionSubscriptionPayload,
)
from phoenix.server.api.types.Evaluator import (
    Evaluator,
)


def build_graphql_schema(
    extensions: Optional[Iterable[Union[type[SchemaExtension], SchemaExtension]]] = None,
) -> strawberry.Schema:
    """
    Builds a strawberry schema.
    """
    return strawberry.Schema(
        query=Query,
        mutation=Mutation,
        extensions=list(chain(extensions or [], [get_mask_errors_extension()])),
        subscription=Subscription,
        types=list(
            chain(
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
    assert isinstance(
        strawberry_definition := getattr(interface, "__strawberry_definition__", None),
        StrawberryObjectDefinition,
    )
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
