import base64
from typing import Tuple


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
