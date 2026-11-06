from typing import Any, Optional


def clean_headers(headers: Any) -> Optional[dict[str, str]]:
    """Drop entries whose value is empty or whitespace-only."""
    if not headers or not hasattr(headers, "items"):
        return None
    cleaned = {k: v for k, v in headers.items() if isinstance(v, str) and v.strip()}
    return cleaned or None
