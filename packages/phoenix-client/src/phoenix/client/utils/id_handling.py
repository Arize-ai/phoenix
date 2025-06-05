import base64


def is_node_id(s: str, node_type: str) -> bool:
    """
    Check if a string is a valid node ID.

    Args:
        s (str): The string to check.
        node_type (str): The type of node.
    """
    try:
        decoded = base64.b64decode(s, validate=True)
        return bool(decoded.startswith(f"{node_type}:".encode("utf-8")))
    except Exception:
        return False
