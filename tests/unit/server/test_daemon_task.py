import asyncio
import time

import pytest

from phoenix.server import types
from phoenix.server.types import DaemonTask


class _Ticker(DaemonTask):
    """A daemon whose tick is observable: it records whether it ran to completion or was
    interrupted, and sleeps a long time between ticks."""

    def __init__(self, *, tick_seconds: float, interval_seconds: float = 3600.0) -> None:
        super().__init__()
        self._tick_seconds = tick_seconds
        self._interval_seconds = interval_seconds
        self.started = asyncio.Event()
        self.finished = 0
        self.interrupted = 0

    async def _run(self) -> None:
        while self._running:
            self.started.set()
            try:
                async with self._ticking():
                    await asyncio.sleep(self._tick_seconds)
            except asyncio.CancelledError:
                self.interrupted += 1
                raise
            self.finished += 1
            await self._sleep(self._interval_seconds)


async def test_stop_lets_an_in_flight_tick_finish_instead_of_cancelling_it() -> None:
    daemon = _Ticker(tick_seconds=0.3)
    await daemon.start()
    await asyncio.wait_for(daemon.started.wait(), timeout=1)

    began = time.monotonic()
    await daemon.stop()

    assert daemon.finished == 1
    assert daemon.interrupted == 0
    assert time.monotonic() - began < types.DAEMON_STOP_GRACE_SECONDS


async def test_stop_wakes_a_daemon_sleeping_between_ticks_immediately() -> None:
    daemon = _Ticker(tick_seconds=0.0)
    await daemon.start()
    await asyncio.wait_for(daemon.started.wait(), timeout=1)
    await asyncio.sleep(0.05)  # into the between-tick sleep

    began = time.monotonic()
    await daemon.stop()

    assert daemon.finished == 1
    assert daemon.interrupted == 0
    assert time.monotonic() - began < 1.0


async def test_stop_cancels_a_tick_that_outlives_the_grace_period(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(types, "DAEMON_STOP_GRACE_SECONDS", 0.1)
    daemon = _Ticker(tick_seconds=60.0)
    await daemon.start()
    await asyncio.wait_for(daemon.started.wait(), timeout=1)

    began = time.monotonic()
    await daemon.stop()

    assert daemon.finished == 0
    assert daemon.interrupted == 1
    assert time.monotonic() - began < 2.0
    assert daemon._tasks == []


async def test_sleep_before_start_returns_without_waiting() -> None:
    daemon = _Ticker(tick_seconds=0.0)
    began = time.monotonic()
    await daemon._sleep(60.0)
    assert time.monotonic() - began < 0.5


class _Parked(DaemonTask):
    """A daemon that waits outside any tick, the way a queue consumer waits for work."""

    def __init__(self) -> None:
        super().__init__()
        self.started = asyncio.Event()
        self.interrupted = 0

    async def _run(self) -> None:
        self.started.set()
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            self.interrupted += 1
            raise


async def test_stop_cancels_a_daemon_waiting_outside_a_tick_at_once() -> None:
    daemon = _Parked()
    await daemon.start()
    await asyncio.wait_for(daemon.started.wait(), timeout=1)

    began = time.monotonic()
    await daemon.stop()

    assert daemon.interrupted == 1
    assert time.monotonic() - began < 1.0
