from importlib.metadata import version
from typing import Any, List, Type, Union

_MIN_OPENAI_VERSION = "3.26.0"


def create_openai_client(model: str, is_async: bool, **kwargs: Any) -> Any:
    try:
        from openai import AsyncOpenAI, OpenAI
    except ImportError:
        raise ImportError(
            f"openai package not installed. Run: pip install 'openai>={_MIN_OPENAI_VERSION}'"
        )

    kwargs.setdefault("max_retries", 0)

    client: Union[AsyncOpenAI, OpenAI]
    if is_async:
        client = AsyncOpenAI(**kwargs)
    else:
        client = OpenAI(**kwargs)

    # The Decisions API is a capability of newer SDKs; an older openai is importable but has
    # no ``decisions`` resource
    if not hasattr(client, "decisions"):
        raise ImportError(
            f"The installed openai SDK ({version('openai')}) has no Decisions API. "
            f"Run: pip install 'openai>={_MIN_OPENAI_VERSION}'"
        )
    return client


def get_openai_rate_limit_errors() -> List[Type[Exception]]:
    from openai import RateLimitError

    return [RateLimitError]
