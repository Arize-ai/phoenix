"""The readiness probe must not log one error per probe.

`/readyz` is polled every few seconds by Kubernetes readinessProbes and by
Render health checks. An unreachable database therefore repeats the same
failure thousands of times a day, which buries the daemon errors that describe
the outage (see #17381, where seven background loops produced 22k lines over a
single incident). The probe logs the transition into and out of failure instead.
"""

import asyncio
import logging
from types import SimpleNamespace

import pytest
from starlette.exceptions import HTTPException

from phoenix.server.app import check_readyz


class _FailingDb:
    """Session factory whose database is unreachable."""

    def __call__(self) -> None:
        raise OSError(111, "Connection refused")


class _HealthySession:
    async def __aenter__(self) -> "_HealthySession":
        return self

    async def __aexit__(self, *exc_info: object) -> bool:
        return False

    async def execute(self, _statement: object) -> None:
        return None


class _HealthyDb:
    def __call__(self) -> _HealthySession:
        return _HealthySession()


class _ProbeGate:
    """Holds arriving probes until a set number are waiting, then releases them."""

    def __init__(self, *, num_arrivals: int) -> None:
        self._num_arrivals = num_arrivals
        self._num_waiting = 0
        self._released = asyncio.Event()

    @property
    def num_waiting(self) -> int:
        return self._num_waiting

    async def wait(self) -> None:
        self._num_waiting += 1
        if self._num_waiting >= self._num_arrivals:
            self._released.set()
        await self._released.wait()

    def release(self) -> None:
        self._released.set()


class _GatedFailingSession:
    def __init__(self, gate: _ProbeGate) -> None:
        self._gate = gate

    async def __aenter__(self) -> "_GatedFailingSession":
        await self._gate.wait()
        raise OSError(111, "Connection refused")

    async def __aexit__(self, *exc_info: object) -> bool:
        return False


class _GatedFailingDb:
    """Session factory whose database is unreachable once the gate releases."""

    def __init__(self, gate: _ProbeGate) -> None:
        self._gate = gate

    def __call__(self) -> _GatedFailingSession:
        return _GatedFailingSession(self._gate)


def _request(db: object) -> SimpleNamespace:
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(db=db)))


def _records(caplog: pytest.LogCaptureFixture, level: int) -> list[logging.LogRecord]:
    return [record for record in caplog.records if record.levelno == level]


async def test_readyz_logs_one_error_per_outage_not_per_probe(
    caplog: pytest.LogCaptureFixture,
) -> None:
    request = _request(_FailingDb())

    with caplog.at_level(logging.DEBUG, logger="phoenix.server.app"):
        for _ in range(5):
            with pytest.raises(HTTPException) as exc_info:
                await check_readyz(request)  # type: ignore[arg-type]
            assert exc_info.value.status_code == 503

    errors = _records(caplog, logging.ERROR)
    assert len(errors) == 1
    assert "Database health check failed" in errors[0].getMessage()
    assert len(_records(caplog, logging.DEBUG)) == 4


async def test_readyz_logs_recovery_once(caplog: pytest.LogCaptureFixture) -> None:
    state = SimpleNamespace(db=_FailingDb())
    request = SimpleNamespace(app=SimpleNamespace(state=state))

    with caplog.at_level(logging.DEBUG, logger="phoenix.server.app"):
        for _ in range(3):
            with pytest.raises(HTTPException):
                await check_readyz(request)  # type: ignore[arg-type]
        state.db = _HealthyDb()
        response = await check_readyz(request)  # type: ignore[arg-type]

    assert response.status_code == 200
    infos = _records(caplog, logging.INFO)
    assert len(infos) == 1
    assert "recovered after 3 failed probe" in infos[0].getMessage()

    # A healthy probe after recovery logs nothing.
    caplog.clear()
    with caplog.at_level(logging.DEBUG, logger="phoenix.server.app"):
        await check_readyz(request)  # type: ignore[arg-type]
    assert not _records(caplog, logging.INFO)


async def test_readyz_logs_a_new_error_for_a_second_outage(
    caplog: pytest.LogCaptureFixture,
) -> None:
    state = SimpleNamespace(db=_FailingDb())
    request = SimpleNamespace(app=SimpleNamespace(state=state))

    with caplog.at_level(logging.DEBUG, logger="phoenix.server.app"):
        for _ in range(2):
            with pytest.raises(HTTPException):
                await check_readyz(request)  # type: ignore[arg-type]
        state.db = _HealthyDb()
        await check_readyz(request)  # type: ignore[arg-type]
        state.db = _FailingDb()
        with pytest.raises(HTTPException):
            await check_readyz(request)  # type: ignore[arg-type]

    assert len(_records(caplog, logging.ERROR)) == 2


async def test_readyz_overlapping_first_failures_log_one_error(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Two probes failing at the same moment open one outage, not two."""
    gate = _ProbeGate(num_arrivals=2)
    request = _request(_GatedFailingDb(gate))

    with caplog.at_level(logging.DEBUG, logger="phoenix.server.app"):
        outcomes = await asyncio.gather(
            check_readyz(request),  # type: ignore[arg-type]
            check_readyz(request),  # type: ignore[arg-type]
            return_exceptions=True,
        )

    for outcome in outcomes:
        assert isinstance(outcome, HTTPException)
        assert outcome.status_code == 503
    assert len(_records(caplog, logging.ERROR)) == 1
    assert len(_records(caplog, logging.DEBUG)) == 1
    assert request.app.state._readyz_failures == 2


async def test_readyz_late_failure_does_not_overwrite_recovery_state(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A probe that started before recovery and fails after it must not write a stale count."""
    state = SimpleNamespace(db=_FailingDb())
    request = SimpleNamespace(app=SimpleNamespace(state=state))

    with caplog.at_level(logging.DEBUG, logger="phoenix.server.app"):
        for _ in range(3):
            with pytest.raises(HTTPException):
                await check_readyz(request)  # type: ignore[arg-type]

        gate = _ProbeGate(num_arrivals=2)
        state.db = _GatedFailingDb(gate)
        late_probe = asyncio.create_task(check_readyz(request))  # type: ignore[arg-type]
        await asyncio.sleep(0)
        assert gate.num_waiting == 1

        # The database comes back while the slow probe is still waiting on it.
        state.db = _HealthyDb()
        await check_readyz(request)  # type: ignore[arg-type]
        gate.release()
        with pytest.raises(HTTPException):
            await late_probe

    infos = _records(caplog, logging.INFO)
    assert len(infos) == 1
    assert "recovered after 3 failed probe" in infos[0].getMessage()

    # The late failure is a real failed check, so it reports at ERROR instead of
    # being filed as a further failure of the outage that already ended.
    assert len(_records(caplog, logging.ERROR)) == 2
    assert state._readyz_failures == 1

    # One recovery line, counting the failure that happened after the last
    # recovery rather than the stale count from the outage that ended.
    caplog.clear()
    with caplog.at_level(logging.DEBUG, logger="phoenix.server.app"):
        await check_readyz(request)  # type: ignore[arg-type]
    infos = _records(caplog, logging.INFO)
    assert len(infos) == 1
    assert "recovered after 1 failed probe" in infos[0].getMessage()
    assert state._readyz_failures == 0
