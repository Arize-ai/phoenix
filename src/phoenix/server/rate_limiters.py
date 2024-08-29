import time
from collections import defaultdict
from functools import partial
from typing import List, Optional

from fastapi import HTTPException
from strawberry.extensions import SchemaExtension
from strawberry.types import Info

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


class SingletonMeta(type):
    _instances = dict()

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(SingletonMeta, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


class ServerRateLimiter(metaclass=SingletonMeta):
    """
    This rate limiter holds a cache of token buckets that enforce rate limits.

    The cache is kept in partitions that rotate every `partition_seconds`. Each user's rate limiter
    can be accessed from all active partitions, set with `active_partitions`. This guarantees that
    a user's rate limiter will sit in the cache for at least:

        minimum_cache_duration = (active_partitions - 1) * partition_seconds

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
        self.expiration_seconds = partition_seconds
        self.active_partitions = active_partitions
        self.num_partitions = active_partitions + 1
        self._reset_rate_limiters()
        self._last_cleanup_time = self._current_partition_start(time.time())

    def _reset_rate_limiters(self) -> None:
        self.cache_partitions = [
            defaultdict(self.bucket_factory) for _ in range(self.num_partitions)
        ]

    def _current_partition_index(self, timestamp) -> int:
        return (
            int(timestamp // self.expiration_seconds) % self.num_partitions
        )  # a cyclic bucket index

    def _active_partition_indices(self, current_index: int) -> List[int]:
        return [(current_index - ii) % self.num_partitions for ii in range(self.active_partitions)]

    def _inactive_partition_indices(self, current_index: int) -> List[int]:
        active_indices = set(self._active_partition_indices(current_index))
        all_indices = set(range(self.num_partitions))
        return list(all_indices - active_indices)

    def _cleanup_expired_limiters(self, request_time: float) -> None:
        if time.time() - self._last_cleanup_time >= (
            self.active_partitions * self.expiration_seconds
        ):
            self._reset_rate_limiters()
            self._last_cleanup_time = self._current_partition_start(request_time)
            return

        current_partition_index = self._current_partition_index(request_time)
        inactive_indices = self._inactive_partition_indices(current_partition_index)
        for ii in inactive_indices:
            self.cache_partitions[ii] = defaultdict(self.bucket_factory)
        self._last_cleanup_time = self._current_partition_start(request_time)

    def _current_partition_start(self, request_time: float) -> float:
        partition_start_time = (request_time // self.expiration_seconds) * self.expiration_seconds
        return partition_start_time

    def _fetch_token_bucket(self, key: str, request_time: float) -> TokenBucket:
        current_partition_index = self._current_partition_index(request_time)
        active_indices = self._active_partition_indices(current_partition_index)
        bucket: Optional[TokenBucket] = None
        for ii in active_indices:
            partition = self.cache_partitions[ii]
            if key in partition:
                bucket = partition[key]
                del partition[key]
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


class StrawberryRateLimiterExtension(SchemaExtension):
    def __init__(self):
        self.rate_limiter = ServerRateLimiter()

    async def resolve(self, _next, root, info: Info, *args, **kwargs):
        if info.field_name == "login" and info.parent_type.name == "Mutation":
            client_ip = info.context["request"].client.host
            try:
                self.rate_limiter.make_request(client_ip)
            except UnavailableTokensError:
                raise HTTPException(status_code=429, detail="Rate limit exceeded")
            return await _next(root, info, *args, **kwargs)
