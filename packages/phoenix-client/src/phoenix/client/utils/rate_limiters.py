"""Rate limiting for outbound requests.

The implementation lives in `phoenix.executors.rate_limiters` and is shared with
`arize-phoenix-evals`. Every name below is the same object as its counterpart there, so
`except RateLimitError` and `isinstance` checks work across both packages.
"""

from phoenix.executors.rate_limiters import (
    AdaptiveTokenBucket,
    AsyncCallable,
    GenericType,
    ParameterSpec,
    RateLimiter,
    RateLimitError,
    UnavailableTokensError,
)

__all__ = [
    "AdaptiveTokenBucket",
    "AsyncCallable",
    "GenericType",
    "ParameterSpec",
    "RateLimitError",
    "RateLimiter",
    "UnavailableTokensError",
]
