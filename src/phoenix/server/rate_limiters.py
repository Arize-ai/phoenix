from collections import defaultdict
from functools import partial
from time import time

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
    def __init__(
        self,
        per_second_rate_limit: float = 0.5,
        enforcement_window_seconds: float = 5,
        expiration_seconds: float = 60,
        num_partitions: int = 2,
    ):
        bucket_factory = partial(
            TokenBucket,
            per_second_request_rate=per_second_rate_limit,
            enforcement_window_seconds=enforcement_window_seconds,
        )
        self.rate_limiters = defaultdict(bucket_factory)
        self.expiration_seconds = expiration_seconds
        self.num_partitions = num_partitions
        self.cache_partitions = [set() for _ in range(self.num_partitions)]
        self._last_cleanup_time = time()

    def _reset_rate_limiters(self) -> None:
        self.rate_limiters = defaultdict(TokenBucket)
        self.cache_partitions = [set() for _ in range(self.num_partitions)]
        self._last_cleanup_time = time()

    def _current_bucket_index(self) -> int:
        return int(time() // self.expiration_seconds) % self.num_partitions  # a cyclic bucket index

    def _cleanup_expired_limiters(self, current_index: int) -> None:
        if time() - self._last_cleanup_time >= (self.num_partitions * self.expiration_seconds):
            self._reset_rate_limiters()
            return

        for ii in range(self.num_partitions):
            if ii != current_index:
                for user_id in self.cache_partitions[ii]:
                    del self.rate_limiters[user_id]
                self.cache_partitions[ii].clear()
        self._last_cleanup_time = time()

    def _update_bucket(self, key: str, current_index: int) -> None:
        for partition in self.cache_partitions:
            if key in partition:
                partition.remove(key)
        self.cache_partitions[current_index].add(key)

    def make_request(self, key: str) -> None:
        current_index = self._current_bucket_index()
        self._cleanup_expired_limiters(current_index)
        self._update_bucket(key, current_index)
        rate_limiter = self.rate_limiters[key]
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
