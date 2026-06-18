"""Unit tests for the Phoenix pytest plugin's pure logic (config, repo_info)."""

from __future__ import annotations

import pytest

from phoenix.client.pytest_plugin.config import PhoenixTestConfig, PhoenixTestConfigError
from phoenix.client.pytest_plugin.repo_info import _sanitize_remote_url


class TestConfig:
    def test_defaults(self) -> None:
        cfg = PhoenixTestConfig.from_env({})
        assert cfg.tracking is True
        assert cfg.dry_run is False
        assert cfg.offline is False
        assert cfg.repetitions == 1

    def test_tracking_false_is_offline(self) -> None:
        assert PhoenixTestConfig.from_env({"PHOENIX_TEST_TRACKING": "false"}).offline is True

    def test_dry_run_is_offline(self) -> None:
        assert PhoenixTestConfig.from_env({"PHOENIX_TEST_DRY_RUN": "1"}).offline is True

    def test_repetitions_invalid_raises(self) -> None:
        with pytest.raises(PhoenixTestConfigError):
            PhoenixTestConfig.from_env({"PHOENIX_TEST_REPETITIONS": "zero"})

    def test_repo_info_disable(self) -> None:
        assert PhoenixTestConfig.from_env(
            {"PHOENIX_TEST_REPO_INFO": "false"}
        ).collect_repo_info is (False)


class TestSanitizeRemoteUrl:
    def test_strips_credentials(self) -> None:
        assert (
            _sanitize_remote_url("https://user:token@github.com/o/r.git")
            == "https://github.com/o/r.git"
        )

    def test_scp_passthrough(self) -> None:
        assert _sanitize_remote_url("git@github.com:o/r.git") == "git@github.com:o/r.git"

    def test_clean_https_passthrough(self) -> None:
        assert _sanitize_remote_url("https://github.com/o/r.git") == "https://github.com/o/r.git"

    def test_none(self) -> None:
        assert _sanitize_remote_url(None) is None
