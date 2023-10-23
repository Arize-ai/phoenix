import asyncio
import time
from contextlib import contextmanager
from math import isclose
from typing import Optional
from unittest import mock

import pytest
from phoenix.utilities.ratelimits import LeakyBucket, LimitStore, UnavailableTokensError


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


@contextmanager
def async_warp_time(start: Optional[float]):
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
        with mock.patch("asyncio.sleep") as mock_sleep:
            mock_sleep.side_effect = instant_sleep
            mock_time.side_effect = time_warp
            yield


def test_leaky_bucket_empties_over_time():
    start = time.time()

    with freeze_time(start):
        bucket = LeakyBucket(per_minute_rate=60, starting_tokens=0, max_tokens=120)

    with freeze_time(start + 5):
        assert isclose(bucket.available_tokens(), 5)

    with freeze_time(start + 10):
        assert isclose(bucket.available_tokens(), 10)


def test_leaky_bucket_can_empty_out():
    start = time.time()

    with freeze_time(start):
        bucket = LeakyBucket(per_minute_rate=60, starting_tokens=0, max_tokens=120)

    with freeze_time(start + 60):
        assert bucket.available_tokens() == 60

    with freeze_time(start + 120):
        assert bucket.available_tokens() == 120

    with freeze_time(start + 130):
        assert bucket.available_tokens() == 120


def leaky_bucket_adjusts_rate_with_multiplier():
    start = time.time()

    with freeze_time(start):
        bucket = LeakyBucket(
            per_minute_rate=60, starting_tokens=0, max_tokens=120, rate_multiplier=0.5
        )
        assert bucket.rate == 0.5 * 60 / 60

    with freeze_time(start + 10):
        assert bucket.available_tokens() == 5


def test_leaky_bucket_spends_tokens():
    start = time.time()

    with freeze_time(start):
        bucket = LeakyBucket(per_minute_rate=60, starting_tokens=20, max_tokens=120)
        assert bucket.available_tokens() == 20
        bucket.spend_tokens_if_available(10)
        assert bucket.available_tokens() == 10


def test_leaky_bucket_cannot_spend_unavailable_tokens():
    start = time.time()

    with freeze_time(start):
        bucket = LeakyBucket(per_minute_rate=60, starting_tokens=20, max_tokens=120)
        assert bucket.available_tokens() == 20
        with pytest.raises(UnavailableTokensError):
            bucket.spend_tokens_if_available(30)


def test_leaky_bucket_can_be_forced_to_spend_tokens():
    start = time.time()

    with freeze_time(start):
        bucket = LeakyBucket(per_minute_rate=60, starting_tokens=20, max_tokens=120)
        assert bucket.available_tokens() == 20
        bucket.spend_tokens(30)
        assert bucket.available_tokens() == -10


def test_leaky_bucket_conservatively_updates_rate():
    start = time.time()

    bucket = LeakyBucket(per_minute_rate=60, starting_tokens=20, max_tokens=120)
    assert isclose(bucket.rate, 60 / 60)
    with freeze_time(start + 10):
        assert bucket.available_tokens() > 0
        bucket.refresh_limit(120)
        assert isclose(bucket.rate, 120 / 60)
        assert bucket.available_tokens() == 0


def test_leaky_bucket_can_block_until_tokens_are_available():
    start = time.time()

    with freeze_time(start):
        rate = 60
        bucket = LeakyBucket(per_minute_rate=rate, starting_tokens=0, max_tokens=120)

    with warp_time(start):
        assert bucket.tokens == 0
        token_cost = 10
        bucket.wait_for_then_spend_available_tokens(token_cost)
        sleeps = [s.args[0] for s in time.sleep.call_args_list]
        time_cost = token_cost * rate / 60
        assert sum(sleeps) >= time_cost


async def test_leaky_bucket_async_waits_until_tokens_are_available():
    start = time.time()

    with freeze_time(start):
        rate = 60
        bucket = LeakyBucket(per_minute_rate=rate, starting_tokens=0, max_tokens=120)

    with async_warp_time(start):
        assert bucket.tokens == 0
        token_cost = 10
        await bucket.async_wait_for_then_spend_available_tokens(token_cost)
        sleeps = [s.args[0] for s in asyncio.sleep.call_args_list]
        time_cost = token_cost * rate / 60
        assert sum(sleeps) >= time_cost


def test_leaky_bucket_can_accumulate_tokens_before_waiting():
    start = time.time()

    with freeze_time(start):
        rate = 60
        bucket = LeakyBucket(per_minute_rate=rate, starting_tokens=0, max_tokens=120)

    with warp_time(start + 10):
        assert bucket.tokens == 0
        token_cost = 10
        bucket.wait_for_then_spend_available_tokens(token_cost)
        sleeps = [s.args[0] for s in time.sleep.call_args_list]
        time_cost = token_cost * rate / 60
        assert sum(sleeps) >= time_cost - 10


async def test_leaky_bucket_can_async_accumulate_tokens_before_waiting():
    start = time.time()

    with freeze_time(start):
        rate = 60
        bucket = LeakyBucket(per_minute_rate=rate, starting_tokens=0, max_tokens=120)

    with async_warp_time(start + 10):
        assert bucket.tokens == 0
        token_cost = 10
        await bucket.async_wait_for_then_spend_available_tokens(token_cost)
        sleeps = [s.args[0] for s in asyncio.sleep.call_args_list]
        time_cost = token_cost * rate / 60
        assert sum(sleeps) >= time_cost - 10


def test_limit_store_groups_limits_by_key():
    limit_store = LimitStore()
    limit_store.set_rate_limit("one-key", "limit1", 20)
    limit_store.set_rate_limit("one-key", "limit2", 30)
    limit_store.set_rate_limit("another-key", "limit3", 60)
    one_limit_group = limit_store.get_rate_limits("one-key")
    assert "limit1" in one_limit_group
    assert "limit2" in one_limit_group
    assert "limit3" not in one_limit_group
    another_limit_group = limit_store.get_rate_limits("another-key")
    assert "limit1" not in another_limit_group
    assert "limit2" not in another_limit_group
    assert "limit3" in another_limit_group


def test_limit_store_is_a_singleton():
    first_limit_store_instance = LimitStore()
    second_limit_store_instance = LimitStore()
    assert first_limit_store_instance is second_limit_store_instance
    first_limit_store_instance.set_rate_limit(
        "test-key",
        "test-limit",
        60,
    )
    limits = second_limit_store_instance.get_rate_limits("test-key")
    assert "test-limit" in limits
    assert limits["test-limit"].rate == 60 / 60


def test_limit_store_can_wait_for_all_grouped_rate_limits():
    start = time.time()
    limit_store = LimitStore()

    small_limit = 10
    big_limit = 60
    small_token_cost = 1
    big_token_cost = 10
    small_time_cost = small_limit / 60 * small_token_cost
    big_time_cost = big_limit / 60 * big_token_cost

    with freeze_time(start):
        limit_store.set_rate_limit("special-limit-group", "small-limit", small_limit)
        limit_store.set_rate_limit("special-limit-group", "big-limit", big_limit)

    with warp_time(start):
        limit_store.wait_for_rate_limits(
            "special-limit-group", {"small-limit": small_token_cost, "big-limit": big_token_cost}
        )
        sleeps = [s.args[0] for s in time.sleep.call_args_list]
        assert small_time_cost < big_time_cost < sum(sleeps)


def test_limit_store_can_wait_for_all_grouped_rate_limits_small():
    start = time.time()
    limit_store = LimitStore()

    small_limit = 10
    big_limit = 60
    small_token_cost = 10
    big_token_cost = 1
    small_time_cost = small_limit / 60 * small_token_cost
    big_time_cost = big_limit / 60 * big_token_cost

    with freeze_time(start):
        limit_store.set_rate_limit("special-limit-group", "small-limit", small_limit)
        limit_store.set_rate_limit("special-limit-group", "big-limit", big_limit)

    with warp_time(start):
        limit_store.wait_for_rate_limits(
            "special-limit-group", {"small-limit": small_token_cost, "big-limit": big_token_cost}
        )
        sleeps = [s.args[0] for s in time.sleep.call_args_list]
        assert big_time_cost < small_time_cost < sum(sleeps)


async def test_limit_store_can_async_wait_for_all_grouped_rate_limits():
    start = time.time()
    limit_store = LimitStore()

    small_limit = 10
    big_limit = 60
    small_token_cost = 1
    big_token_cost = 10
    small_time_cost = small_limit / 60 * small_token_cost
    big_time_cost = big_limit / 60 * big_token_cost

    with freeze_time(start):
        limit_store.set_rate_limit("special-limit-group", "small-limit", small_limit)
        limit_store.set_rate_limit("special-limit-group", "big-limit", big_limit)

    with async_warp_time(start):
        await limit_store.async_wait_for_rate_limits(
            "special-limit-group", {"small-limit": small_token_cost, "big-limit": big_token_cost}
        )
        sleeps = [s.args[0] for s in asyncio.sleep.call_args_list]
        assert small_time_cost < big_time_cost < sum(sleeps)


async def test_limit_store_can_async_wait_for_all_grouped_rate_limits_small():
    start = time.time()
    limit_store = LimitStore()

    small_limit = 10
    big_limit = 60
    small_token_cost = 10
    big_token_cost = 1
    small_time_cost = small_limit / 60 * small_token_cost
    big_time_cost = big_limit / 60 * big_token_cost

    with freeze_time(start):
        limit_store.set_rate_limit("special-limit-group", "small-limit", small_limit)
        limit_store.set_rate_limit("special-limit-group", "big-limit", big_limit)

    with async_warp_time(start):
        await limit_store.async_wait_for_rate_limits(
            "special-limit-group", {"small-limit": small_token_cost, "big-limit": big_token_cost}
        )
        sleeps = [s.args[0] for s in asyncio.sleep.call_args_list]
        assert big_time_cost < small_time_cost < sum(sleeps)


def test_limit_store_can_force_spend_tokens():
    start = time.time()
    limit_store = LimitStore()

    with freeze_time(start):
        per_minute_limit = 60
        limit_store.set_rate_limit("forced-limit-group", "token-limit", 60)

    with warp_time(start):
        forced_token_cost = 10
        token_cost = 30
        limit_store.spend_rate_limits(
            "forced-limit-group",
            {"token-limit": forced_token_cost},
        )
        limit_store.wait_for_rate_limits(
            "forced-limit-group",
            {"token-limit": token_cost},
        )
        time_cost = per_minute_limit / 60 * (forced_token_cost + token_cost)
        sleeps = [s.args[0] for s in time.sleep.call_args_list]
        assert sum(sleeps) >= time_cost, "Should wait for tokens after forced spending"


def test_resetting_rate_limits_resets_tokens():
    start = time.time()
    limit_store = LimitStore()

    with freeze_time(start):
        per_minute_limit = 60
        limit_store.set_rate_limit("resetting-group", "some-limit", 60)

    with warp_time(start + 10):
        token_cost = 30
        limit_store.set_rate_limit("resetting-group", "some-limit", 120)
        limit_store.wait_for_rate_limits(
            "resetting-group",
            {"some-limit": token_cost},
        )
        time_cost = per_minute_limit / 120 * 30
        sleeps = [s.args[0] for s in time.sleep.call_args_list]
        assert sum(sleeps) >= time_cost
