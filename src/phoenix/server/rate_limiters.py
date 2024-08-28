from collections import defaultdict
from functools import partial
from time import time
from typing import List, Optional

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

        now = time()
        self.last_checked = now
        self.tokens = self.max_tokens()

    def max_tokens(self) -> float:
        return self.rate * self.enforcement_window

    def available_requests(self) -> float:
        now = time()
        time_since_last_checked = now - self.last_checked
        self.tokens = min(self.max_tokens(), self.rate * time_since_last_checked + self.tokens)
        self.last_checked = now
        return self.tokens

    def make_request_if_ready(self) -> None:
        if self.available_requests() < 1:
            raise UnavailableTokensError
        self.tokens -= 1


class ServerRateLimiter:
    """
    This rate limiter holds a cache of token buckets that enforce rate limits.

    The cache is stored in partitions that rotate every `partition_seconds`.
    Every time the cache is accessed, inactive partitions are purged. If enough
    time has passed, the entire cache is purged.
    """

    def __init__(
        self,
        per_second_rate_limit: float = 0.5,
        enforcement_window_seconds: float = 5,
        partition_seconds: float = 60,
        active_partitions: int = 3,
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

    def _reset_rate_limiters(self) -> None:
        self.cache_partitions = [
            defaultdict(self.bucket_factory) for _ in range(self.num_partitions)
        ]
        self._last_cleanup_time = time()

    def _bucket_index(self, timestamp) -> int:
        return (
            int(timestamp // self.expiration_seconds) % self.num_partitions
        )  # a cyclic bucket index

    def _active_bucket_indices(self, current_index) -> List[int]:
        return [(current_index - ii) % self.num_partitions for ii in range(self.active_partitions)]
    

    def _inactive_token_bucket_indices(self, current_index) -> List[int]:
        active_indices = set(self._active_bucket_indices(current_index))
        all_indices = set(range(self.num_partitions))
        return list(all_indices - active_indices)

    def _cleanup_expired_limiters(self, request_time: float) -> None:
        if time() - self._last_cleanup_time >= (self.active_partitions * self.expiration_seconds):
            self._reset_rate_limiters()
            return

        current_bucket_index = self._bucket_index(request_time)
        inactive_bucket_indices = self._inactive_bucket_indices(current_bucket_index)
        for ii in inactive_bucket_indices:
            self.cache_partitions[ii] = defaultdict(self.bucket_factory)
        self._last_cleanup_time = request_time

    def _fetch_token_bucket(self, key: str, request_time: float) -> TokenBucket:
        current_bucket_index = self._bucket_index(request_time)
        active_bucket_indices = self._active_bucket_indices(current_bucket_index)
        bucket: Optional[TokenBucket] = None
        for ii in active_bucket_indices:
            partition = self.cache_partitions[ii]
            if key in partition:
                bucket = partition[key]
                del partition[key]
                break

        current_partition = self.cache_partitions[current_bucket_index]
        if key not in current_partition and bucket is not None:
            current_partition[key] = bucket
        return current_partition[key]

    def make_request(self, key: str) -> None:
        request_time = time()
        self._cleanup_expired_limiters(request_time)
        rate_limiter = self._fetch_token_bucket(key, request_time)
        rate_limiter.make_request_if_ready()


from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rate_limiter: ServerRateLimiter):
        super().__init__(app)
        self.rate_limiter = rate_limiter

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        try:
            self.rate_limiter.make_request(client_ip)
        except UnavailableTokensError:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        response = await call_next(request)
        return response
