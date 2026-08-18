import re
from base64 import b64decode
from binascii import Error as BinasciiError
from typing import TYPE_CHECKING, cast

from strawberry.relay import GlobalID

_COMPOSITE_GLOBAL_ID_PATTERN = re.compile(r"[^:]+:[^:]+(:[^:]+)+")

if TYPE_CHECKING:
    from phoenix.db.models import SandboxBackendType

#: Widest row id any supported dialect's integer primary key holds (sqlite's 64-bit
#: rowid; postgres `SERIAL` is narrower still). A larger value identifies no row and
#: raises when bound rather than missing, so it is rejected here.
_ROWID_RANGE = range(-(2**63), 2**63)


def _to_rowid(node_id: str) -> int:
    """Parse a Relay node id as a row id, rejecting values no row can have."""
    rowid = int(node_id)
    if rowid not in _ROWID_RANGE:
        raise ValueError(f"The node id is out of range: {node_id}")
    return rowid


def is_composite_global_id(node_id: str) -> bool:
    try:
        decoded_node_id = b64decode(node_id).decode()
    except (BinasciiError, UnicodeDecodeError):
        return False
    return _COMPOSITE_GLOBAL_ID_PATTERN.match(decoded_node_id) is not None


def from_global_id(global_id: GlobalID) -> tuple[str, int]:
    """
    Decode the given global id into a type and id.

    :param global_id: The global id to decode.
    :return: A tuple of type and id.
    """
    return global_id.type_name, _to_rowid(global_id.node_id)


def from_global_id_with_expected_type(global_id: GlobalID, expected_type_name: str) -> int:
    """
    Decodes the given global id and return the id, checking that the type
    matches the expected type.
    """
    type_name = global_id.type_name
    if type_name != expected_type_name:
        raise ValueError(
            f"The node id must correspond to a node of type {expected_type_name}, "
            f"but instead corresponds to a node of type: {type_name}"
        )
    try:
        return _to_rowid(global_id.node_id)
    except ValueError as exc:
        raise ValueError(
            f"The node id must correspond to a node of type {expected_type_name}, "
            f"but the id is not a valid integer"
        ) from exc


def from_global_id_str_with_expected_type(global_id: GlobalID, expected_type_name: str) -> str:
    """Decode a GlobalID with a non-integer Relay node payload (type-checked)."""
    type_name = global_id.type_name
    if type_name != expected_type_name:
        raise ValueError(
            f"The node id must correspond to a node of type {expected_type_name}, "
            f"but instead corresponds to a node of type: {type_name}"
        )
    return str(global_id.node_id)


def get_sandbox_backend_type_from_global_id(global_id: GlobalID) -> "SandboxBackendType":
    return cast(
        "SandboxBackendType",
        from_global_id_str_with_expected_type(
            global_id,
            expected_type_name="SandboxProvider",
        ),
    )
