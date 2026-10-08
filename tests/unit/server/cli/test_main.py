import sys

import pytest

from phoenix.server import main as main_module


@pytest.fixture(autouse=True)
def _skip_global_setup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main_module, "initialize_settings", lambda: None)
    monkeypatch.setattr(main_module, "setup_logging", lambda: None)


def test_no_args_prints_help_and_exits_cleanly(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["phoenix"])
    main_module.main()
    out = capsys.readouterr().out
    assert out.startswith("usage: phoenix")
    assert "serve" in out
    assert "db" in out


def test_help_hides_internal_commands(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["phoenix", "--help"])
    with pytest.raises(SystemExit) as exc_info:
        main_module.main()
    assert exc_info.value.code == 0
    out = capsys.readouterr().out
    assert "datagen" not in out
    assert "trace-fixture" not in out
    assert "SUPPRESS" not in out


def test_db_help_lists_migrate(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["phoenix", "db", "--help"])
    with pytest.raises(SystemExit) as exc_info:
        main_module.main()
    assert exc_info.value.code == 0
    assert "migrate" in capsys.readouterr().out


def test_db_without_subcommand_prints_help_and_exits_cleanly(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(sys, "argv", ["phoenix", "db"])
    main_module.main()
    out = capsys.readouterr().out
    assert out.startswith("usage: phoenix db")
    assert "migrate" in out
