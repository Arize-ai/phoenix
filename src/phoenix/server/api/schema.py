from itertools import chain
from typing import Any, Iterable, Iterator, Optional, Union

import strawberry
from graphql.language import ListValueNode, NameNode, ObjectFieldNode, ObjectValueNode, ValueNode
from starlette.datastructures import Secret
from strawberry.extensions import SchemaExtension
from strawberry.printer import ast_from_value as strawberry_ast_from_value
from strawberry.schema.config import StrawberryConfig
from strawberry.types.base import StrawberryObjectDefinition, StrawberryType

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
from phoenix.server.api.types.Identifier import Identifier, identifier_scalar_definition
from phoenix.server.api.types.SecretString import secret_string_scalar_definition


def _patch_strawberry_schema_printer() -> None:
    """
    Monkey-patch Strawberry's ``ast_from_leaf_type`` for graphql-core 3.3 schema printing.

    graphql-core 3.3 uses frozen, kw-only AST nodes; Strawberry switched object literals
    to ``tuple(...)`` for ``ObjectValueNode.fields`` (among other nodes), including in
    ``ast_from_leaf_type`` — see https://github.com/strawberry-graphql/strawberry/pull/4267
    (that PR also contains unrelated gql-core 3.3 execute fixes).

    Strawberry still does not recurse through Python ``list`` / ``tuple`` values inside
    serialized dicts: ``ast_from_leaf_type({"a": [1]})`` raises ``TypeError`` on stock
    0.314.x. This wrapper keeps upstream dict handling and adds list/tuple handling so
    nested structures (e.g. input defaults) can be printed.

    TODO: Drop this patch if ``strawberry.printer.ast_from_value.ast_from_leaf_type``
    gains equivalent list/tuple support upstream.
    """
    if getattr(strawberry_ast_from_value, "_phoenix_patch_applied", False):
        return

    original_ast_from_leaf_type = strawberry_ast_from_value.ast_from_leaf_type

    def patched_ast_from_leaf_type(serialized: object, type_: object | None) -> ValueNode:
        if isinstance(serialized, dict):
            return ObjectValueNode(  # type: ignore[call-arg]
                fields=tuple(
                    ObjectFieldNode(  # type: ignore[call-arg]
                        name=NameNode(value=str(key)),  # type: ignore[call-arg]
                        value=patched_ast_from_leaf_type(value, None),
                    )
                    for key, value in serialized.items()
                )
            )
        if isinstance(serialized, (list, tuple)):
            return ListValueNode(  # type: ignore[call-arg]
                values=tuple(patched_ast_from_leaf_type(value, None) for value in serialized)
            )
        return original_ast_from_leaf_type(serialized, type_)  # type: ignore[arg-type]

    strawberry_ast_from_value.ast_from_leaf_type = patched_ast_from_leaf_type
    strawberry_ast_from_value._phoenix_patch_applied = True  # type: ignore[attr-defined]


_patch_strawberry_schema_printer()


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
        config=StrawberryConfig(
            enable_experimental_incremental_execution=True,
            scalar_map={
                Identifier: identifier_scalar_definition,
                CronExpression: cron_expression_scalar_definition,
                Secret: secret_string_scalar_definition,
            },
        ),
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
