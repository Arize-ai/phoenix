import time
from contextlib import contextmanager
from typing import Iterator, List, Optional
from unittest import mock

import pytest

from phoenix.executors.rate_limiters import (
    AdaptiveTokenBucket,
    RateLimiter,
    UnavailableTokensError,
)


@contextmanager
def freeze_time(frozen_time: float) -> Iterator[None]:
    with mock.patch("time.time") as mock_time:
        mock_time.return_value = frozen_time
        yield


def test_bucket_starts_with_one_token() -> None:
    # The first request through a fresh limiter must not have to wait for the bucket to fill.
    with freeze_time(time.time()):
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=1,
            maximum_per_second_request_rate=1,
            rate_increase_factor=0,
        )
        assert bucket.available_requests() == 1.0
        bucket.make_request_if_ready()
        assert bucket.available_requests() == 0
        with pytest.raises(UnavailableTokensError):
            bucket.make_request_if_ready()


def test_rate_limiter_defaults_to_five_requests_per_second() -> None:
    limiter = RateLimiter()
    assert limiter._throttler.rate == 5.0  # pyright: ignore[reportPrivateUsage]


def test_verbose_throttling_messages_go_to_the_injected_notifier() -> None:
    messages: List[str] = []
    limiter = RateLimiter(
        rate_limit_error=ValueError,
        initial_per_second_request_rate=100,
        cooldown_seconds=0,
        verbose=True,
        notify=messages.append,
    )

    @limiter.limit
    def always_rate_limited() -> None:
        raise ValueError("429")

    with pytest.raises(Exception):
        always_rate_limited()

    assert any("Throttling from" in message for message in messages)


def test_quiet_by_default() -> None:
    messages: List[str] = []
    limiter = RateLimiter(
        rate_limit_error=ValueError,
        initial_per_second_request_rate=100,
        cooldown_seconds=0,
        notify=messages.append,
    )

    @limiter.limit
    def always_rate_limited() -> None:
        raise ValueError("429")

    with pytest.raises(Exception):
        always_rate_limited()

    assert messages == []


def test_bucket_caps_tokens_at_the_enforcement_window() -> None:
    start = time.time()
    maximum: Optional[float] = 1
    with freeze_time(start):
        bucket = AdaptiveTokenBucket(
            initial_per_second_request_rate=1,
            maximum_per_second_request_rate=maximum,
            enforcement_window_minutes=2,
            rate_increase_factor=0,
        )
    with freeze_time(start + 130):
        assert bucket.available_requests() == 120
