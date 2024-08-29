import time
from contextlib import contextmanager
from typing import Optional
from unittest import mock

import pytest

from phoenix.server.rate_limiters import ServerRateLimiter, TokenBucket, UnavailableTokensError


@contextmanager
def freeze_time(frozen_time: Optional[float] = None):
    frozen_time = time.time() if frozen_time is None else frozen_time

    with mock.patch("time.time") as mock_time:
        mock_time.return_value = frozen_time
        yield mock_time


@contextmanager
def warp_time(start: Optional[float]):
    sleeps = [0]
    current_time = start
    start = time.time() if start is None else start

    def instant_sleep(time):
        nonlocal sleeps
        sleeps.append(time)

    def time_warp():
        try:
            nonlocal current_time
            nonlocal sleeps
            current_time += sleeps.pop()
            return current_time
        except IndexError:
            return current_time

    with mock.patch("time.time") as mock_time:
        with mock.patch("time.sleep") as mock_sleep:
            mock_sleep.side_effect = instant_sleep
            mock_time.side_effect = time_warp
            yield


def test_token_bucket_gains_tokens_over_time():
    start = time.time()

    with freeze_time(start):
        bucket = TokenBucket(per_second_request_rate=1, enforcement_window_seconds=30)
        bucket.tokens = 0  # start at 0

    with freeze_time(start + 5):
        assert bucket.available_requests() == 5

    with freeze_time(start + 10):
        assert bucket.available_requests() == 10


def test_token_bucket_can_max_out_on_requests():
    start = time.time()

    with freeze_time(start):
        bucket = TokenBucket(per_second_request_rate=1, enforcement_window_seconds=120)
        bucket.tokens = 0  # start at 0

    with freeze_time(start + 30):
        assert bucket.available_requests() == 30

    with freeze_time(start + 120):
        assert bucket.available_requests() == 120

    with freeze_time(start + 130):
        assert bucket.available_requests() == 120  # should max out at 120


def test_token_bucket_spends_tokens():
    start = time.time()

    with freeze_time(start):
        bucket = TokenBucket(per_second_request_rate=1, enforcement_window_seconds=10)
        bucket.tokens = 0  # start at 0

    with freeze_time(start + 3):
        assert bucket.available_requests() == 3
        bucket.make_request_if_ready()
        assert bucket.available_requests() == 2


def test_token_bucket_cannot_spend_unavailable_tokens():
    start = time.time()

    with freeze_time(start):
        bucket = TokenBucket(per_second_request_rate=1, enforcement_window_seconds=2)
        bucket.tokens = 0  # start at 0

    with freeze_time(start + 1):
        assert bucket.available_requests() == 1
        bucket.make_request_if_ready()  # should spend one token
        with pytest.raises(UnavailableTokensError):
            bucket.make_request_if_ready()  # should raise since no tokens left


def test_rate_limiter_cleans_up_old_partitions():
    start = time.time()

    with warp_time(start):
        limiter = ServerRateLimiter(
            per_second_rate_limit=1,
            enforcement_window_seconds=100,
            partition_seconds=10,
            active_partitions=2,
        )
        limiter.make_request("test_key_1")
        limiter.make_request("test_key_2")
        limiter.make_request("test_key_3")
        limiter.make_request("test_key_4")
        partition_sizes = [len(partition) for partition in limiter.cache_partitions]
        assert sum(partition_sizes) == 4

    with freeze_time(start + 10):
        # after 10 seconds, the cache rolls over to a second active partition
        limiter.make_request("test_key_4")  # moves test_key_4 to current partition
        limiter.make_request("test_key_5")  # creates test_key_5 in current partition
        partition_sizes = [len(partition) for partition in limiter.cache_partitions]
        assert sum(partition_sizes) == 5
        assert 2 in partition_sizes  # two rate limiters in current cache partition
        assert 3 in partition_sizes  # three rate limiters remaining in original partition
        assert 0 in partition_sizes  # overflow partition is empty

    with freeze_time(start + 10 + 21):
        limiter.make_request("fresh_key")  # After 21 seconds, all partitions should be reset
        assert sum(len(partition) for partition in limiter.cache_partitions) == 1
