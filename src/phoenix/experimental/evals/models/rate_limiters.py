import asyncio
import time
from functools import wraps
from typing import Any, Awaitable, Callable, TypeVar, cast

from typing_extensions import ParamSpec

ParameterSpec = ParamSpec("ParameterSpec")
GenericType = TypeVar("GenericType")
AsyncCallable = TypeVar("AsyncCallable", bound=Callable[..., Awaitable[Any]])


class UnavailableTokensError(Exception):
    pass


class AdaptiveTokenBucket:
    """
    An adaptive rate-limiter that adjusts the rate based on the number of rate limit errors.

    This rate limiter does not need to know the exact rate limit. Instead, it starts with a high
    rate and reduces it whenever a rate limit error occurs. The rate is increased slowly over time
    if no further errors occur.

    Args:
    initial_per_second_request_rate (float): The allowed request rate.
    enforcement_window_minutes (float): The time window over which the rate limit is enforced.
    rate_reduction_factor (float): Factor reducing the rate limit after a rate limit error.
    rate_increase_factor (float): Factor increasing the rate limit over time.
    """

    def __init__(
        self,
        initial_per_second_request_rate: float,
        enforcement_window_minutes: float,
        rate_reduction_factor: float = 0.5,
        rate_increase_factor: float = 1.01,
    ):
        now = time.time()
        self.rate = initial_per_second_request_rate
        self.rate_reduction_factor = rate_reduction_factor
        self.enforcement_window = enforcement_window_minutes * 60
        self.rate_increase_factor = rate_increase_factor
        self.last_rate_update = now
        self.last_checked = now
        self.tokens = 0

    def max_tokens(self):
        return self.rate * self.enforcement_window

    def on_rate_limit_error(self) -> None:
        self.rate *= self.rate_reduction_factor
        self.rate = max(self.rate, 1 / self.enforcement_window)
        self.last_rate_update = time.time()

    def available_requests(self) -> float:
        now = time.time()
        time_since_last_checked = time.time() - self.last_checked
        self.tokens = min(self.max_tokens(), self.rate * time_since_last_checked + self.tokens)
        self.last_checked = now
        return self.tokens

    def make_request_if_ready(self) -> None:
        if self.available_requests() <= 1:
            raise UnavailableTokensError
        self.tokens -= 1

    def wait_until_ready(
        self,
        max_wait_time: float = 300,
    ) -> None:
        start = time.time()
        while (time.time() - start) < max_wait_time:
            try:
                time_since_last_error = time.time() - self.last_rate_update
                self.rate *= self.rate_increase_factor**time_since_last_error
                self.make_request_if_ready()
                break
            except UnavailableTokensError:
                time.sleep(1 / self.rate)
                continue

    async def async_wait_until_ready(
        self,
        max_wait_time: float = 300,
    ) -> None:
        start = time.time()
        while (time.time() - start) < max_wait_time:
            try:
                time_since_last_error = time.time() - self.last_rate_update
                self.rate *= self.rate_increase_factor**time_since_last_error
                self.make_request_if_ready()
                break
            except UnavailableTokensError:
                await asyncio.sleep(1 / self.rate)
                continue


class RateLimiter:
    def __init__(
        self,
        rate_limit_error: Exception,
        initial_per_second_request_rate: float = 200,
        enforcement_window_minutes: float = 1,
        rate_reduction_factor: float = 0.5,
        rate_increase_factor: float = 1.01,
    ) -> None:
        self._rate_limit_error = rate_limit_error
        self._rate_limiter = AdaptiveTokenBucket(
            initial_per_second_request_rate=initial_per_second_request_rate,
            enforcement_window_minutes=enforcement_window_minutes,
            rate_reduction_factor=rate_reduction_factor,
            rate_increase_factor=rate_increase_factor,
        )

    def limit(
        self, fn: Callable[ParameterSpec, GenericType]
    ) -> Callable[ParameterSpec, GenericType]:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> GenericType:
            while True:
                try:
                    self._rate_limiter.wait_until_ready()
                    result: GenericType = fn(*args, **kwargs)
                    return result
                except self._rate_limit_error:
                    self._rate_limiter.on_rate_limit_error()
                    continue

        return wrapper

    def alimit(self, fn: AsyncCallable) -> AsyncCallable:
        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> GenericType:
            while True:
                try:
                    await self._rate_limiter.async_wait_until_ready()
                    result: GenericType = await fn(*args, **kwargs)
                    return result
                except self._rate_limit_error:
                    self._rate_limiter.on_rate_limit_error()
                    continue

        return cast(AsyncCallable, wrapper)
