import os
from pathlib import Path
from typing import Optional
from unittest.mock import patch

import pytest

import phoenix.client.utils.config as config_module
from phoenix.client.utils.config import (
    get_base_url,
    get_env_collector_endpoint,
    get_env_phoenix_api_key,
    get_env_project_name,
    getenv,
)


@pytest.mark.parametrize(
    "env,expected",
    [
        ({"PHOENIX_COLLECTOR_ENDPOINT": "http://localhost:6006"}, "http://localhost:6006"),
        ({"OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:6006"}, "http://localhost:6006"),
        (
            {
                "PHOENIX_COLLECTOR_ENDPOINT": "http://localhost:6006",
                "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
            },
            "http://localhost:6006",
        ),
        ({}, None),
    ],
)
def test_get_env_collector_endpoint(env: dict[str, str], expected: Optional[str]) -> None:
    with patch.dict(os.environ, env, clear=True):
        assert get_env_collector_endpoint() == expected


@pytest.mark.parametrize(
    "env, expected",
    [
        ({}, "default"),
        ({"PHOENIX_PROJECT": "canonical"}, "canonical"),
        ({"PHOENIX_PROJECT_NAME": "alias"}, "alias"),
        # PHOENIX_PROJECT takes precedence over the PHOENIX_PROJECT_NAME alias.
        ({"PHOENIX_PROJECT": "canonical", "PHOENIX_PROJECT_NAME": "alias"}, "canonical"),
        # Matching values are not a conflict.
        ({"PHOENIX_PROJECT": "same", "PHOENIX_PROJECT_NAME": "same"}, "same"),
    ],
)
def test_get_env_project_name(
    env: dict[str, str], expected: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(config_module, "_warned_project_conflict", False)
    with patch.dict(os.environ, env, clear=True):
        assert get_env_project_name() == expected


def test_get_env_project_name_warns_once_on_conflict(
    caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(config_module, "_warned_project_conflict", False)
    env = {"PHOENIX_PROJECT": "canonical", "PHOENIX_PROJECT_NAME": "alias"}
    with patch.dict(os.environ, env, clear=True):
        with caplog.at_level("WARNING"):
            assert get_env_project_name() == "canonical"
            assert get_env_project_name() == "canonical"
    warnings = [r for r in caplog.records if r.levelname == "WARNING"]
    assert len(warnings) == 1
    assert "PHOENIX_PROJECT_NAME" in warnings[0].message
    assert "PHOENIX_PROJECT" in warnings[0].message


class TestEnvFileDiscovery:
    """Tests for `.env.phoenix` credential file auto-discovery."""

    def test_file_value_used_when_env_unset(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_API_KEY=file-key\n")
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_phoenix_api_key() == "file-key"

    def test_process_env_wins_over_file(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_API_KEY=file-key\n")
        with patch.dict(os.environ, {"PHOENIX_API_KEY": "env-key"}, clear=True):
            assert get_env_phoenix_api_key() == "env-key"

    def test_walks_up_to_parent_directories(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_COLLECTOR_ENDPOINT=http://parent:6006\n")
        nested = tmp_path / "a" / "b"
        nested.mkdir(parents=True)
        monkeypatch.chdir(nested)
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_collector_endpoint() == "http://parent:6006"

    def test_nearest_file_wins(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_COLLECTOR_ENDPOINT=http://parent:6006\n")
        nested = tmp_path / "nested"
        nested.mkdir()
        (nested / ".env.phoenix").write_text("PHOENIX_COLLECTOR_ENDPOINT=http://nested:6006\n")
        monkeypatch.chdir(nested)
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_collector_endpoint() == "http://nested:6006"

    def test_otel_process_env_var_beats_file(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_COLLECTOR_ENDPOINT=http://from-file:6006\n")
        env = {"OTEL_EXPORTER_OTLP_ENDPOINT": "http://from-otel:4318"}
        with patch.dict(os.environ, env, clear=True):
            assert get_env_collector_endpoint() == "http://from-otel:4318"

    def test_process_host_beats_file_collector_endpoint(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_COLLECTOR_ENDPOINT=http://from-file:6006\n")
        with patch.dict(os.environ, {"PHOENIX_HOST": "process-host"}, clear=True):
            assert get_base_url() == "http://process-host:6006"
            assert get_env_collector_endpoint() is None

    def test_process_host_suppresses_file_port(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text(
            "PHOENIX_PORT=9999\nPHOENIX_COLLECTOR_ENDPOINT=http://from-file:6006\n"
        )
        with patch.dict(os.environ, {"PHOENIX_HOST": "process-host"}, clear=True):
            assert get_base_url() == "http://process-host:6006"

    def test_process_headers_suppress_file_api_key(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_API_KEY=file-key\n")
        with patch.dict(os.environ, {"PHOENIX_CLIENT_HEADERS": "x-custom=abc"}, clear=True):
            headers = config_module.get_env_client_headers()
            assert "authorization" not in [k.lower() for k in headers]
            assert get_env_phoenix_api_key() is None

    def test_warns_while_using_file_endpoint_with_process_credentials(
        self, tmp_path: Path, caplog: pytest.LogCaptureFixture
    ) -> None:
        env_file = tmp_path / ".env.phoenix"
        env_file.write_text("PHOENIX_HOST=file-host\n")
        env_file.chmod(0o600)
        with patch.dict(os.environ, {"PHOENIX_API_KEY": "secret-process-key"}, clear=True):
            with caplog.at_level("WARNING"):
                assert str(get_base_url()) == "http://file-host:6006"
                assert str(get_base_url()) == "http://file-host:6006"

        warnings = [record.message for record in caplog.records if record.levelname == "WARNING"]
        assert warnings == [
            f"Credentials from the process environment will be sent to PHOENIX_HOST set by {env_file}."
        ]
        assert "secret-process-key" not in warnings[0]

    def test_invalid_file_port_falls_back_to_default(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_PORT=not-a-port\n")
        with patch.dict(os.environ, {}, clear=True):
            assert config_module.get_env_port() == 6006
            assert get_base_url() == "http://127.0.0.1:6006"

    def test_invalid_file_endpoint_falls_back_to_default(
        self, tmp_path: Path, caplog: pytest.LogCaptureFixture
    ) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_COLLECTOR_ENDPOINT=http://x:bad\n")
        with patch.dict(os.environ, {}, clear=True):
            with caplog.at_level("WARNING"):
                assert get_env_collector_endpoint() is None
                assert get_base_url() == "http://127.0.0.1:6006"
        assert any(
            "Ignoring invalid PHOENIX_COLLECTOR_ENDPOINT" in record.message
            for record in caplog.records
        )

    def test_unavailable_working_directory_skips_discovery(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(Path, "cwd", lambda: (_ for _ in ()).throw(OSError()))
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_phoenix_api_key() is None

    def test_oversized_file_is_ignored(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_API_KEY=" + "x" * (64 * 1024))
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_phoenix_api_key() is None

    def test_invalid_process_port_still_raises(self) -> None:
        with patch.dict(os.environ, {"PHOENIX_PORT": "not-a-port"}, clear=True):
            with pytest.raises(ValueError):
                config_module.get_env_port()

    def test_clear_env_file_cache_picks_up_new_file(self, tmp_path: Path) -> None:
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_phoenix_api_key() is None
            (tmp_path / ".env.phoenix").write_text("PHOENIX_API_KEY=late-key\n")
            assert get_env_phoenix_api_key() is None
            config_module.clear_env_file_cache()
            assert get_env_phoenix_api_key() == "late-key"

    def test_process_project_alias_beats_file_canonical(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_PROJECT=file-project\n")
        with patch.dict(os.environ, {"PHOENIX_PROJECT_NAME": "process-project"}, clear=True):
            assert get_env_project_name() == "process-project"

    def test_non_phoenix_keys_ignored(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text(
            "OTEL_EXPORTER_OTLP_ENDPOINT=http://from-file:4318\n"
        )
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_collector_endpoint() is None

    @pytest.mark.parametrize("opt_out", ["false", "0", "no", "off", "FALSE", " False "])
    def test_discovery_can_be_disabled(self, tmp_path: Path, opt_out: str) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_API_KEY=file-key\n")
        with patch.dict(os.environ, {"PHOENIX_DISCOVER_CONFIG": opt_out}, clear=True):
            assert get_env_phoenix_api_key() is None

    def test_getenv_default_used_when_file_missing(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            assert getenv("PHOENIX_API_KEY") is None
            assert getenv("PHOENIX_API_KEY", "fallback") == "fallback"

    def test_getenv_file_value_beats_default(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text("PHOENIX_API_KEY=file-key\n")
        with patch.dict(os.environ, {}, clear=True):
            assert getenv("PHOENIX_API_KEY", "fallback") == "file-key"

    def test_file_supports_multiple_values(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_text(
            "PHOENIX_API_KEY=file-key\nPHOENIX_PROJECT=file-project\n"
        )
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_phoenix_api_key() == "file-key"
            assert get_env_project_name() == "file-project"
            headers = config_module.get_env_client_headers()
            assert headers == {"Authorization": "Bearer file-key"}

    def test_permission_warning_emitted_once(
        self,
        tmp_path: Path,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        if os.name != "posix":
            pytest.skip("POSIX permission bits are not meaningful on this platform")
        config_module.clear_env_file_cache()
        env_file = tmp_path / ".env.phoenix"
        env_file.write_text("PHOENIX_API_KEY=secret-value\n")
        env_file.chmod(0o644)
        with patch.dict(os.environ, {}, clear=True):
            with caplog.at_level("WARNING"):
                assert get_env_phoenix_api_key() == "secret-value"
                assert get_env_phoenix_api_key() == "secret-value"
        warnings = [r for r in caplog.records if r.levelname == "WARNING"]
        assert len(warnings) == 1
        assert "accessible by other users" in warnings[0].message
        # Hygiene: the credential value itself is never logged.
        assert "secret-value" not in warnings[0].message

    def test_no_permission_warning_for_owner_only_file(
        self,
        tmp_path: Path,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        if os.name != "posix":
            pytest.skip("POSIX permission bits are not meaningful on this platform")
        config_module.clear_env_file_cache()
        env_file = tmp_path / ".env.phoenix"
        env_file.write_text("PHOENIX_API_KEY=file-key\n")
        env_file.chmod(0o600)
        with patch.dict(os.environ, {}, clear=True):
            with caplog.at_level("WARNING"):
                assert get_env_phoenix_api_key() == "file-key"
        assert not [r for r in caplog.records if r.levelname == "WARNING"]

    def test_invalid_utf8_file_is_ignored(self, tmp_path: Path) -> None:
        (tmp_path / ".env.phoenix").write_bytes(b"PHOENIX_API_KEY=\xff\n")
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_phoenix_api_key() is None

    def test_file_owned_by_another_user_is_ignored(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        if not hasattr(os, "getuid"):
            pytest.skip("file ownership is not available on this platform")
        env_file = tmp_path / ".env.phoenix"
        env_file.write_text("PHOENIX_API_KEY=untrusted\n")
        real_stat = Path.stat

        def stat_with_foreign_owner(path: Path, *, follow_symlinks: bool = True) -> os.stat_result:
            stat = real_stat(path, follow_symlinks=follow_symlinks)
            if path == env_file:
                values = list(stat)
                values[4] = os.getuid() + 1
                return os.stat_result(values)
            return stat

        monkeypatch.setattr(Path, "stat", stat_with_foreign_owner)
        with patch.dict(os.environ, {}, clear=True):
            assert get_env_phoenix_api_key() is None


@pytest.mark.parametrize(
    "text, expected",
    [
        # Simple assignment
        ("PHOENIX_API_KEY=abc", {"PHOENIX_API_KEY": "abc"}),
        # Comments and blank lines are skipped
        ("# comment\n\nPHOENIX_API_KEY=abc\n", {"PHOENIX_API_KEY": "abc"}),
        # Optional export prefix
        ("export PHOENIX_API_KEY=abc", {"PHOENIX_API_KEY": "abc"}),
        # Quoted values are unwrapped
        ('PHOENIX_API_KEY="abc"', {"PHOENIX_API_KEY": "abc"}),
        ("PHOENIX_API_KEY='abc'", {"PHOENIX_API_KEY": "abc"}),
        # Whitespace around key and value is stripped
        ("  PHOENIX_API_KEY = abc  ", {"PHOENIX_API_KEY": "abc"}),
        # Values may contain '='
        ("PHOENIX_CLIENT_HEADERS=x=1,y=2", {"PHOENIX_CLIENT_HEADERS": "x=1,y=2"}),
        # Non-PHOENIX keys are ignored (allowlist)
        ("OTHER_KEY=abc\nPHOENIX_API_KEY=def", {"PHOENIX_API_KEY": "def"}),
        # Empty values are ignored
        ("PHOENIX_API_KEY=", {}),
        ("PHOENIX_API_KEY=''", {}),
        # Malformed lines are skipped
        ("PHOENIX_API_KEY", {}),
        ("PHOENIX BAD KEY=abc", {}),
    ],
)
def test_parse_env_file(text: str, expected: dict[str, str]) -> None:
    assert config_module._parse_env_file(text) == expected  # pyright: ignore[reportPrivateUsage]
