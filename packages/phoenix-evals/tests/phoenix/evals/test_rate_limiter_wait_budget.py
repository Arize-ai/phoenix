import asyncio
import time
from contextlib import contextmanager
from math import exp, isclose
from typing import Optional
from unittest import mock

import pytest

from phoenix.evals.rate_limiters import (
    AdaptiveTokenBucket,
    RateLimiter,
    RateLimitError,
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


def _starved_bucket(rate: float) -> AdaptiveTokenBucket:
    """A bucket with a token rate so low that one refill tick is huge."""
    bucket = AdaptiveTokenBucket(
        initial_per_second_request_rate=rate,
        maximum_per_second_request_rate=rate,
        enforcement_window_minutes=2,
        rate_reduction_factor=1,
        rate_increase_factor=0,
        cooldown_seconds=0,
    )
    bucket.tokens = 0.0
    return bucket


def test_wait_until_ready_does_not_sleep_past_max_wait_time(monkeypatch):
    """A 0.1/rate refill can exceed the budget; the wait must stop at the budget."""
    bucket = _starved_bucket(0.001)  # one refill tick is 100s
    clock = [0.0]
    sleeps = []

    def fake_time() -> float:
        return clock[0]

    def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)
        clock[0] += seconds

    monkeypatch.setattr("phoenix.evals.rate_limiters.time.time", fake_time)
    monkeypatch.setattr("phoenix.evals.rate_limiters.time.sleep", fake_sleep)

    bucket.wait_until_ready(max_wait_time=0.2)

    assert sum(sleeps) <= 0.2 + 1e-9
    assert bucket.tokens < 1.0  # the call still has to be made without a token


async def test_async_wait_until_ready_does_not_sleep_past_max_wait_time(monkeypatch):
    bucket = _starved_bucket(0.001)
    clock = [0.0]
    sleeps = []

    def fake_time() -> float:
        return clock[0]

    async def fake_sleep(seconds: float) -> None:
        sleeps.append(seconds)
        clock[0] += seconds

    monkeypatch.setattr("phoenix.evals.rate_limiters.time.time", fake_time)
    monkeypatch.setattr("phoenix.evals.rate_limiters.asyncio.sleep", fake_sleep)

    await bucket.async_wait_until_ready(max_wait_time=0.2)

    assert sum(sleeps) <= 0.2 + 1e-9
    assert bucket.tokens < 1.0
