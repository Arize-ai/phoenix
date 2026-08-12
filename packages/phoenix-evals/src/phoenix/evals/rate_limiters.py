"""Rate limiting for provider requests.

The implementation lives in `phoenix.executors.rate_limiters` and is shared with
`arize-phoenix-client`. Every name below is the same object as its counterpart there, so
`except RateLimitError` and `isinstance` checks work across both packages.
"""

from typing import Any

from phoenix.executors.rate_limiters import (
    AdaptiveTokenBucket,
    AsyncCallable,
    GenericType,
    ParameterSpec,
    RateLimiter,
    RateLimitError,
    UnavailableTokensError,
)
from tqdm.auto import tqdm

__all__ = [
    "AdaptiveTokenBucket",
    "AsyncCallable",
    "GenericType",
    "ParameterSpec",
    "RateLimitError",
    "RateLimiter",
    "UnavailableTokensError",
    "printif",
]


def printif(condition: bool, *args: Any, **kwargs: Any) -> None:
    """Print arguments if the condition is True.

    Deprecated. `RateLimiter` now takes a `notify` callable instead; pass one to redirect its
    output. This function remains only so existing imports keep working.

    Args:
        condition (bool): Whether to print or not.
        *args (Any): Positional arguments to pass to tqdm.write.
        **kwargs (Any): Keyword arguments to pass to tqdm.write.
    """
    if condition:
        tqdm.write(*args, **kwargs)
