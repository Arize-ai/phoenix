import re
import time
from collections import defaultdict
from collections.abc import Callable, Coroutine
from functools import partial
from typing import (
    Any,
    Optional,
    Pattern,  # import from re module when we drop support for 3.8
    Union,
)

from fastapi import HTTPException, Request

from phoenix.config import get_env_enable_prometheus
from phoenix.exceptions import PhoenixException


class UnavailableTokensError(PhoenixException):
    pass


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
        bucket: Optional[TokenBucket] = None
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
    rate_limiter: ServerRateLimiter, paths: Optional[list[Union[str, Pattern[str]]]] = None
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


def path_match(path: str, match_pattern: Union[str, Pattern[str]]) -> bool:
    if isinstance(match_pattern, re.Pattern):
        return bool(match_pattern.match(path))
    return path == match_pattern
