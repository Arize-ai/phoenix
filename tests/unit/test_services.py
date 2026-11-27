import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock

from _pytest.monkeypatch import MonkeyPatch

from phoenix.config import ENV_PHOENIX_HOST
from phoenix.services import AppService, Service


def test_app_service_command_and_environment(monkeypatch: MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_popen(command: list[str], **kwargs: object) -> MagicMock:
        captured["command"] = command
        captured["env"] = kwargs["env"]
        return MagicMock()

    monkeypatch.setenv(ENV_PHOENIX_HOST, "127.0.0.1")
    monkeypatch.setattr("phoenix.services.psutil.Popen", fake_popen)
    monkeypatch.setattr("phoenix.services.get_running_pid", lambda: None)
    monkeypatch.setattr(Service, "_wait_until", lambda self, *args, **kwargs: None)

    AppService(
        database_url="sqlite:///phoenix.db",
        host="0.0.0.0",
        port=6006,
        root_path="",
    )

    command = captured["command"]
    assert isinstance(command, list)
    assert "--host" not in command
    serve_index = command.index("serve")
    assert serve_index < command.index("--database-url")
    assert serve_index < command.index("--port")
    assert command[command.index("--database-url") + 1] == "sqlite:///phoenix.db"
    assert command[command.index("--port") + 1] == "6006"

    env = captured["env"]
    assert isinstance(env, dict)
    assert env[ENV_PHOENIX_HOST] == "0.0.0.0"


def test_stop_any_force_kills_recorded_pids(tmp_path: Path, monkeypatch: MonkeyPatch) -> None:
    sleeping_child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    pid_file = tmp_path / str(sleeping_child.pid)
    pid_file.touch()
    monkeypatch.setattr("phoenix.services.get_pids_path", lambda: tmp_path)
    try:
        Service.stop_any()
        # wait() raises TimeoutExpired if stop_any left the process running.
        sleeping_child.wait(timeout=10)
        assert not pid_file.exists()
    finally:
        if sleeping_child.poll() is None:
            sleeping_child.kill()
            sleeping_child.wait()
