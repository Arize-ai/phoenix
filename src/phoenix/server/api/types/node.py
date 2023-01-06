import base64
import dataclasses
from typing import Tuple, Union

import strawberry
from graphql import GraphQLID
from strawberry.custom_scalar import ScalarDefinition
from strawberry.schema.types.scalar import DEFAULT_SCALAR_REGISTRY


def to_global_id(type: str, id: int) -> str:
    """
    Encode the given id into a global id.

    :param type: The type of the node.
    :param id: The id of the node.
    :return: A global id.
    """
    return base64.b64encode(f"{type}:{id}".encode("utf-8")).decode()


def from_global_id(global_id: str) -> Tuple[str, int]:
    """
    Decode the given global id into a type and id.

    :param global_id: The global id to decode.
    :return: A tuple of type and id.
    """
    type, id = base64.b64decode(global_id).decode().split(":")
    return type, int(id)


class GlobalIDValueError(ValueError):
    """GlobalID value error, usually related to parsing or serialization."""


@dataclasses.dataclass(order=True, frozen=True)
class GlobalID:
    """Global ID for relay types.
    Different from `strawberry.ID`, this ID wraps the original object ID in a string
    that contains both its GraphQL type name and the ID itself, and encodes it
    to a base64_ string.
    This object contains helpers to work with that, including method to retrieve
    the python object type or even the encoded node itself.
    Attributes:
        type_name:
            The type name part of the id
        node_id:
            The node id part of the id
    .. _base64:
        https://en.wikipedia.org/wiki/Base64
    """

    type_name: str
    node_id: int

    def __post_init__(self) -> None:
        if not isinstance(self.type_name, str):
            raise GlobalIDValueError(
                f"type_name is expected to be a string, found {repr(self.type_name)}"
            )
        if not isinstance(self.node_id, int):
            raise GlobalIDValueError(
                f"node_id is expected to be an int, found {repr(self.node_id)}"
            )

    def __str__(self) -> str:
        return to_global_id(self.type_name, self.node_id)

    @classmethod
    def from_id(cls, value: Union[str, strawberry.ID]) -> "GlobalID":
        """Create a new GlobalID from parsing the given value.
        Args:
            value:
                The value to be parsed, as a base64 string in the "TypeName:NodeID" format
        Returns:
            An instance of GLobalID
        Raises:
            GlobalIDValueError:
                If the value is not in a GLobalID format
        """
        try:
            type_name, node_id = from_global_id(value)
        except ValueError as e:
            raise GlobalIDValueError(str(e)) from e

        return cls(type_name=type_name, node_id=node_id)


@strawberry.interface(description="A node in the graph with a globally unique ID")
class Node:
    """
    All types that are relay ready should inherit from this interface and
    implement the following methods.

    Attributes:
        id_attr:
            The raw id field of node. Typically a database id or index
    """

    id_attr: strawberry.Private[int]

    @strawberry.field
    def id(self) -> GlobalID:
        return GlobalID(type(self).__name__, self.id_attr)


# Register our GlobalID scalar
DEFAULT_SCALAR_REGISTRY[GlobalID] = ScalarDefinition(
    # Use the same name/description/parse_literal from GraphQLID
    # specs expect this type to be "ID".
    name="GlobalID",
    description=GraphQLID.description,
    parse_literal=lambda v, vars=None: GlobalID.from_id(GraphQLID.parse_literal(v, vars)),
    parse_value=GlobalID.from_id,
    serialize=str,
    specified_by_url="https://relay.dev/graphql/objectidentification.htm",
)
