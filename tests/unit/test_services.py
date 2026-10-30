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
