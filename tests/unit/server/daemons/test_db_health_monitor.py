"""Tests for the database health monitor and the health endpoints that read it."""

from __future__ import annotations

import asyncio
import logging
from asyncio import Event, wait_for
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

import httpx2
import pytest
from fastapi import FastAPI
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.server.app import router
from phoenix.server.daemons import db_health_monitor as db_health_monitor_module
from phoenix.server.daemons.db_health_monitor import DbHealthMonitor
from phoenix.server.types import DbSessionFactory

_CYCLE_TIMEOUT_SECONDS = 30.0
_SECRET_CONNECTION_DETAIL = "postgresql://admin:hunter2@db.internal.example:5432/phoenix"


class _FakeClock:
    def __init__(self) -> None:
        self.now_seconds = 1_000.0

    def __call__(self) -> float:
        return self.now_seconds

    def advance(self, *, seconds: float) -> None:
        self.now_seconds += seconds


class _FakeDatabase:
    """A session factory whose reachability the test controls and whose use it counts."""

    def __init__(self) -> None:
        self.num_sessions_opened = 0
        self.num_sessions_in_flight = 0
        self.max_sessions_in_flight = 0
        self.connect_error: Optional[BaseException] = None
        self.is_hung = False

    @asynccontextmanager
    async def __call__(self) -> AsyncIterator[AsyncSession]:
        self.num_sessions_opened += 1
        self.num_sessions_in_flight += 1
        self.max_sessions_in_flight = max(self.max_sessions_in_flight, self.num_sessions_in_flight)
        try:
            if self.is_hung:
                await Event().wait()
            if self.connect_error is not None:
                raise self.connect_error
            yield _FakeSession()  # type: ignore[misc]
        finally:
            self.num_sessions_in_flight -= 1


class _FakeSession:
    async def execute(self, *_: object) -> None:
        return None


class _ProbeController:
    """Steps the monitor one probe at a time through its patched sleep.

    The monitor sleeps before each probe, so each release runs exactly one probe
    and the monitor parks again once that probe has been recorded.
    """

    def __init__(self) -> None:
        self._release = Event()
        self._parked = Event()

    async def park(self, *_: object) -> None:
        self._parked.set()
        await self._release.wait()
        self._release.clear()

    async def wait_until_parked(self, phase: str) -> None:
        try:
            await wait_for(self._parked.wait(), _CYCLE_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            pytest.fail(f"The monitor did not park within {_CYCLE_TIMEOUT_SECONDS:.0f}s: {phase}")

    async def run_probe(self, phase: str) -> None:
        await self.wait_until_parked(f"before {phase}")
        self._parked.clear()
        self._release.set()
        await self.wait_until_parked(phase)


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> _FakeClock:
    fake_clock = _FakeClock()
    monkeypatch.setattr(db_health_monitor_module, "monotonic", fake_clock)
    return fake_clock


@pytest.fixture
def probes(monkeypatch: pytest.MonkeyPatch) -> _ProbeController:
    controller = _ProbeController()
    monkeypatch.setattr(DbHealthMonitor, "_sleep", controller.park)
    return controller


@pytest.fixture
def database() -> _FakeDatabase:
    return _FakeDatabase()


@pytest.fixture
async def monitor(
    database: _FakeDatabase,
    clock: _FakeClock,
    probes: _ProbeController,
) -> AsyncIterator[DbHealthMonitor]:
    health_monitor = DbHealthMonitor(DbSessionFactory(db=database, dialect="postgresql"))
    async with health_monitor:
        await probes.wait_until_parked("startup")
        yield health_monitor


@pytest.fixture
async def client(monitor: DbHealthMonitor) -> AsyncIterator[httpx2.AsyncClient]:
    app = FastAPI()
    app.include_router(router)
    app.state.db_health_monitor = monitor
    async with httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=app), base_url="http://test"
    ) as http_client:
        yield http_client


def _connection_refused() -> OSError:
    return OSError(f"[Errno 111] Connection refused: {_SECRET_CONNECTION_DETAIL}")


class TestMonitorState:
    async def test_is_healthy_at_startup_before_the_first_probe(
        self, monitor: DbHealthMonitor, database: _FakeDatabase
    ) -> None:
        assert database.num_sessions_opened == 0
        assert monitor.is_ready
        assert monitor.is_live

    async def test_stays_healthy_while_probes_succeed(
        self, monitor: DbHealthMonitor, clock: _FakeClock, probes: _ProbeController
    ) -> None:
        for _ in range(100):
            clock.advance(seconds=5)
            await probes.run_probe("successful probe")
        assert monitor.is_ready
        assert monitor.is_live

    async def test_one_failed_probe_does_not_fail_readiness(
        self,
        monitor: DbHealthMonitor,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
    ) -> None:
        database.connect_error = _connection_refused()
        clock.advance(seconds=5)
        await probes.run_probe("failed probe")
        assert monitor.is_ready
        assert monitor.is_live

    async def test_outage_fails_readiness_first_and_liveness_only_when_prolonged(
        self,
        monitor: DbHealthMonitor,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
    ) -> None:
        database.connect_error = _connection_refused()
        clock.advance(seconds=16)
        await probes.run_probe("failed probe")
        assert not monitor.is_ready
        assert monitor.is_live

        clock.advance(seconds=284)
        await probes.run_probe("failed probe at the grace boundary")
        assert monitor.is_live

        clock.advance(seconds=1)
        await probes.run_probe("failed probe past the grace period")
        assert not monitor.is_ready
        assert not monitor.is_live

    async def test_recovers_on_the_first_successful_probe(
        self,
        monitor: DbHealthMonitor,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
    ) -> None:
        database.connect_error = _connection_refused()
        clock.advance(seconds=600)
        await probes.run_probe("failed probe")
        assert not monitor.is_live

        database.connect_error = None
        await probes.run_probe("recovery probe")
        assert monitor.is_ready
        assert monitor.is_live

    @pytest.mark.parametrize(
        "connect_error",
        [
            pytest.param(_connection_refused(), id="connection-refused"),
            pytest.param(ConnectionResetError(104, "Connection reset by peer"), id="reset"),
            pytest.param(
                DBAPIError("SELECT 1", None, Exception("the database system is starting up")),
                id="database-starting-up",
            ),
            pytest.param(TimeoutError("pool checkout timed out"), id="timeout"),
        ],
    )
    async def test_connection_failures_count_as_unreachable(
        self,
        monitor: DbHealthMonitor,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
        connect_error: BaseException,
    ) -> None:
        database.connect_error = connect_error
        clock.advance(seconds=16)
        await probes.run_probe("failed probe")
        assert not monitor.is_ready

    async def test_hung_database_is_cut_off_by_the_probe_timeout(
        self,
        monitor: DbHealthMonitor,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(db_health_monitor_module, "_PROBE_TIMEOUT_SECONDS", 0.01)
        database.is_hung = True
        clock.advance(seconds=16)
        # A probe that never returned would leave the monitor unparked and fail here.
        await probes.run_probe("probe against a hung database")
        assert not monitor.is_ready
        assert database.num_sessions_in_flight == 0

    async def test_monitor_that_stops_probing_reports_unhealthy(
        self,
        monitor: DbHealthMonitor,
        clock: _FakeClock,
    ) -> None:
        await monitor.stop()
        assert monitor.is_ready
        clock.advance(seconds=16)
        assert not monitor.is_ready
        assert monitor.is_live
        clock.advance(seconds=285)
        assert not monitor.is_live

    async def test_restart_resets_to_healthy(
        self,
        monitor: DbHealthMonitor,
        clock: _FakeClock,
        probes: _ProbeController,
    ) -> None:
        await monitor.stop()
        clock.advance(seconds=600)
        assert not monitor.is_live
        await monitor.start()
        await probes.wait_until_parked("restart")
        assert monitor.is_ready
        assert monitor.is_live

    async def test_sqlite_is_never_probed_and_always_healthy(
        self, database: _FakeDatabase, clock: _FakeClock
    ) -> None:
        database.connect_error = _connection_refused()
        health_monitor = DbHealthMonitor(DbSessionFactory(db=database, dialect="sqlite"))
        async with health_monitor:
            await asyncio.gather(*health_monitor._tasks)
            clock.advance(seconds=10_000)
            assert health_monitor.is_ready
            assert health_monitor.is_live
        assert database.num_sessions_opened == 0


class TestMonitorLogging:
    async def test_logs_once_per_outage_and_once_on_recovery(
        self,
        monitor: DbHealthMonitor,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        caplog.set_level(logging.INFO, logger=db_health_monitor_module.__name__)
        database.connect_error = _connection_refused()
        for _ in range(50):
            clock.advance(seconds=5)
            await probes.run_probe("failed probe")
        database.connect_error = None
        for _ in range(50):
            clock.advance(seconds=5)
            await probes.run_probe("successful probe")

        messages = [
            record.getMessage()
            for record in caplog.records
            if record.name == db_health_monitor_module.__name__
        ]
        assert messages == [
            "Database is unreachable",
            "Database is reachable again after 255 seconds",
        ]


class TestHealthEndpoints:
    async def test_report_healthy_while_the_database_answers(
        self, client: httpx2.AsyncClient
    ) -> None:
        healthz = await client.get("/healthz")
        assert (healthz.status_code, healthz.text) == (200, "OK")
        readyz = await client.get("/readyz")
        assert (readyz.status_code, readyz.json()) == (200, {})

    async def test_readyz_fails_during_an_outage_while_healthz_holds(
        self,
        client: httpx2.AsyncClient,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
    ) -> None:
        database.connect_error = _connection_refused()
        clock.advance(seconds=16)
        await probes.run_probe("failed probe")
        assert (await client.get("/readyz")).status_code == 503
        assert (await client.get("/healthz")).status_code == 200

    async def test_healthz_fails_after_a_prolonged_outage_and_recovers(
        self,
        client: httpx2.AsyncClient,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
    ) -> None:
        database.connect_error = _connection_refused()
        clock.advance(seconds=301)
        await probes.run_probe("failed probe")
        assert (await client.get("/healthz")).status_code == 503
        assert (await client.get("/readyz")).status_code == 503

        database.connect_error = None
        await probes.run_probe("recovery probe")
        assert (await client.get("/healthz")).status_code == 200
        assert (await client.get("/readyz")).status_code == 200

    @pytest.mark.parametrize("path", ["/healthz", "/readyz"])
    async def test_failure_response_reveals_nothing_about_the_database(
        self,
        client: httpx2.AsyncClient,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
        path: str,
    ) -> None:
        database.connect_error = _connection_refused()
        clock.advance(seconds=301)
        await probes.run_probe("failed probe")
        response = await client.get(path)
        assert response.status_code == 503
        assert response.text in ("database unreachable", '{"detail":"database unreachable"}')
        assert set(response.headers) == {"content-length", "content-type"}

    @pytest.mark.parametrize("path", ["/healthz", "/readyz"])
    @pytest.mark.parametrize("is_database_down", [False, True])
    async def test_request_flood_never_reaches_the_database(
        self,
        client: httpx2.AsyncClient,
        database: _FakeDatabase,
        clock: _FakeClock,
        probes: _ProbeController,
        path: str,
        is_database_down: bool,
    ) -> None:
        if is_database_down:
            database.connect_error = _connection_refused()
            clock.advance(seconds=301)
        await probes.run_probe("probe before the flood")
        num_sessions_before_flood = database.num_sessions_opened

        responses = await asyncio.gather(*(client.get(path) for _ in range(500)))

        assert {response.status_code for response in responses} == {
            503 if is_database_down else 200
        }
        assert database.num_sessions_opened == num_sessions_before_flood == 1

    @pytest.mark.parametrize("path", ["/healthz", "/readyz"])
    async def test_requests_answer_while_a_probe_hangs(
        self,
        client: httpx2.AsyncClient,
        database: _FakeDatabase,
        probes: _ProbeController,
        monkeypatch: pytest.MonkeyPatch,
        path: str,
    ) -> None:
        monkeypatch.setattr(db_health_monitor_module, "_PROBE_TIMEOUT_SECONDS", 3600.0)
        database.is_hung = True
        probes._parked.clear()
        probes._release.set()
        while database.num_sessions_in_flight == 0:
            await asyncio.sleep(0)

        responses = await wait_for(
            asyncio.gather(*(client.get(path) for _ in range(100))), _CYCLE_TIMEOUT_SECONDS
        )

        assert {response.status_code for response in responses} == {200}
        assert database.max_sessions_in_flight == 1

    @pytest.mark.parametrize("path", ["/healthz", "/readyz"])
    @pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
    async def test_only_get_is_routed(
        self, client: httpx2.AsyncClient, database: _FakeDatabase, path: str, method: str
    ) -> None:
        response = await client.request(method, path, content=b"x" * 1024)
        assert response.status_code == 405
        assert database.num_sessions_opened == 0

    @pytest.mark.parametrize("path", ["/healthz", "/readyz"])
    async def test_request_input_cannot_trigger_a_probe(
        self, client: httpx2.AsyncClient, database: _FakeDatabase, path: str
    ) -> None:
        response = await client.get(
            path,
            params={"force": "true", "refresh": "1", "timeout": "0", "db": "other"},
            headers={"Cache-Control": "no-cache", "X-Forwarded-For": "10.0.0.1"},
        )
        assert response.status_code == 200
        assert database.num_sessions_opened == 0


class TestAppWiring:
    async def test_health_endpoints_do_not_open_database_sessions(
        self,
        app: FastAPI,
        httpx_client: httpx2.AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        assert isinstance(app.state.db_health_monitor, DbHealthMonitor)

        def fail_on_database_access() -> None:
            pytest.fail("a health endpoint opened a database session")

        monkeypatch.setattr(app.state, "db", fail_on_database_access)
        for path in ("/healthz", "/readyz"):
            responses = await asyncio.gather(*(httpx_client.get(path) for _ in range(50)))
            assert {response.status_code for response in responses} == {200}

    @pytest.mark.postgres_only
    async def test_app_monitor_probes_postgres_through_the_lifespan(
        self,
        probes: _ProbeController,
        app: FastAPI,
        httpx_client: httpx2.AsyncClient,
    ) -> None:
        health_monitor: DbHealthMonitor = app.state.db_health_monitor
        last_success_at_startup = health_monitor._last_success_at
        assert last_success_at_startup is not None
        await probes.run_probe("probe against the real database")
        last_success_after_probe = health_monitor._last_success_at
        assert last_success_after_probe is not None
        assert last_success_after_probe > last_success_at_startup
        assert (await httpx_client.get("/readyz")).status_code == 200
