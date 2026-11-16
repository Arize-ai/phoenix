from typing import Any, List, Type, Union


def create_typesafe_client(model: str, is_async: bool, **kwargs: Any) -> Any:
    try:
        from typesafe_sdk import AsyncTypeSafeClient, RetryPolicy, TypeSafeClient
    except ImportError:
        raise ImportError("typesafe-sdk package not installed. Run: pip install typesafe-sdk")

    # Turn the SDK's own retries off so they don't stack on top of the RateLimiter,
    # unless the caller passed their own retry policy.
    kwargs.setdefault("retry", RetryPolicy(max_retries=0))

    client: Union[AsyncTypeSafeClient, TypeSafeClient]
    if is_async:
        client = AsyncTypeSafeClient(**kwargs)
    else:
        client = TypeSafeClient(**kwargs)
    return client


def get_typesafe_rate_limit_errors() -> List[Type[Exception]]:
    from typesafe_sdk import TypeSafeRateLimitError

    return [TypeSafeRateLimitError]
