import asyncio
import time
from collections import defaultdict
from functools import wraps
from typing import Any, Awaitable, Callable, Dict, Optional, TypeVar, Union, cast

from typing_extensions import ParamSpec

Numeric = Union[int, float]
ParameterSpec = ParamSpec("ParameterSpec")
GenericType = TypeVar("GenericType")
AsyncCallable = TypeVar("AsyncCallable", bound=Callable[..., Awaitable[Any]])


class UnavailableTokensError(Exception):
    pass


class TokenRateLimiter:
    """
    A in-memory rate-limiter implemented using the leaky bucket algorithm.

    A description of the technique can be found here (https://en.wikipedia.org/wiki/Leaky_bucket).
    Instead of a leaking bucket metaphor, this implementation uses a pile of arbitrary tokens.
    These tokens replenish (instead of leak) at `rate` tokens per second up to a maximum.
    Tokens can be spent to process requests.

    Args:
    per_minute_rate (float): The rate at which tokens replenish.

    starting_tokens (float): The number of tokens the rate limiter starts with.

    max_tokens (float): The maximum number of tokens this rate limiter can hold. Tokens will not
    replenish past this value.

    rate_multiplier (float, Optional): A multiplier used to adjust the rate limit applied by this
    object. For example, a rate_multiplier of 0.8 can be used to ensure that all actions
    controlled by this rate limiter will never exceed 0.8 times the originally specified rate.
    """

    def __init__(
        self,
        per_second_rate: Numeric,
        starting_tokens: Numeric,
        max_tokens: Numeric,
        rate_multiplier: Numeric = 1,
    ):
        self.rate_multiplier = rate_multiplier
        self.rate = per_second_rate * self.rate_multiplier
        self.tokens = starting_tokens
        self.max_tokens = max_tokens
        self.created = time.time()
        self.last_checked = self.created
        self.total_tokens: Numeric = 0

    def update_limit(self, per_second_rate: Numeric, max_tokens: Numeric) -> None:
        new_rate = per_second_rate * self.rate_multiplier
        if self.rate != new_rate:
            self.rate = new_rate
            self.tokens = 0  # reset tokens as conservatively as possible
            self.max_tokens = max_tokens
            self.last_checked = time.time()

    def available_tokens(self) -> float:
        time_since_last_checked = time.time() - self.last_checked
        return min(self.max_tokens, self.rate * time_since_last_checked + self.tokens)

    def spend_tokens_if_available(self, token_cost: Numeric) -> None:
        if token_cost > self.available_tokens():
            raise UnavailableTokensError
        now = time.time()
        current_tokens = min(self.max_tokens, self.tokens + (now - self.last_checked) * self.rate)
        self.tokens = current_tokens - token_cost
        self.last_checked = now
        self.total_tokens += token_cost

    def spend_tokens(self, token_cost: Numeric) -> None:
        self.tokens -= token_cost
        self.total_tokens += token_cost

    def wait_for_then_spend_available_tokens(
        self, token_cost: Numeric, max_wait_time: Numeric = 300
    ) -> None:
        start = time.time()
        while (time.time() - start) < max_wait_time:
            try:
                self.spend_tokens_if_available(token_cost)
                break
            except UnavailableTokensError:
                time.sleep(1 / self.rate)
                continue

    async def async_wait_for_then_spend_available_tokens(
        self, token_cost: Numeric, max_wait_time: Numeric = 300
    ) -> None:
        start = time.time()
        while (time.time() - start) < max_wait_time:
            try:
                self.spend_tokens_if_available(token_cost)
                break
            except UnavailableTokensError:
                await asyncio.sleep(1 / self.rate)
                continue

    def effective_rate(self) -> Numeric:
        return self.total_tokens / (time.time() - self.created)


class LimitStore:
    """
    A singleton store for collections of rate limits grouped by service key.

    LimitStore is a singleton because all calls to a single endpoint should share the same rate
    limits. Rate limiter implementations can use a LimitStore instance to manage rate limits for
    a specific endpoint indexed by a key. The LimitStore singleton will ensure that rate limits
    are correctly shared across all calls to the same endpoint.

    This implementation is not threadsafe, but is async-safe.
    """

    _singleton = None

    def __new__(cls) -> "LimitStore":
        if not cls._singleton:
            cls._singleton = super().__new__(cls)
            cls._singleton._rate_limits = defaultdict(dict)
        return cls._singleton

    _rate_limits: Dict[str, Dict[str, TokenRateLimiter]]

    def set_rate_limit(
        self,
        key: str,
        limit_type: str,
        per_minute_rate_limit: Numeric,
        enforcement_window_minutes: Optional[int] = None,
    ) -> None:
        # default to 1 minute enforcement window
        enforcement_window_minutes = (
            enforcement_window_minutes if enforcement_window_minutes is not None else 1
        )
        per_second_rate_limit = round(per_minute_rate_limit / 60, 3)
        max_tokens = per_minute_rate_limit * enforcement_window_minutes
        if limits := self._rate_limits[key]:
            if limit := limits.get(limit_type):
                limit.update_limit(per_second_rate_limit, max_tokens)
                return
        limits[limit_type] = TokenRateLimiter(
            per_second_rate_limit,
            0,
            max_tokens,
        )

    def get_rate_limits(self, key: str) -> Dict[str, TokenRateLimiter]:
        return self._rate_limits[key]

    def wait_for_rate_limits(self, key: str, rate_limit_costs: Dict[str, Numeric]) -> None:
        rate_limits = self._rate_limits[key]
        for limit_type, cost in rate_limit_costs.items():
            if limit := rate_limits.get(limit_type):
                limit.wait_for_then_spend_available_tokens(cost)

    async def async_wait_for_rate_limits(
        self, key: str, rate_limit_costs: Dict[str, Numeric]
    ) -> None:
        rate_limits = self._rate_limits[key]
        for limit_type, cost in rate_limit_costs.items():
            if limit := rate_limits.get(limit_type):
                await limit.async_wait_for_then_spend_available_tokens(cost)

    def spend_rate_limits(self, key: str, rate_limit_costs: Dict[str, Numeric]) -> None:
        rate_limits = self._rate_limits[key]
        for limit_type, cost in rate_limit_costs.items():
            if limit := rate_limits.get(limit_type):
                limit.spend_tokens(cost)


class OpenAIRateLimiter:
    def __init__(self) -> None:
        self._store = LimitStore()

    def key(self, model_name: str) -> str:
        return f"openai:{model_name}"

    def set_rate_limits(
        self, model_name: str, request_rate_limit: Numeric, token_rate_limit: Numeric
    ) -> None:
        self._store.set_rate_limit(self.key(model_name), "requests", request_rate_limit)
        self._store.set_rate_limit(self.key(model_name), "tokens", token_rate_limit)

    def limit(
        self, model_name: str, token_cost: Numeric
    ) -> Callable[[Callable[ParameterSpec, GenericType]], Callable[ParameterSpec, GenericType]]:
        def rate_limit_decorator(
            fn: Callable[ParameterSpec, GenericType]
        ) -> Callable[ParameterSpec, GenericType]:
            @wraps(fn)
            def wrapper(*args: Any, **kwargs: Any) -> GenericType:
                self._store.wait_for_rate_limits(
                    self.key(model_name), {"requests": 1, "tokens": token_cost}
                )
                result: GenericType = fn(*args, **kwargs)
                return result

            return wrapper

        return rate_limit_decorator

    def alimit(
        self,
        model_name: str,
        response_cost_fn: Callable[..., Numeric],
    ) -> Callable[[AsyncCallable], AsyncCallable]:
        def rate_limit_decorator(fn: AsyncCallable) -> AsyncCallable:
            @wraps(fn)
            async def wrapper(*args: Any, **kwargs: Any) -> GenericType:
                key = self.key(model_name)
                await self._store.async_wait_for_rate_limits(
                    key,
                    {
                        "requests": 1,
                        "tokens": 0,
                    },  # token costs are 0 up front, infer from the response instead
                )
                result: GenericType = await fn(*args, **kwargs)
                self._store.spend_rate_limits(key, {"tokens": response_cost_fn(result)})
                return result

            return cast(AsyncCallable, wrapper)

        return rate_limit_decorator
