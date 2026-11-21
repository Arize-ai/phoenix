"""The readiness probe must not log one error per probe.

`/readyz` is polled every few seconds by Kubernetes readinessProbes and by
Render health checks. An unreachable database therefore repeats the same
failure thousands of times a day, which buries the daemon errors that describe
the outage (see #17381, where seven background loops produced 22k lines over a
single incident). The probe logs the transition into and out of failure instead.
"""

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
