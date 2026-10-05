from __future__ import annotations

from io import StringIO
from ssl import SSLContext
from typing import Any, Callable, Optional, cast

import pytest
from psutil import NoSuchProcess, Popen

from . import _helpers
from .auth.conftest import _oauth2_app_env


class _Process:
    def __init__(self, returncode: Optional[int] = None) -> None:
        self.returncode = returncode
        self.stdout = StringIO()
        self.killed = False
        self.waited = False

    def poll(self) -> Optional[int]:
        return self.returncode

    def kill(self) -> None:
        self.killed = True
        self.returncode = -9

    def wait(self, timeout: Optional[float] = None) -> int:
        self.waited = True
        if self.returncode is None:
            self.returncode = -9
        return self.returncode


class _NoStartThread:
    def __init__(
        self,
        *,
        target: Callable[..., Any],
        args: tuple[Any, ...] = (),
        daemon: Optional[bool] = None,
    ) -> None:
        pass

    def start(self) -> None:
        pass


def _ready(url: str, *, context: Optional[SSLContext] = None) -> None:
    pass


def _not_ready(url: str, *, context: Optional[SSLContext] = None) -> None:
    raise OSError("not ready")


def _mock_server(
    monkeypatch: pytest.MonkeyPatch,
    process: _Process,
    *,
    alive: bool,
    health_check: Callable[[str], None],
) -> None:
    def _process_factory(*args: Any, **kwargs: Any) -> _Process:
        return process

    def _process_is_alive(process: Popen) -> bool:
        return alive

    def _sleep(duration: float) -> None:
        pass

    monkeypatch.setattr(_helpers, "Popen", _process_factory)
    monkeypatch.setattr(_helpers, "Thread", _NoStartThread)
    monkeypatch.setattr(_helpers, "_is_alive", _process_is_alive)
    monkeypatch.setattr(_helpers, "sleep", _sleep)
    monkeypatch.setattr(_helpers, "urlopen", health_check)


def _app() -> _helpers._AppInfo:
    return _helpers._AppInfo({"PHOENIX_SQL_DATABASE_URL": "sqlite:///test.db"})


def test_server_kills_process_when_context_body_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    process = _Process()
    _mock_server(monkeypatch, process, alive=True, health_check=_ready)

    with pytest.raises(RuntimeError, match="test failure"):
        with _helpers._server(_app()):
            raise RuntimeError("test failure")

    assert process.killed
    assert process.waited


def test_server_kills_process_when_startup_times_out(monkeypatch: pytest.MonkeyPatch) -> None:
    process = _Process()
    _mock_server(
        monkeypatch,
        process,
        alive=True,
        health_check=_not_ready,
    )
    times = iter((0, 61))
    monkeypatch.setattr(_helpers, "time", lambda: next(times))

    with pytest.raises(TimeoutError, match="did not start"):
        with _helpers._server(_app()):
            pass

    assert process.killed
    assert process.waited


def test_server_waits_for_process_that_exited_during_startup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    process = _Process(returncode=1)
    _mock_server(monkeypatch, process, alive=False, health_check=_ready)

    with pytest.raises(AssertionError):
        with _helpers._server(_app()):
            pass

    assert not process.killed
    assert process.waited


def test_is_alive_handles_process_exit_during_status_check() -> None:
    class _ExitedProcess:
        def is_running(self) -> bool:
            return True

        def status(self) -> str:
            raise NoSuchProcess(pid=1)

    assert not _helpers._is_alive(cast(Any, _ExitedProcess()))


def test_app_default_admin_uses_its_own_required_password() -> None:
    first_app = _helpers._AppInfo({"PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD": "first-password"})
    second_app = _helpers._AppInfo({"PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD": "second-password"})

    assert first_app.default_admin.password == "first-password"
    assert second_app.default_admin.password == "second-password"
    with pytest.raises(KeyError, match="PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD"):
        _helpers._AppInfo({}).default_admin


@pytest.mark.parametrize("secret_configuration", ("configured", "absent"))
def test_oauth2_app_environment_includes_default_admin_password(secret_configuration: str) -> None:
    env = _oauth2_app_env(
        port=6006,
        grpc_port=4317,
        database="test.db",
        extra={},
        secret_configuration=secret_configuration,
    )

    assert env["PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD"]
    assert (
        _helpers._AppInfo(env).default_admin.password
        == env["PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD"]
    )
    assert ("PHOENIX_SECRET" in env) is (secret_configuration == "configured")
    assert ("PHOENIX_ADMIN_SECRET" in env) is (secret_configuration == "configured")
