import re
from base64 import b64decode

from strawberry.relay import GlobalID

_GLOBAL_ID_PATTERN = re.compile(r"[a-zA-Z]+:[0-9]+")


def is_global_id(node_id: str) -> bool:
    decoded_node_id = b64decode(node_id).decode()
    return _GLOBAL_ID_PATTERN.match(decoded_node_id) is not None


def from_global_id(global_id: GlobalID) -> tuple[str, int]:
    """
    Decode the given global id into a type and id.

    :param global_id: The global id to decode.
    :return: A tuple of type and id.
    """
    return global_id.type_name, int(global_id.node_id)


def from_global_id_with_expected_type(global_id: GlobalID, expected_type_name: str) -> int:
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
