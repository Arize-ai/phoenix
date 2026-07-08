import asyncio
import re
import time
from collections import defaultdict
from collections.abc import Callable, Coroutine
from functools import partial, wraps
from math import exp
from typing import Any, Iterable, Optional, Tuple, Type, TypeVar

from fastapi import HTTPException, Request
from typing_extensions import ParamSpec

from phoenix.config import get_env_enable_prometheus
from phoenix.exceptions import PhoenixException

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
        maximum_per_second_request_rate: Optional[float] = None,
        minimum_per_second_request_rate: float = 0.1,
        enforcement_window_minutes: float = 1,
        rate_reduction_factor: float = 0.5,
        rate_increase_factor: float = 0.01,
        cooldown_seconds: float = 5,
    ):
        self._initial_rate = initial_per_second_request_rate
        self.rate_reduction_factor = rate_reduction_factor
        self.enforcement_window = enforcement_window_minutes * 60
        self.rate_increase_factor = rate_increase_factor
        self.rate = initial_per_second_request_rate
        self.minimum_rate = minimum_per_second_request_rate

        if maximum_per_second_request_rate is None:
            # if unset, do not allow the maximum rate to exceed 3 consecutive rate reductions
            # assuming the initial rate is the advertised API rate limit

            maximum_rate_multiple = (1 / rate_reduction_factor) ** 3
            maximum_per_second_request_rate = (
                initial_per_second_request_rate * maximum_rate_multiple
            )

        maximum_per_second_request_rate = float(maximum_per_second_request_rate)
        assert isinstance(maximum_per_second_request_rate, float)
        self.maximum_rate = maximum_per_second_request_rate

        self.cooldown = cooldown_seconds

        now = time.time()
        self.last_rate_update = now
        self.last_checked = now
        self.last_error = now - self.cooldown
        self.tokens = 1.0

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
        if verbose:
            print(f"Throttling from {original_rate} RPS to {self.rate} RPS after rate limit error")

        self.rate = max(self.rate, self.minimum_rate)

        # reset request tokens on a rate limit error
        self.tokens = 0
        self.last_checked = now
        self.last_rate_update = now
        self.last_error = now
        time.sleep(self.cooldown)  # block for a bit to let the rate limit reset

    async def async_on_rate_limit_error(
        self, request_start_time: float, verbose: bool = False
    ) -> None:
        now = time.time()
        if request_start_time < (self.last_error + self.cooldown):
            # do not reduce the rate for concurrent requests
            return

        original_rate = self.rate

        self.rate = original_rate * self.rate_reduction_factor
        if verbose:
            print(f"Throttling from {original_rate} RPS to {self.rate} RPS after rate limit error")

        self.rate = max(self.rate, self.minimum_rate)

        # reset request tokens on a rate limit error
        self.tokens = 0
        self.last_checked = now
        self.last_rate_update = now
        self.last_error = now
        await asyncio.sleep(self.cooldown)  # non-blocking sleep for async path

    def max_tokens(self) -> float:
        return self.rate * self.enforcement_window

    def available_requests(self) -> float:
        now = time.time()
        time_since_last_checked = now - self.last_checked
        self.tokens = min(self.max_tokens(), self.rate * time_since_last_checked + self.tokens)
        self.last_checked = now
        return self.tokens

    def make_request_if_ready(self) -> None:
        if self.available_requests() < 1:
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
    def __init__(
        self,
        message: str = "Exceeded rate limit retries",
        *,
        current_rate_tokens_per_sec: Optional[float] = None,
        initial_rate_tokens_per_sec: Optional[float] = None,
        enforcement_window_seconds: Optional[float] = None,
    ) -> None:
        super().__init__(message)
        self.current_rate_tokens_per_sec = current_rate_tokens_per_sec
        self.initial_rate_tokens_per_sec = initial_rate_tokens_per_sec
        self.enforcement_window_seconds = enforcement_window_seconds


class RateLimiter:
    def __init__(
        self,
        rate_limit_error: Optional[Type[BaseException]] = None,
        max_rate_limit_retries: int = 0,
        initial_per_second_request_rate: float = 5.0,
        maximum_per_second_request_rate: Optional[float] = None,
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
            request_start_time = time.time()  # fallback in case of early exception
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
            raise RateLimitError(
                f"Rate limited: throttling requests to {self._throttler.rate} RPS",
                current_rate_tokens_per_sec=self._throttler.rate,
                initial_rate_tokens_per_sec=self._throttler._initial_rate,
                enforcement_window_seconds=self._throttler.enforcement_window,
            )

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
            request_start_time = time.time()  # fallback in case of early exception
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
                    await self._throttler.async_on_rate_limit_error(
                        request_start_time, verbose=self._verbose
                    )
                    try:
                        for _attempt in range(self._max_rate_limit_retries):
                            try:
                                request_start_time = time.time()
                                await self._throttler.async_wait_until_ready()
                                return await fn(*args, **kwargs)
                            except self._rate_limit_error:
                                await self._throttler.async_on_rate_limit_error(
                                    request_start_time, verbose=self._verbose
                                )
                                continue
                    finally:
                        self._rate_limit_handling.set()  # allow new requests to start
            raise RateLimitError(
                f"Rate limited: throttling requests to {self._throttler.rate} RPS",
                current_rate_tokens_per_sec=self._throttler.rate,
                initial_rate_tokens_per_sec=self._throttler._initial_rate,
                enforcement_window_seconds=self._throttler.enforcement_window,
            )

        return wrapper


class TokenBucket:
    """
    An implementation of the token-bucket algorithm for use as a rate limiter.

    Args:
        per_second_request_rate (float): The allowed request rate.
        enforcement_window_minutes (float): The time window over which the rate limit is enforced.
    """

    def __init__(
        self,
        per_second_request_rate: float,
        enforcement_window_seconds: float = 1,
    ):
        self.enforcement_window = enforcement_window_seconds
        self.rate = per_second_request_rate

        now = time.time()
        self.last_checked = now
        self.tokens = self.max_tokens()

    def max_tokens(self) -> float:
        return self.rate * self.enforcement_window

    def available_tokens(self) -> float:
        now = time.time()
        time_since_last_checked = now - self.last_checked
        self.tokens = min(self.max_tokens(), self.rate * time_since_last_checked + self.tokens)
        self.last_checked = now
        return self.tokens

    def make_request_if_ready(self) -> None:
        if self.available_tokens() < 1:
            if get_env_enable_prometheus():
                from phoenix.server.prometheus import RATE_LIMITER_THROTTLES

                RATE_LIMITER_THROTTLES.inc()
            raise UnavailableTokensError
        self.tokens -= 1


class ServerRateLimiter:
    """
    This rate limiter holds a cache of token buckets that enforce rate limits.

    The cache is kept in partitions that rotate every `partition_seconds`. Each user's rate limiter
    can be accessed from all active partitions, the number of active partitions is set with
    `active_partitions`. This guarantees that a user's rate limiter will sit in the cache for at
    least:

        minimum_cache_lifetime = (active_partitions - 1) * partition_seconds

    Every time the cache is accessed, inactive partitions are purged. If enough time has passed,
    the entire cache is purged.
    """

    def __init__(
        self,
        per_second_rate_limit: float = 0.5,
        enforcement_window_seconds: float = 5,
        partition_seconds: float = 60,
        active_partitions: int = 2,
    ):
        self.bucket_factory = partial(
            TokenBucket,
            per_second_request_rate=per_second_rate_limit,
            enforcement_window_seconds=enforcement_window_seconds,
        )
        self.partition_seconds = partition_seconds
        self.active_partitions = active_partitions
        self.num_partitions = active_partitions + 2  # two overflow partitions to avoid edge cases
        self._reset_rate_limiters()
        self._last_cleanup_time = time.time()

    def _reset_rate_limiters(self) -> None:
        self.cache_partitions: list[defaultdict[Any, TokenBucket]] = [
            defaultdict(self.bucket_factory) for _ in range(self.num_partitions)
        ]

    def _current_partition_index(self, timestamp: float) -> int:
        return (
            int(timestamp // self.partition_seconds) % self.num_partitions
        )  # a cyclic bucket index

    def _active_partition_indices(self, current_index: int) -> list[int]:
        return [(current_index - ii) % self.num_partitions for ii in range(self.active_partitions)]

    def _inactive_partition_indices(self, current_index: int) -> list[int]:
        active_indices = set(self._active_partition_indices(current_index))
        all_indices = set(range(self.num_partitions))
        return list(all_indices - active_indices)

    def _cleanup_expired_limiters(self, request_time: float) -> None:
        time_since_last_cleanup = request_time - self._last_cleanup_time
        if time_since_last_cleanup >= ((self.num_partitions - 1) * self.partition_seconds):
            # Reset the cache to avoid "looping" back to the same partitions
            self._reset_rate_limiters()
            self._last_cleanup_time = request_time
            return

        current_partition_index = self._current_partition_index(request_time)
        inactive_indices = self._inactive_partition_indices(current_partition_index)
        for ii in inactive_indices:
            self.cache_partitions[ii] = defaultdict(self.bucket_factory)
        self._last_cleanup_time = request_time

    def _fetch_token_bucket(self, key: str, request_time: float) -> TokenBucket:
        current_partition_index = self._current_partition_index(request_time)
        active_indices = self._active_partition_indices(current_partition_index)
        bucket: TokenBucket | None = None
        for ii in active_indices:
            partition = self.cache_partitions[ii]
            if key in partition:
                bucket = partition.pop(key)
                break

        current_partition = self.cache_partitions[current_partition_index]
        if key not in current_partition and bucket is not None:
            current_partition[key] = bucket
        return current_partition[key]

    def make_request(self, key: str) -> None:
        request_time = time.time()
        self._cleanup_expired_limiters(request_time)
        rate_limiter = self._fetch_token_bucket(key, request_time)
        rate_limiter.make_request_if_ready()
        if get_env_enable_prometheus():
            from phoenix.server.prometheus import RATE_LIMITER_CACHE_SIZE

            RATE_LIMITER_CACHE_SIZE.set(sum(len(partition) for partition in self.cache_partitions))


def fastapi_ip_rate_limiter(
    rate_limiter: ServerRateLimiter, paths: Iterable[str | re.Pattern[str]] | None = None
) -> Callable[[Request], Coroutine[Any, Any, Request]]:
    async def dependency(request: Request) -> Request:
        if paths is None or any(path_match(request.url.path, path) for path in paths):
            client = request.client
            if client:  # bypasses rate limiter if no client
                client_ip = client.host
                try:
                    rate_limiter.make_request(client_ip)
                except UnavailableTokensError:
                    raise HTTPException(status_code=429, detail="Too Many Requests")
        return request

    return dependency


def fastapi_route_rate_limiter(
    rate_limiter: ServerRateLimiter,
) -> Callable[[Request], Coroutine[Any, Any, Request]]:
    async def dependency(request: Request) -> Request:
        try:
            rate_limiter.make_request(request.url.path)
        except UnavailableTokensError:
            raise HTTPException(status_code=429, detail="Too Many Requests")
        return request

    return dependency


def path_match(path: str, match_pattern: str | re.Pattern[str]) -> bool:
    if isinstance(match_pattern, re.Pattern):
        return bool(match_pattern.match(path))
    return path == match_pattern


class BruteForceLoginLimitExceeded(PhoenixException):
    pass


class _LoginAttemptRecord:
    __slots__ = ("failed_count", "blocked_until")

    def __init__(self) -> None:
        self.failed_count: int = 0
        self.blocked_until: float = 0.0


class BruteForceLoginRateLimiter:
    """
    In-memory rate limiter that tracks failed login attempts per user key (email/username).

    Uses partition-based memory management (same pattern as ServerRateLimiter) to automatically
    clean up stale records. When a user exceeds `max_attempts` failed logins within
    `window_seconds`, further login attempts are blocked for `window_seconds`.

    A successful login clears all failure records for that key.
    """

    def __init__(
        self,
        max_attempts: int,
        window_seconds: float = 300.0,
        partition_seconds: float = 300.0,
        active_partitions: int = 4,
    ) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.partition_seconds = partition_seconds
        self.active_partitions = active_partitions
        self.num_partitions = active_partitions + 2
        self._reset_partitions()
        self._last_cleanup_time = time.time()

    def _reset_partitions(self) -> None:
        self.cache_partitions: list[dict[str, _LoginAttemptRecord]] = [
            {} for _ in range(self.num_partitions)
        ]

    def _current_partition_index(self, timestamp: float) -> int:
        return int(timestamp // self.partition_seconds) % self.num_partitions

    def _active_partition_indices(self, current_index: int) -> list[int]:
        return [(current_index - ii) % self.num_partitions for ii in range(self.active_partitions)]

    def _inactive_partition_indices(self, current_index: int) -> list[int]:
        active_indices = set(self._active_partition_indices(current_index))
        return [ii for ii in range(self.num_partitions) if ii not in active_indices]

    def _cleanup_expired(self, request_time: float) -> None:
        time_since_last_cleanup = request_time - self._last_cleanup_time
        if time_since_last_cleanup >= ((self.num_partitions - 1) * self.partition_seconds):
            self._reset_partitions()
            self._last_cleanup_time = request_time
            return
        current_index = self._current_partition_index(request_time)
        for ii in self._inactive_partition_indices(current_index):
            self.cache_partitions[ii] = {}
        self._last_cleanup_time = request_time

    def _fetch_record(self, key: str, request_time: float) -> _LoginAttemptRecord:
        current_index = self._current_partition_index(request_time)
        active_indices = self._active_partition_indices(current_index)
        record: _LoginAttemptRecord | None = None
        for ii in active_indices:
            partition = self.cache_partitions[ii]
            if key in partition:
                record = partition.pop(key)
                break
        current_partition = self.cache_partitions[current_index]
        if key not in current_partition:
            if record is not None:
                current_partition[key] = record
            else:
                current_partition[key] = _LoginAttemptRecord()
        return current_partition[key]

    def check(self, key: str) -> None:
        now = time.time()
        self._cleanup_expired(now)
        key = key.strip().lower()
        record = self._fetch_record(key, now)
        if record.blocked_until > now:
            raise BruteForceLoginLimitExceeded

    def record_failure(self, key: str) -> None:
        now = time.time()
        self._cleanup_expired(now)
        key = key.strip().lower()
        record = self._fetch_record(key, now)
        if record.blocked_until and record.blocked_until <= now:
            record.failed_count = 0
            record.blocked_until = 0.0
        record.failed_count += 1
        if record.failed_count >= self.max_attempts:
            record.blocked_until = now + self.window_seconds

    def record_success(self, key: str) -> None:
        now = time.time()
        self._cleanup_expired(now)
        key = key.strip().lower()
        for partition in self.cache_partitions:
            partition.pop(key, None)
