"""Unit tests for the Phoenix pytest plugin's pure config logic."""

from __future__ import annotations

import pytest

from phoenix.client.pytest_plugin.config import PhoenixTestConfig, PhoenixTestConfigError


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
