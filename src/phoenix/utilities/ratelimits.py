import asyncio
import sys
import time
from collections import defaultdict
from contextlib import contextmanager
from functools import wraps
from typing import Any, Callable, ContextManager, Dict, Generator, TypeVar, Union

if sys.version_info < (3, 10):
    from typing_extensions import ParamSpec
else:
    from typing import ParamSpec

Numeric = Union[int, float]
P = ParamSpec("P")
T = TypeVar("T")


class LeakyBucket:
    """
    A simple in-memory rate-limiter implemented using the leaky bucket algorithm.
    """

    def __init__(self, per_minute_rate: Numeric, starting_tokens: Numeric, max_tokens: Numeric):
        self.rate = self._per_second_rate(per_minute_rate)
        self.tokens = starting_tokens
        self.max_tokens = max_tokens
        self.last_checked = time.time()

    def _per_second_rate(self, per_minute_rate: Numeric) -> float:
        return round(per_minute_rate / 60, 3)

    def verify_limit(self, per_minute_rate: Numeric) -> None:
        new_rate = self._per_second_rate(per_minute_rate)
        if self.rate != new_rate:
            self.rate = new_rate
            self.tokens = 0  # reset tokens as conservatively as possible
            self.last_checked = time.time()

    def available_tokens(self) -> Numeric:
        time_since_last_checked = time.time() - self.last_checked
        return min(self.max_tokens, self.rate * time_since_last_checked + self.tokens)

    def wait_for_available_tokens(self, token_cost: Numeric) -> None:
        seconds_until_ready = (token_cost - self.available_tokens()) / self.rate
        if seconds_until_ready > 0:
            time.sleep(seconds_until_ready)

    def spend_tokens(self, token_cost: Numeric) -> Numeric:
        now = time.time()
        self.tokens -= (self.last_checked - now) * self.rate + token_cost
        self.last_checked = now
        return self.last_checked

    async def async_wait_for_available_tokens(self, token_cost: int) -> None:
        seconds_until_ready = (token_cost - self.available_tokens()) / self.rate
        if seconds_until_ready > 0:
            await asyncio.sleep(seconds_until_ready)


class LimitStore:
    """
    A singleton store for collections of rate limits grouped by service key.

    LimitStore is a singleton because we want to share rate limits across all calls controlled by
    phoenix's rate limiting mechanism.
    """

    _singleton = None

    def __new__(cls) -> "LimitStore":
        if not cls._singleton:
            cls._singleton = super().__new__(cls)
            cls._singleton._store = defaultdict(dict)
        return cls._singleton

    _store: Dict[str, Dict[str, LeakyBucket]]

    def set_rate_limit(self, key: str, limit_type: str, per_minute_rate_limit: Numeric) -> None:
        if limits := self._store[key]:
            if limit := limits.get(limit_type):
                limit.verify_limit(per_minute_rate_limit)
        limits[limit_type] = LeakyBucket(
            per_minute_rate_limit,
            0,
            per_minute_rate_limit,
        )

    def wait_for_rate_limits(self, key: str, rate_limit_costs: Dict[str, Numeric]) -> None:
        rate_limits = self._store[key]
        for limit_type, cost in rate_limit_costs.items():
            if limit := rate_limits.get(limit_type):
                limit.wait_for_available_tokens(cost)

    def update_rate_limits(self, key: str, rate_limit_costs: Dict[str, Numeric]) -> None:
        rate_limits = self._store[key]
        for limit_type, cost in rate_limit_costs.items():
            if limit := rate_limits.get(limit_type):
                limit.spend_tokens(cost)


class OpenAIRateLimiter:
    def __init__(self, api_key: str) -> None:
        self._store = LimitStore()
        self._api_key = api_key

    def key(self, model_name: str) -> str:
        return f"openai:{self._api_key}:{model_name}"

    def set_rate_limits(
        self, model_name: str, request_rate_limit: Numeric, token_rate_limit: Numeric
    ) -> None:
        self._store.set_rate_limit(self.key(model_name), "requests", request_rate_limit)
        self._store.set_rate_limit(self.key(model_name), "tokens", token_rate_limit)

    def limit(
        self, model_name: str, token_cost: Numeric
    ) -> Callable[[Callable[P, T]], ContextManager[Callable[P, T]]]:
        @contextmanager
        def rate_limit_decorator(fn: Callable[P, T]) -> Generator[Callable[P, T], None, None]:
            @wraps(fn)
            def wrapper(*args: Any, **kwargs: Any) -> Generator[T, None, None]:
                self._store.wait_for_rate_limits(
                    self.key(model_name), {"requests": 1, "tokens": token_cost}
                )
                try:
                    result: T
                    result = fn(*args, **kwargs)
                    yield result
                finally:
                    # always consume the rate limit, even if the call fails
                    self._store.update_rate_limits(
                        self.key(model_name), {"requests": 1, "tokens": token_cost}
                    )

            return wrapper  # type: ignore

        return rate_limit_decorator
