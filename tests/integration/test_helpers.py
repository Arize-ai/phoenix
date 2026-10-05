from __future__ import annotations

import sqlite3
import sys
import time
from contextlib import nullcontext
from io import StringIO
from pathlib import Path
from ssl import SSLContext
from typing import Any, Callable, Optional, cast

import pytest
from psutil import NoSuchProcess, Popen
from sqlalchemy import make_url

from . import _helpers
from .auth.conftest import _isolated_database, _oauth2_app_env


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


def _ready(
    url: str,
    *,
    context: Optional[SSLContext] = None,
    timeout: Optional[float] = None,
) -> Any:
    return nullcontext()


def _mock_server(
    monkeypatch: pytest.MonkeyPatch,
    process: _Process,
    *,
    alive: bool,
    health_check: Callable[..., Any],
) -> None:
    def _process_factory(*args: Any, **kwargs: Any) -> _Process:
        return process

    def _process_is_alive(process: Popen) -> bool:
        return alive

    def _sleep(duration: float) -> None:
        pass

    monkeypatch.setattr(_helpers, "Popen", _process_factory)
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
    elapsed = [0.0]

    def _not_ready_after_deadline(
        url: str,
        *,
        context: Optional[SSLContext] = None,
        timeout: Optional[float] = None,
    ) -> None:
        assert timeout is not None and 0 < timeout <= 1
        elapsed[0] = 61.0
        raise OSError("not ready")

    _mock_server(
        monkeypatch,
        process,
        alive=True,
        health_check=_not_ready_after_deadline,
    )
    monkeypatch.setattr(_helpers, "monotonic", lambda: elapsed[0])

    with pytest.raises(TimeoutError, match="did not start"):
        with _helpers._server(_app()):
            pass

    assert process.killed
    assert process.waited


def test_server_does_not_suppress_keyboard_interrupt_during_startup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    process = _Process()

    def _interrupt(
        url: str,
        *,
        context: Optional[SSLContext] = None,
        timeout: Optional[float] = None,
    ) -> None:
        raise KeyboardInterrupt

    _mock_server(monkeypatch, process, alive=True, health_check=_interrupt)

    with pytest.raises(KeyboardInterrupt):
        with _helpers._server(_app()):
            pass

    assert process.killed
    assert process.waited


def test_server_kills_real_subprocess_and_captures_its_output(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    ready_file = tmp_path / "child-ready"
    script = (
        "from pathlib import Path; import time; "
        "print('subprocess log marker', flush=True); "
        f"Path({str(ready_file)!r}).write_text('ready'); "
        "time.sleep(30)"
    )
    real_popen = cast(Callable[..., Popen], getattr(_helpers, "Popen"))
    processes: list[Popen] = []

    def _launch_child(*args: Any, **kwargs: Any) -> Popen:
        process = real_popen([sys.executable, "-c", script], **kwargs)
        processes.append(process)
        return process

    monkeypatch.setattr(_helpers, "Popen", _launch_child)
    monkeypatch.setattr(_helpers, "urlopen", _ready)

    with pytest.raises(RuntimeError, match="test failure"):
        with _helpers._server(_app()):
            deadline = time.monotonic() + 5
            while not ready_file.exists() and time.monotonic() < deadline:
                time.sleep(0.01)
            assert ready_file.exists()
            raise RuntimeError("test failure")

    assert processes
    assert processes[0].poll() is not None
    assert "subprocess log marker" in capsys.readouterr().out


def test_server_waits_for_process_that_exited_during_startup(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    process = _Process(returncode=1)
    process.stdout = StringIO("buffered startup output\n")
    _mock_server(monkeypatch, process, alive=False, health_check=_ready)

    with pytest.raises(AssertionError):
        with _helpers._server(_app()):
            pass

    assert not process.killed
    assert process.waited
    assert "buffered startup output" in capsys.readouterr().out


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


def test_seed_lookup_does_not_create_a_missing_seed(tmp_path: Path) -> None:
    database = tmp_path / "empty-seed.db"
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE deployment_secret (id INTEGER PRIMARY KEY, seed BLOB)")

    with pytest.raises(AssertionError):
        _helpers._load_deployment_seed(f"sqlite:///{database}", "")

    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT COUNT(*) FROM deployment_secret").fetchone() == (0,)


def test_isolated_sqlite_databases_are_file_backed_and_distinct(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    baseline = {"PHOENIX_SQL_DATABASE_URL": "sqlite:///:memory:"}
    with _isolated_database(baseline, tmp_path_factory, "auth-app") as first:
        with _isolated_database(baseline, tmp_path_factory, "auth-app") as second:
            first_database = make_url(first["PHOENIX_SQL_DATABASE_URL"]).database
            second_database = make_url(second["PHOENIX_SQL_DATABASE_URL"]).database
            assert first_database is not None and Path(first_database).is_absolute()
            assert second_database is not None and Path(second_database).is_absolute()
            assert first["PHOENIX_SQL_DATABASE_URL"] != second["PHOENIX_SQL_DATABASE_URL"]


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
