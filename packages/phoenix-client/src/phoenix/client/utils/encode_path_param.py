from urllib.parse import quote


def encode_path_param(s: str) -> str:
    """
    Quoting function for FastAPI path parameters.

    Encodes a string for use in URL paths, raising ValueError if it
    contains characters that would cause routing issues (/, ?, #).

    Args:
        s (str): The string to encode

    Returns:
        str: The encoded string safe for path parameters

    Raises:
        ValueError: If the string contains /, ?, or # characters
    """
    for char in "/?#":
        if char in s:
            raise ValueError(f"Cannot encode string containing '{char}' for URL path: {s}")
    return quote(s, safe="")
