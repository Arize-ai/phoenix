from phoenix.evals.rate_limiters import AdaptiveTokenBucket


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
