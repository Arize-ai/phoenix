import base64
from typing import Tuple


def to_global_id(type_name: str, node_id: int) -> str:
    """
    Encode the given id into a global id.

    :param type_name: The type of the node.
    :param node_id: The id of the node.
    :return: A global id.
    """
    return base64.b64encode(f"{type_name}:{node_id}".encode("utf-8")).decode()


def from_global_id(global_id: str) -> Tuple[str, int]:
    """
    Decode the given global id into a type and id.

    :param global_id: The global id to decode.
    :return: A tuple of type and id.
    """
    type_name, node_id = base64.b64decode(global_id).decode().split(":")
    return type_name, int(node_id)


def from_global_id_with_expected_type(global_id: str, expected_type_name: str) -> int:
    """
    Decodes the given global id and return the id, checking that the type
    matches the expected type.
    """
    type_name, node_id = from_global_id(global_id)
    if type_name != expected_type_name:
        raise ValueError(
            f"The node id must correspond to a node of type {expected_type_name}, "
            f"but instead corresponds to a node of type: {type_name}"
        )
    return node_id
