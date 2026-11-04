from typing import Any

import pytest
from starlette.testclient import TestClient

from phoenix.experimental.datagen.control import (
    ReplayControl,
    ReplaySettings,
    create_control_app,
)
from phoenix.server.cli.commands.datagen import _replay


def _control(**overrides: Any) -> ReplayControl:
    return ReplayControl(ReplaySettings(rate=12.0, burstiness=0.5), **overrides)


class _Stop(Exception):
    pass


class _FakeReplayer:
    def __init__(self) -> None:
        self.emitted = 0

    def emit(self) -> str:
        self.emitted += 1
        return "request"

    def interarrival_seconds(self, *, rate: float, burstiness: float) -> float:
        return 60.0 / rate


class _FakeExporter:
    def __init__(self, delivered: bool = True) -> None:
        self.delivered = delivered

    def export(self, request: object) -> bool:
        return self.delivered


class TestReplayControl:
    def test_update_changes_settings_and_version(self) -> None:
        control = _control()
        settings = control.update(rate=30, paused=True)
        assert settings == ReplaySettings(rate=30.0, burstiness=0.5, paused=True)
        assert control.version == 1

    def test_unchanged_update_keeps_version(self) -> None:
        control = _control()
        control.update(rate=12)
        assert control.version == 0

    @pytest.mark.parametrize("changes", [{"rate": 0}, {"rate": -1}, {"burstiness": -0.1}], ids=str)
    def test_invalid_update_is_rejected_and_not_applied(self, changes: dict[str, Any]) -> None:
        control = _control()
        with pytest.raises(ValueError):
            control.update(**changes)
        assert control.settings() == ReplaySettings(rate=12.0, burstiness=0.5)

    def test_pending_sends_accumulate_and_reset(self) -> None:
        control = _control()
        control.request_sends(3)
        control.request_sends(2)
        assert control.take_pending_sends() == 5
        assert control.take_pending_sends() == 0

    @pytest.mark.parametrize("count", [0, 1001])
    def test_send_count_is_bounded(self, count: int) -> None:
        with pytest.raises(ValueError):
            _control().request_sends(count)

    def test_measured_rate_counts_deliveries_in_the_last_minute(self) -> None:
        now = [0.0]
        control = _control(clock=lambda: now[0])
        for _ in range(3):
            control.record_export(True)
        control.record_export(False)
        assert control.snapshot()["measured_rate"] == 3.0
        now[0] = 61.0
        snapshot = control.snapshot()
        assert snapshot["measured_rate"] == 0.0
        assert (snapshot["sent"], snapshot["failed"]) == (3, 1)

    def test_change_wakes_a_waiting_loop(self) -> None:
        control = _control()
        control.update(rate=60)
        assert control.wait(5.0) is True
        assert control.wait(0.01) is False


class TestControlApp:
    @pytest.fixture
    def control(self) -> ReplayControl:
        return _control(project_names=("demo",))

    @pytest.fixture
    def client(self, control: ReplayControl) -> TestClient:
        return TestClient(create_control_app(control))

    def test_page_is_served_at_the_root(self, client: TestClient) -> None:
        response = client.get("/")
        assert response.status_code == 200
        assert "Datagen Control" in response.text

    def test_get_state(self, client: TestClient) -> None:
        state = client.get("/api/state").json()
        assert state["rate"] == 12.0
        assert state["phase"] == "seeding"
        assert state["projects"] == ["demo"]

    def test_patch_state_applies_changes(self, client: TestClient, control: ReplayControl) -> None:
        response = client.patch("/api/state", json={"rate": 120, "paused": True})
        assert response.status_code == 200
        assert response.json()["rate"] == 120.0
        assert control.settings().paused is True

    @pytest.mark.parametrize(
        "body",
        [
            {"rate": 0},
            {"rate": "fast"},
            {"rate": True},
            {"paused": "yes"},
            {"project": "other"},
            ["rate"],
        ],
        ids=str,
    )
    def test_patch_state_rejects_invalid_bodies(
        self, client: TestClient, control: ReplayControl, body: object
    ) -> None:
        response = client.patch("/api/state", json=body)
        assert response.status_code == 400
        assert control.settings() == ReplaySettings(rate=12.0, burstiness=0.5)

    def test_send_queues_traces(self, client: TestClient, control: ReplayControl) -> None:
        response = client.post("/api/send?n=4")
        assert response.status_code == 200
        assert response.json()["pending_sends"] == 4
        assert client.post("/api/send?n=abc").status_code == 400


class TestReplayLoop:
    def test_rate_change_redraws_the_pending_delay(self) -> None:
        control = _control()
        replayer = _FakeReplayer()
        waits: list[int] = []

        def wait(timeout: float) -> bool:
            waits.append(round(timeout))
            if len(waits) == 1:
                control.update(rate=60)  # 5s delay at 12/min becomes 1s at 60/min
                return True
            raise _Stop

        control.wait = wait  # type: ignore[method-assign]
        with pytest.raises(_Stop):
            _replay(replayer, _FakeExporter(), control)
        assert waits == [5, 1]
        assert replayer.emitted == 1

    def test_requested_sends_go_out_without_waiting_for_the_schedule(self) -> None:
        control = _control()
        replayer = _FakeReplayer()
        control.request_sends(3)
        waits: list[int] = []

        def wait(timeout: float) -> bool:
            waits.append(round(timeout))
            raise _Stop

        control.wait = wait  # type: ignore[method-assign]
        with pytest.raises(_Stop):
            _replay(replayer, _FakeExporter(), control)
        assert replayer.emitted == 4  # three requested, then the scheduled first trace
        assert control.snapshot()["sent"] == 4
        assert waits == [5]

    def test_paused_loop_exports_nothing(self) -> None:
        control = _control()
        control.update(paused=True)
        replayer = _FakeReplayer()
        waits: list[float] = []

        def wait(timeout: float) -> bool:
            waits.append(timeout)
            if len(waits) == 2:
                raise _Stop
            return False

        control.wait = wait  # type: ignore[method-assign]
        with pytest.raises(_Stop):
            _replay(replayer, _FakeExporter(delivered=False), control)
        assert replayer.emitted == 0
        assert waits == [1.0, 1.0]

    def test_failed_exports_are_counted(self) -> None:
        control = _control()

        def wait(timeout: float) -> bool:
            raise _Stop

        control.wait = wait  # type: ignore[method-assign]
        with pytest.raises(_Stop):
            _replay(_FakeReplayer(), _FakeExporter(delivered=False), control)
        assert (control.snapshot()["sent"], control.snapshot()["failed"]) == (0, 1)


def test_metrics_exposes_counts_and_settings() -> None:
    control = _control()
    control.record_export(True)
    control.record_export(True)
    control.record_export(False)
    control.update(rate=30, paused=True)
    control.set_phase("replaying")
    response = TestClient(create_control_app(control)).get("/metrics")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    samples = {
        line.split()[0]: float(line.split()[1])
        for line in response.text.splitlines()
        if line and not line.startswith("#")
    }
    assert samples == {
        "phoenix_datagen_traces_sent_total": 2,
        "phoenix_datagen_traces_failed_total": 1,
        "phoenix_datagen_rate_traces_per_minute": 30,
        "phoenix_datagen_burstiness": 0.5,
        "phoenix_datagen_paused": 1,
        "phoenix_datagen_seeding": 0,
    }
    assert "# TYPE phoenix_datagen_traces_sent_total counter" in response.text
