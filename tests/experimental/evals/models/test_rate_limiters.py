import asyncio
import time
from contextlib import contextmanager
from math import exp, isclose
from typing import Optional
from unittest import mock

import pytest
from phoenix.experimental.evals.models.rate_limiters import (
    AdaptiveTokenBucket,
    UnavailableTokensError,
)


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


def test_token_bucket_gains_tokens_over_time():
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
        assert isclose(bucket.available_requests(), 5)

    with freeze_time(start + 10):
        assert isclose(bucket.available_requests(), 10)


def test_token_rate_limiter_can_max_out_on_requests():
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
        assert bucket.available_requests() == 30

    with freeze_time(start + 120):
        assert bucket.available_requests() == 120

    with freeze_time(start + 130):
        assert bucket.available_requests() == 120


def test_token_rate_limiter_spends_tokens():
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
        assert bucket.available_requests() == 3
        bucket.make_request_if_ready()
        assert bucket.available_requests() == 2


def test_token_rate_limiter_cannot_spend_unavailable_tokens():
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
        assert bucket.available_requests() == 0
        with pytest.raises(UnavailableTokensError):
            bucket.make_request_if_ready()


def test_token_rate_limiter_can_block_until_tokens_are_available():
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
        assert bucket.available_requests() == 0
        bucket.wait_until_ready()
        sleeps = [s.args[0] for s in time.sleep.call_args_list]
        time_cost = 1 / rate
        assert isclose(sum(sleeps), time_cost, rel_tol=0.2)


async def test_token_rate_limiter_async_waits_until_tokens_are_available():
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
        assert bucket.available_requests() == 0
        await bucket.async_wait_until_ready()
        sleeps = [s.args[0] for s in asyncio.sleep.call_args_list]
        time_cost = 1 / rate
        assert isclose(sum(sleeps), time_cost, rel_tol=0.2)


def test_token_rate_limiter_can_accumulate_tokens_before_waiting():
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
        assert bucket.available_requests() == 0.5, "should have accumulated half a request"
        bucket.wait_until_ready()
        sleeps = [s.args[0] for s in time.sleep.call_args_list]
        time_cost = (1 / rate) - 5
        assert isclose(sum(sleeps), time_cost, rel_tol=0.2)


async def test_token_rate_limiter_can_async_accumulate_tokens_before_waiting():
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
        assert bucket.available_requests() == 0.5, "should have accumulated half a request"
        await bucket.async_wait_until_ready()
        sleeps = [s.args[0] for s in asyncio.sleep.call_args_list]
        time_cost = (1 / rate) - 5
        assert isclose(sum(sleeps), time_cost, rel_tol=0.2)


def test_token_bucket_adaptively_increases_rate_over_time():
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
        assert bucket.available_requests() == 0.5, "should have accumulated half a request"
        bucket.wait_until_ready()
        sleeps = [s.args[0] for s in time.sleep.call_args_list]
        elapsed_time = sum(sleeps) + 5
        assert isclose(bucket.rate, 0.1 * exp(0.01 * elapsed_time))


def test_token_bucket_does_not_increase_rate_past_maximum():
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
        assert bucket.available_requests() == 0.5, "should have accumulated half a request"
        bucket.wait_until_ready()
        assert isclose(bucket.rate, rate * 2)


def test_token_bucket_resets_rate_after_inactivity():
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
        assert bucket.available_requests() == 0.5, "should have accumulated half a request"
        bucket.wait_until_ready()
        assert isclose(bucket.rate, rate * 2)

    with warp_time(start + 100):
        bucket.wait_until_ready()
        assert isclose(bucket.rate, rate)


def test_token_bucket_decreases_rate():
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


def test_token_bucket_decreases_rate_once_per_cooldown_period():
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
