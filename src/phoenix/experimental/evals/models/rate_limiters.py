import asyncio
import time
from functools import wraps
from math import exp
from typing import Any, Callable, Coroutine, Optional, Tuple, Type, TypeVar

from typing_extensions import ParamSpec

from phoenix.exceptions import PhoenixException
from phoenix.utilities.logging import printif

ParameterSpec = ParamSpec("ParameterSpec")
GenericType = TypeVar("GenericType")
AsyncCallable = Callable[ParameterSpec, Coroutine[Any, Any, GenericType]]


class UnavailableTokensError(PhoenixException):
    pass


class AdaptiveTokenBucket:
    """
    An adaptive rate-limiter that adjusts the rate based on the number of rate limit errors.

    This rate limiter does not need to know the exact rate limit. Instead, it starts with a high
    rate and reduces it whenever a rate limit error occurs. The rate is increased slowly over time
    if no further errors occur.

    Args:
    initial_per_second_request_rate (float): The allowed request rate.
    maximum_per_second_request_rate (float): The maximum allowed request rate.
    enforcement_window_minutes (float): The time window over which the rate limit is enforced.
    rate_reduction_factor (float): Multiplier used to reduce the rate limit after an error.
    rate_increase_factor (float): Exponential factor increasing the rate limit over time.
    cooldown_seconds (float): The minimum time before allowing the rate limit to decrease again.
    """

    def __init__(
        self,
        initial_per_second_request_rate: float,
        maximum_per_second_request_rate: float = 1000,
        minimum_per_second_request_rate: float = 0.1,
        enforcement_window_minutes: float = 1,
        rate_reduction_factor: float = 0.5,
        rate_increase_factor: float = 0.01,
        cooldown_seconds: float = 5,
    ):
        now = time.time()
        self._initial_rate = initial_per_second_request_rate
        self.rate = initial_per_second_request_rate
        self.maximum_rate = maximum_per_second_request_rate
        self.minimum_rate = minimum_per_second_request_rate
        self.rate_reduction_factor = rate_reduction_factor
        self.enforcement_window = enforcement_window_minutes * 60
        self.rate_increase_factor = rate_increase_factor
        self.cooldown = cooldown_seconds
        self.last_rate_update = now
        self.last_checked = now
        self.last_error = now - self.cooldown
        self.tokens = 0.0

    def increase_rate(self) -> None:
        time_since_last_update = time.time() - self.last_rate_update
        if time_since_last_update > self.enforcement_window:
            self.rate = self._initial_rate
        else:
            self.rate *= exp(self.rate_increase_factor * time_since_last_update)
            self.rate = min(self.rate, self.maximum_rate)
        self.last_rate_update = time.time()

    def on_rate_limit_error(self, request_start_time: float, verbose: bool = False) -> None:
        now = time.time()
        if request_start_time < (self.last_error + self.cooldown):
            # do not reduce the rate for concurrent requests
            return

        original_rate = self.rate

        self.rate = original_rate * self.rate_reduction_factor
        printif(
            verbose, f"Reducing rate from {original_rate} to {self.rate} after rate limit error"
        )

        self.rate = max(self.rate, self.minimum_rate)

        # reset request tokens on a rate limit error
        self.tokens = 0
        self.last_checked = now
        self.last_rate_update = now
        self.last_error = now
        time.sleep(self.cooldown)  # block for a bit to let the rate limit reset

    def max_tokens(self) -> float:
        return self.rate * self.enforcement_window

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
                self.increase_rate()
                self.make_request_if_ready()
                break
            except UnavailableTokensError:
                time.sleep(0.1 / self.rate)
                continue

    async def async_wait_until_ready(
        self,
        max_wait_time: float = 10,  # defeat the token bucket rate limiter at low rates (<.1 req/s)
    ) -> None:
        start = time.time()
        while (time.time() - start) < max_wait_time:
            try:
                self.increase_rate()
                self.make_request_if_ready()
                break
            except UnavailableTokensError:
                await asyncio.sleep(0.1 / self.rate)
                continue


class RateLimitError(PhoenixException):
    ...


class RateLimiter:
    def __init__(
        self,
        rate_limit_error: Optional[Type[BaseException]] = None,
        max_rate_limit_retries: int = 3,
        initial_per_second_request_rate: float = 1,
        maximum_per_second_request_rate: float = 50,
        enforcement_window_minutes: float = 1,
        rate_reduction_factor: float = 0.5,
        rate_increase_factor: float = 0.01,
        cooldown_seconds: float = 5,
        verbose: bool = False,
    ) -> None:
        self._rate_limit_error: Tuple[Type[BaseException], ...]
        self._rate_limit_error = (rate_limit_error,) if rate_limit_error is not None else tuple()

        self._max_rate_limit_retries = max_rate_limit_retries
        self._throttler = AdaptiveTokenBucket(
            initial_per_second_request_rate=initial_per_second_request_rate,
            maximum_per_second_request_rate=maximum_per_second_request_rate,
            enforcement_window_minutes=enforcement_window_minutes,
            rate_reduction_factor=rate_reduction_factor,
            rate_increase_factor=rate_increase_factor,
            cooldown_seconds=cooldown_seconds,
        )
        self._rate_limit_handling: Optional[asyncio.Event] = None
        self._rate_limit_handling_lock: Optional[asyncio.Lock] = None
        self._current_loop: Optional[asyncio.AbstractEventLoop] = None
        self._verbose = verbose

    def limit(
        self, fn: Callable[ParameterSpec, GenericType]
    ) -> Callable[ParameterSpec, GenericType]:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> GenericType:
            try:
                self._throttler.wait_until_ready()
                request_start_time = time.time()
                return fn(*args, **kwargs)
            except self._rate_limit_error:
                self._throttler.on_rate_limit_error(request_start_time, verbose=self._verbose)
                for _attempt in range(self._max_rate_limit_retries):
                    try:
                        request_start_time = time.time()
                        self._throttler.wait_until_ready()
                        return fn(*args, **kwargs)
                    except self._rate_limit_error:
                        self._throttler.on_rate_limit_error(
                            request_start_time, verbose=self._verbose
                        )
                        continue
            raise RateLimitError(f"Exceeded max ({self._max_rate_limit_retries}) retries")

        return wrapper

    def _initialize_async_primitives(self) -> None:
        """
        Lazily initialize async primitives to ensure they are created in the correct event loop.
        """

        loop = asyncio.get_running_loop()
        if loop is not self._current_loop:
            self._current_loop = loop
            self._rate_limit_handling = asyncio.Event()
            self._rate_limit_handling.set()
            self._rate_limit_handling_lock = asyncio.Lock()

    def alimit(
        self, fn: AsyncCallable[ParameterSpec, GenericType]
    ) -> AsyncCallable[ParameterSpec, GenericType]:
        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> GenericType:
            self._initialize_async_primitives()
            assert self._rate_limit_handling_lock is not None and isinstance(
                self._rate_limit_handling_lock, asyncio.Lock
            )
            assert self._rate_limit_handling is not None and isinstance(
                self._rate_limit_handling, asyncio.Event
            )
            try:
                try:
                    await asyncio.wait_for(self._rate_limit_handling.wait(), 120)
                except asyncio.TimeoutError:
                    self._rate_limit_handling.set()  # Set the event as a failsafe
                await self._throttler.async_wait_until_ready()
                request_start_time = time.time()
                return await fn(*args, **kwargs)
            except self._rate_limit_error:
                async with self._rate_limit_handling_lock:
                    self._rate_limit_handling.clear()  # prevent new requests from starting
                    self._throttler.on_rate_limit_error(request_start_time, verbose=self._verbose)
                    try:
                        for _attempt in range(self._max_rate_limit_retries):
                            try:
                                request_start_time = time.time()
                                await self._throttler.async_wait_until_ready()
                                return await fn(*args, **kwargs)
                            except self._rate_limit_error:
                                self._throttler.on_rate_limit_error(
                                    request_start_time, verbose=self._verbose
                                )
                                continue
                    finally:
                        self._rate_limit_handling.set()  # allow new requests to start
            raise RateLimitError(f"Exceeded max ({self._max_rate_limit_retries}) retries")

        return wrapper
