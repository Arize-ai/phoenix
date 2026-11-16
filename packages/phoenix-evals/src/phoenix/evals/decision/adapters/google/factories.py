from importlib.metadata import version
from typing import Any

_MIN_GOOGLE_GENAI_VERSION = "3.2"


def create_google_client(model: str, is_async: bool, **kwargs: Any) -> Any:
    try:
        from google import genai
    except ImportError:
        raise ImportError(
            f"google-genai package not installed. "
            f"Run: pip install 'google-genai>={_MIN_GOOGLE_GENAI_VERSION}'"
        )

    # The Decisions API lives on the v1beta surface, so force it regardless of caller input.
    http_options: Any = dict(kwargs.pop("http_options", None) or {})
    http_options["api_version"] = "v1beta"

    # A single genai.Client serves both sync (``client.decisions``) and async
    # (``client.aio.decisions``) calls, so ``is_async`` needs no special handling here.
    client = genai.Client(http_options=http_options, **kwargs)

    if not hasattr(client, "decisions"):
        raise ImportError(
            f"The installed google-genai SDK ({version('google-genai')}) has no Decisions API. "
            f"Run: pip install 'google-genai>={_MIN_GOOGLE_GENAI_VERSION}'"
        )
    return client
