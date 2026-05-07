import binascii
import re
from base64 import b64decode

from strawberry.relay import GlobalID

_COMPOSITE_GLOBAL_ID_PATTERN = re.compile(r"[^:]+:[^:]+(:[^:]+)+")


def is_composite_global_id(node_id: str) -> bool:
    """Return True if `node_id` is a base64-encoded composite global id.

    Strings that are not valid base64 (e.g. literal project names like
    "default" passed in via /projects/<name>/* URLs) are not composite
    global ids — return False rather than raising.  See
    https://github.com/Arize-ai/phoenix/issues/12908
    """
    try:
        decoded_node_id = b64decode(node_id, validate=True).decode()
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return False
    return _COMPOSITE_GLOBAL_ID_PATTERN.match(decoded_node_id) is not None


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
