import asyncio
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from math import exp, isclose
from typing import Optional
from unittest import mock

import pytest

from phoenix.server.rate_limiters import (
    AdaptiveTokenBucket,
    RateLimiter,
    RateLimitError,
    ServerRateLimiter,
    TokenBucket,
    UnavailableTokensError,
)


@contextmanager
def freeze_time(frozen_time: Optional[float] = None) -> Iterator[Callable[[], None]]:
    frozen_time = time.time() if frozen_time is None else frozen_time

    with mock.patch("time.time") as mock_time:
        mock_time.return_value = frozen_time
        yield mock_time


@contextmanager
def async_warp_time(start: float) -> Iterator[None]:
    sleeps: list[float] = [0]
    current_time = start
    start = time.time() if start is None else start

    def instant_sleep(time: float) -> None:
        nonlocal sleeps
        sleeps.append(time)

    def time_warp() -> float:
        try:
            nonlocal current_time
            nonlocal sleeps
            current_time += sleeps.pop()
            return current_time
        except IndexError:
            return current_time

    with mock.patch("time.time") as mock_time:
        with mock.patch("asyncio.sleep") as mock_sleep:
            mock_sleep.side_effect = instant_sleep
            mock_time.side_effect = time_warp
            yield None


@contextmanager
def warp_time(start: float) -> Iterator[None]:
    sleeps: list[float] = [0]
    current_time = start
    start = time.time() if start is None else start

    def instant_sleep(time: float) -> None:
        nonlocal sleeps
        sleeps.append(time)

    def time_warp() -> float:
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
            yield None


def test_token_bucket_gains_tokens_over_time() -> None:
    start = time.time()

    with freeze_time(start):
        bucket = TokenBucket(per_second_request_rate=1, enforcement_window_seconds=30)
        bucket.tokens = 0  # start at 0

    with freeze_time(start + 5):
        assert bucket.available_tokens() == 5

    with freeze_time(start + 10):
        assert bucket.available_tokens() == 10


def test_token_bucket_can_max_out_on_requests() -> None:
    start = time.time()

    with freeze_time(start):
        bucket = TokenBucket(per_second_request_rate=1, enforcement_window_seconds=120)
        bucket.tokens = 0  # start at 0

    with freeze_time(start + 30):
        assert bucket.available_tokens() == 30

    with freeze_time(start + 120):
        assert bucket.available_tokens() == 120

    with freeze_time(start + 130):
        assert bucket.available_tokens() == 120  # should max out at 120


def test_token_bucket_spends_tokens() -> None:
    start = time.time()

    with freeze_time(start):
        bucket = TokenBucket(per_second_request_rate=1, enforcement_window_seconds=10)
        bucket.tokens = 0  # start at 0

    with freeze_time(start + 3):
        assert bucket.available_tokens() == 3
        bucket.make_request_if_ready()
        assert bucket.available_tokens() == 2


def test_token_bucket_cannot_spend_unavailable_tokens() -> None:
    start = time.time()

    with freeze_time(start):
        bucket = TokenBucket(per_second_request_rate=1, enforcement_window_seconds=2)
        bucket.tokens = 0  # start at 0

    with freeze_time(start + 1):
        assert bucket.available_tokens() == 1
        bucket.make_request_if_ready()  # should spend one token
        with pytest.raises(UnavailableTokensError):
            bucket.make_request_if_ready()  # should raise since no tokens left


# --- AdaptiveTokenBucket tests ---


def test_adaptive_token_bucket_gains_tokens_over_time() -> None:
    start = time.time()

    with freeze_time(start):
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=1,
            maximum_per_second_request_rate=1,
            enforcement_window_minutes=1,
            rate_reduction_factor=1,
            rate_increase_factor=0,
            cooldown_seconds=5,
        )

    with freeze_time(start + 5):
        assert isclose(bucket.available_requests(), 6)

    with freeze_time(start + 10):
        assert isclose(bucket.available_requests(), 11)


def test_adaptive_token_bucket_can_max_out_on_requests() -> None:
    start = time.time()

    with freeze_time(start):
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=1,
            maximum_per_second_request_rate=1,
            enforcement_window_minutes=2,
            rate_reduction_factor=1,
            rate_increase_factor=0,
            cooldown_seconds=5,
        )

    with freeze_time(start + 30):
        assert bucket.available_requests() == 31

    with freeze_time(start + 120):
        assert bucket.available_requests() == 120

    with freeze_time(start + 130):
        assert bucket.available_requests() == 120


def test_adaptive_token_bucket_spends_tokens() -> None:
    start = time.time()

    with freeze_time(start):
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=1,
            maximum_per_second_request_rate=1,
            enforcement_window_minutes=1,
            rate_reduction_factor=1,
            rate_increase_factor=0,
            cooldown_seconds=5,
        )

    with freeze_time(start + 3):
        assert bucket.available_requests() == 4  # 1.0 + 3
        bucket.make_request_if_ready()
        assert bucket.available_requests() == 3  # 4 - 1


def test_adaptive_token_bucket_cannot_spend_unavailable_tokens() -> None:
    start = time.time()

    with freeze_time(start):
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=1,
            maximum_per_second_request_rate=1,
            enforcement_window_minutes=2,
            rate_reduction_factor=1,
            rate_increase_factor=0,
            cooldown_seconds=5,
        )
        assert bucket.available_requests() == 1.0
        bucket.make_request_if_ready()
        assert bucket.available_requests() == 0
        with pytest.raises(UnavailableTokensError):
            bucket.make_request_if_ready()


def test_adaptive_token_bucket_can_block_until_tokens_are_available() -> None:
    start = time.time()

    with freeze_time(start):
        rate = 0.5
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=2,
            rate_reduction_factor=1,
            rate_increase_factor=0,
            cooldown_seconds=5,
        )

    with warp_time(start):
        assert bucket.available_requests() == 1.0
        bucket.wait_until_ready()
        sleeps = [s.args[0] for s in time.sleep.call_args_list]  # type: ignore[attr-defined]
        assert sum(sleeps) == 0

        bucket.wait_until_ready()
        sleeps = [s.args[0] for s in time.sleep.call_args_list]  # type: ignore[attr-defined]
        time_cost = 1 / rate
        assert isclose(sum(sleeps), time_cost, rel_tol=0.2)


async def test_adaptive_token_bucket_async_waits_until_tokens_are_available() -> None:
    start = time.time()

    with freeze_time(start):
        rate = 0.5
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=2,
            rate_reduction_factor=1,
            rate_increase_factor=0,
            cooldown_seconds=5,
        )

    with async_warp_time(start):
        assert bucket.available_requests() == 1.0
        await bucket.async_wait_until_ready()
        sleeps = [s.args[0] for s in asyncio.sleep.call_args_list]  # type: ignore[attr-defined]
        assert sum(sleeps) == 0


def test_adaptive_token_bucket_can_accumulate_tokens_before_waiting() -> None:
    start = time.time()

    with freeze_time(start):
        rate = 0.1
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=2,
            rate_reduction_factor=1,
            rate_increase_factor=0,
            cooldown_seconds=5,
        )

    with warp_time(start + 5):
        assert bucket.available_requests() == 1.5, "should have accumulated to 1.5 requests"
        bucket.wait_until_ready()
        sleeps = [s.args[0] for s in time.sleep.call_args_list]  # type: ignore[attr-defined]
        assert sum(sleeps) == 0


async def test_adaptive_token_bucket_can_async_accumulate_tokens_before_waiting() -> None:
    start = time.time()

    with freeze_time(start):
        rate = 0.1
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=2,
            rate_reduction_factor=1,
            rate_increase_factor=0,
            cooldown_seconds=5,
        )

    with async_warp_time(start + 5):
        assert bucket.available_requests() == 1.5, "should have accumulated to 1.5 requests"
        await bucket.async_wait_until_ready()
        sleeps = [s.args[0] for s in asyncio.sleep.call_args_list]  # type: ignore[attr-defined]
        assert sum(sleeps) == 0


def test_adaptive_token_bucket_adaptively_increases_rate_over_time() -> None:
    start = time.time()

    with freeze_time(start):
        rate = 0.1
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=1,
            rate_reduction_factor=1,
            rate_increase_factor=0.01,
            cooldown_seconds=5,
        )

    with warp_time(start + 5):
        assert bucket.available_requests() == 1.5, (
            "should have accumulated to 1.5 requests (1.0 + 0.5)"
        )
        bucket.wait_until_ready()
        sleeps = [s.args[0] for s in time.sleep.call_args_list]  # type: ignore[attr-defined]
        elapsed_time = sum(sleeps) + 5
        assert isclose(bucket.rate, 0.1 * exp(0.01 * elapsed_time))


def test_adaptive_token_bucket_does_not_increase_rate_past_maximum() -> None:
    start = time.time()

    with freeze_time(start):
        rate = 0.1
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=1,
            rate_reduction_factor=1,
            rate_increase_factor=100,
            cooldown_seconds=5,
        )

    with warp_time(start + 5):
        assert bucket.available_requests() == 1.5, (
            "should have accumulated to 1.5 requests (1.0 + 0.5)"
        )
        bucket.wait_until_ready()
        assert isclose(bucket.rate, rate * 2)


def test_adaptive_token_bucket_resets_rate_after_inactivity() -> None:
    start = time.time()

    with freeze_time(start):
        rate = 0.1
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=1,
            rate_reduction_factor=1,
            rate_increase_factor=100,
            cooldown_seconds=5,
        )

    with warp_time(start + 5):
        assert bucket.available_requests() == 1.5, (
            "should have accumulated to 1.5 requests (1.0 + 0.5)"
        )
        bucket.wait_until_ready()
        assert isclose(bucket.rate, rate * 2)

    with warp_time(start + 100):
        bucket.wait_until_ready()
        assert isclose(bucket.rate, rate)


def test_adaptive_token_bucket_decreases_rate_on_error() -> None:
    start = time.time()

    with warp_time(start):
        rate = 100
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=1,
            rate_reduction_factor=0.25,
            rate_increase_factor=0.01,
            cooldown_seconds=5,
        )
        bucket.on_rate_limit_error(request_start_time=time.time())
        assert isclose(bucket.rate, 25)
        assert bucket.tokens == 0
        assert time.time() == start + 5


def test_adaptive_token_bucket_decreases_rate_once_per_cooldown_period() -> None:
    start = time.time()

    with warp_time(start):
        rate = 100
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=1,
            rate_reduction_factor=0.25,
            rate_increase_factor=0.01,
            cooldown_seconds=5,
        )
        bucket.on_rate_limit_error(request_start_time=time.time())
        assert isclose(bucket.rate, 25)

    with warp_time(start + 3):
        bucket.on_rate_limit_error(request_start_time=time.time())
        assert isclose(bucket.rate, 25), "3 seconds is still within the cooldown period"

    with warp_time(start - 6):
        bucket.on_rate_limit_error(request_start_time=time.time())
        assert isclose(bucket.rate, 25), "requests before the rate limited request are ignored"

    with warp_time(start + 6):
        bucket.on_rate_limit_error(request_start_time=time.time())
        assert isclose(bucket.rate, 6.25)


async def test_adaptive_token_bucket_async_on_rate_limit_error_uses_asyncio_sleep() -> None:
    """async_on_rate_limit_error must use asyncio.sleep (not time.sleep) for the cooldown."""
    start = time.time()

    with freeze_time(start):
        rate = 100
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=1,
            rate_reduction_factor=0.25,
            rate_increase_factor=0.01,
            cooldown_seconds=5,
        )

    with async_warp_time(start):
        with mock.patch("time.sleep") as mock_sync_sleep:
            await bucket.async_on_rate_limit_error(request_start_time=time.time())
            # asyncio.sleep was called (via the warp), time.sleep was NOT called
            assert not mock_sync_sleep.called, "async path must not block with time.sleep"

    # Verify rate/token state matches the sync variant
    with freeze_time(start):
        bucket_sync = AdaptiveTokenBucket(
            initial_per_second_request_rate=rate,
            maximum_per_second_request_rate=rate * 2,
            enforcement_window_minutes=1,
            rate_reduction_factor=0.25,
            rate_increase_factor=0.01,
            cooldown_seconds=5,
        )

    with warp_time(start):
        bucket_sync.on_rate_limit_error(request_start_time=time.time())

    assert isclose(bucket.rate, bucket_sync.rate)
    assert bucket.tokens == bucket_sync.tokens


def test_rate_limiter_cleans_up_old_partitions() -> None:
    start = time.time()

    with freeze_time(start):
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

    interval = limiter.partition_seconds
    with freeze_time(start + interval):
        # after a partition interval, the cache rolls over to a second active partition
        limiter.make_request("test_key_4")  # moves test_key_4 to current partition
        limiter.make_request("test_key_5")  # creates test_key_5 in current partition
        partition_sizes = [len(partition) for partition in limiter.cache_partitions]
        assert sum(partition_sizes) == 5
        assert 2 in partition_sizes  # two rate limiters in current cache partition
        assert 3 in partition_sizes  # three rate limiters remaining in original partition

    with freeze_time(start + interval + (limiter.num_partitions * interval)):
        limiter.make_request("fresh_key")  # when "looping" partitions, cache should be reset
        assert sum(len(partition) for partition in limiter.cache_partitions) == 1


def test_rate_limiter_caches_token_buckets() -> None:
    start = time.time()

    with freeze_time(start):
        limiter = ServerRateLimiter(
            per_second_rate_limit=0.5,
            enforcement_window_seconds=20,
            partition_seconds=1,
            active_partitions=2,
        )
        limiter.make_request("test_key")
        limiter.make_request("test_key")
        limiter.make_request("test_key")
        token_bucket = None
        for partition in limiter.cache_partitions:
            if "test_key" in partition:
                token_bucket = partition["test_key"]
                break
        assert token_bucket is not None, "Token bucket for 'test_key' should exist"
        assert token_bucket.tokens == 7

    with freeze_time(start + 1):
        assert token_bucket.available_tokens() == 7.5
        limiter.make_request("test_key")
        assert token_bucket.tokens == 6.5


# --- BruteForceLoginRateLimiter tests ---


def test_brute_force_allows_login_under_threshold() -> None:
    from phoenix.server.rate_limiters import BruteForceLoginRateLimiter

    start = time.time()
    with freeze_time(start):
        limiter = BruteForceLoginRateLimiter(max_attempts=3, window_seconds=300.0)
        # Should not raise for fewer than max_attempts failures
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        limiter.check("user@example.com")  # 2 failures < 3 max, should not raise


def test_brute_force_blocks_after_max_attempts() -> None:
    from phoenix.server.rate_limiters import (
        BruteForceLoginLimitExceeded,
        BruteForceLoginRateLimiter,
    )

    start = time.time()
    with freeze_time(start):
        limiter = BruteForceLoginRateLimiter(max_attempts=3, window_seconds=300.0)
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        with pytest.raises(BruteForceLoginLimitExceeded):
            limiter.check("user@example.com")


def test_brute_force_resets_on_success() -> None:
    from phoenix.server.rate_limiters import BruteForceLoginRateLimiter

    start = time.time()
    with freeze_time(start):
        limiter = BruteForceLoginRateLimiter(max_attempts=3, window_seconds=300.0)
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        limiter.record_success("user@example.com")
        # Counter should be reset; 2 more failures should not trigger block
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        limiter.check("user@example.com")  # should not raise


def test_brute_force_unblocks_after_window() -> None:
    from phoenix.server.rate_limiters import (
        BruteForceLoginLimitExceeded,
        BruteForceLoginRateLimiter,
    )

    start = time.time()
    with freeze_time(start):
        limiter = BruteForceLoginRateLimiter(max_attempts=3, window_seconds=300.0)
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        with pytest.raises(BruteForceLoginLimitExceeded):
            limiter.check("user@example.com")

    # After the window expires, should be allowed again
    with freeze_time(start + 301):
        limiter.check("user@example.com")  # should not raise


def test_brute_force_resets_failed_count_after_lockout_expires() -> None:
    from phoenix.server.rate_limiters import (
        BruteForceLoginLimitExceeded,
        BruteForceLoginRateLimiter,
    )

    start = time.time()
    with freeze_time(start):
        limiter = BruteForceLoginRateLimiter(max_attempts=3, window_seconds=300.0)
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        with pytest.raises(BruteForceLoginLimitExceeded):
            limiter.check("user@example.com")

    # After the window expires, a single failure should NOT re-lock the user
    with freeze_time(start + 301):
        limiter.check("user@example.com")  # should not raise
        limiter.record_failure("user@example.com")  # 1st failure in new window
        limiter.check("user@example.com")  # should not raise (1 < 3)
        limiter.record_failure("user@example.com")  # 2nd failure
        limiter.check("user@example.com")  # should not raise (2 < 3)
        limiter.record_failure("user@example.com")  # 3rd failure — now locked again
        with pytest.raises(BruteForceLoginLimitExceeded):
            limiter.check("user@example.com")


def test_brute_force_normalizes_key() -> None:
    from phoenix.server.rate_limiters import (
        BruteForceLoginLimitExceeded,
        BruteForceLoginRateLimiter,
    )

    start = time.time()
    with freeze_time(start):
        limiter = BruteForceLoginRateLimiter(max_attempts=2, window_seconds=300.0)
        limiter.record_failure("  User@Example.COM  ")
        limiter.record_failure("user@example.com")
        with pytest.raises(BruteForceLoginLimitExceeded):
            limiter.check("USER@EXAMPLE.COM")


def test_brute_force_partition_cleanup() -> None:
    from phoenix.server.rate_limiters import (
        BruteForceLoginLimitExceeded,
        BruteForceLoginRateLimiter,
    )

    start = time.time()
    with freeze_time(start):
        limiter = BruteForceLoginRateLimiter(
            max_attempts=2,
            window_seconds=300.0,
            partition_seconds=100.0,
            active_partitions=2,
        )
        limiter.record_failure("user@example.com")
        limiter.record_failure("user@example.com")
        with pytest.raises(BruteForceLoginLimitExceeded):
            limiter.check("user@example.com")

    # After enough partition rotations, the record should be cleaned up
    total_partitions = limiter.num_partitions
    with freeze_time(start + total_partitions * limiter.partition_seconds + 1):
        # All partitions have rotated; record should be gone
        limiter.check("user@example.com")  # should not raise


# --- RateLimiter tests ---


class _FakeRateLimitError(Exception):
    pass


def test_rate_limiter_limit_wraps_sync_function() -> None:
    limiter = RateLimiter(
        initial_per_second_request_rate=100,
        maximum_per_second_request_rate=200,
        enforcement_window_minutes=1,
    )

    @limiter.limit
    def fn(x: int) -> int:
        return x * 2

    assert fn(3) == 6


def test_rate_limiter_limit_retries_on_configured_error() -> None:
    call_count = 0

    limiter = RateLimiter(
        rate_limit_error=_FakeRateLimitError,
        max_rate_limit_retries=2,
        initial_per_second_request_rate=100,
        maximum_per_second_request_rate=200,
        enforcement_window_minutes=1,
        cooldown_seconds=0,
    )

    @limiter.limit
    def fn() -> str:
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise _FakeRateLimitError("rate limited")
        return "ok"

    with mock.patch("time.sleep"):  # suppress cooldown sleep
        result = fn()

    assert result == "ok"
    assert call_count == 3  # initial call + 2 retries


def test_rate_limiter_limit_raises_rate_limit_error_after_exhausting_retries() -> None:
    limiter = RateLimiter(
        rate_limit_error=_FakeRateLimitError,
        max_rate_limit_retries=1,
        initial_per_second_request_rate=100,
        maximum_per_second_request_rate=200,
        enforcement_window_minutes=1,
        cooldown_seconds=0,
    )

    @limiter.limit
    def fn() -> None:
        raise _FakeRateLimitError("always rate limited")

    with mock.patch("time.sleep"):  # suppress cooldown sleep
        with pytest.raises(RateLimitError):
            fn()


def test_rate_limiter_limit_does_not_retry_unconfigured_errors() -> None:
    limiter = RateLimiter(
        rate_limit_error=_FakeRateLimitError,
        max_rate_limit_retries=5,
        initial_per_second_request_rate=100,
        maximum_per_second_request_rate=200,
        enforcement_window_minutes=1,
        cooldown_seconds=0,
    )

    class _OtherError(Exception):
        pass

    @limiter.limit
    def fn() -> None:
        raise _OtherError("not a rate limit error")

    with pytest.raises(_OtherError):
        fn()


async def test_rate_limiter_alimit_wraps_async_function() -> None:
    limiter = RateLimiter(
        initial_per_second_request_rate=100,
        maximum_per_second_request_rate=200,
        enforcement_window_minutes=1,
    )

    @limiter.alimit
    async def fn(x: int) -> int:
        return x * 3

    assert await fn(4) == 12


async def test_rate_limiter_alimit_retries_on_configured_error() -> None:
    call_count = 0

    limiter = RateLimiter(
        rate_limit_error=_FakeRateLimitError,
        max_rate_limit_retries=2,
        initial_per_second_request_rate=100,
        maximum_per_second_request_rate=200,
        enforcement_window_minutes=1,
        cooldown_seconds=0,
    )

    @limiter.alimit
    async def fn() -> str:
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise _FakeRateLimitError("rate limited")
        return "ok"

    with mock.patch("asyncio.sleep"):  # suppress cooldown sleep
        result = await fn()

    assert result == "ok"
    assert call_count == 3  # initial call + 2 retries


async def test_rate_limiter_alimit_raises_rate_limit_error_after_exhausting_retries() -> None:
    limiter = RateLimiter(
        rate_limit_error=_FakeRateLimitError,
        max_rate_limit_retries=1,
        initial_per_second_request_rate=100,
        maximum_per_second_request_rate=200,
        enforcement_window_minutes=1,
        cooldown_seconds=0,
    )

    @limiter.alimit
    async def fn() -> None:
        raise _FakeRateLimitError("always rate limited")

    with mock.patch("asyncio.sleep"):  # suppress cooldown sleep
        with pytest.raises(RateLimitError):
            await fn()


async def test_rate_limiter_alimit_event_gate_blocks_concurrent_requests() -> None:
    """
    When a rate limit error occurs, the asyncio.Event gate clears to block new requests
    until error handling completes, then sets again to allow them through.
    """
    limiter = RateLimiter(
        rate_limit_error=_FakeRateLimitError,
        max_rate_limit_retries=0,
        initial_per_second_request_rate=100,
        maximum_per_second_request_rate=200,
        enforcement_window_minutes=1,
        cooldown_seconds=0,
    )

    @limiter.alimit
    async def slow_fn() -> None:
        raise _FakeRateLimitError("rate limited")

    # Trigger rate limit error handling (no retries, so it raises immediately)
    with mock.patch("asyncio.sleep"):
        with pytest.raises(RateLimitError):
            await slow_fn()

    # After error handling finishes, the gate must be open again
    limiter._initialize_async_primitives()
    assert limiter._rate_limit_handling is not None
    assert limiter._rate_limit_handling.is_set(), "gate must be re-opened after error handling"


# --- RateLimitError tests ---


def test_rate_limit_error_is_phoenix_exception() -> None:
    from phoenix.exceptions import PhoenixException

    err = RateLimitError("too many requests")
    assert isinstance(err, PhoenixException)
    assert isinstance(err, Exception)


def test_rate_limit_error_carries_metadata_fields() -> None:
    err = RateLimitError(
        "throttled",
        current_rate_tokens_per_sec=2.5,
        initial_rate_tokens_per_sec=10.0,
        enforcement_window_seconds=60.0,
    )
    assert err.current_rate_tokens_per_sec == 2.5
    assert err.initial_rate_tokens_per_sec == 10.0
    assert err.enforcement_window_seconds == 60.0
    assert str(err) == "throttled"


def test_rate_limit_error_metadata_fields_default_to_none() -> None:
    err = RateLimitError()
    assert err.current_rate_tokens_per_sec is None
    assert err.initial_rate_tokens_per_sec is None
    assert err.enforcement_window_seconds is None
