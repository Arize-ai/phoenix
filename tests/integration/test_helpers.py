from __future__ import annotations

import sys
import time
from contextlib import nullcontext
from io import StringIO
from pathlib import Path
from ssl import SSLContext
from typing import Any, Callable, Optional, cast

import pytest
from psutil import NoSuchProcess, Popen

from . import _helpers


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
