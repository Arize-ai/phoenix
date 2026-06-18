"""Unit tests for the Phoenix pytest plugin's pure logic (config, repo_info, gating)."""

from __future__ import annotations

from typing import Any

import pytest

from phoenix.client.pytest_plugin.config import PhoenixTestConfig, PhoenixTestConfigError
from phoenix.client.pytest_plugin.gating import _is_regression
from phoenix.client.pytest_plugin.repo_info import _sanitize_remote_url


class TestConfig:
    def test_defaults(self) -> None:
        cfg = PhoenixTestConfig.from_env({})
        assert cfg.tracking is True
        assert cfg.dry_run is False
        assert cfg.offline is False
        assert cfg.repetitions == 1
        assert cfg.gate_configured is False

    def test_tracking_false_is_offline(self) -> None:
        assert PhoenixTestConfig.from_env({"PHOENIX_TEST_TRACKING": "false"}).offline is True

    def test_dry_run_is_offline(self) -> None:
        assert PhoenixTestConfig.from_env({"PHOENIX_TEST_DRY_RUN": "1"}).offline is True

    def test_min_score_parse(self) -> None:
        cfg = PhoenixTestConfig.from_env({"PHOENIX_TEST_MIN_SCORE": "pass:0.9,faithfulness:0.8"})
        assert dict(cfg.min_score) == {"pass": 0.9, "faithfulness": 0.8}
        assert cfg.gate_configured is True

    def test_min_score_malformed_raises(self) -> None:
        with pytest.raises(PhoenixTestConfigError):
            PhoenixTestConfig.from_env({"PHOENIX_TEST_MIN_SCORE": "pass=0.9"})

    def test_repetitions_invalid_raises(self) -> None:
        with pytest.raises(PhoenixTestConfigError):
            PhoenixTestConfig.from_env({"PHOENIX_TEST_REPETITIONS": "zero"})

    def test_fail_on_regression(self) -> None:
        cfg = PhoenixTestConfig.from_env({"PHOENIX_TEST_FAIL_ON_REGRESSION": "true"})
        assert cfg.fail_on_regression is True
        assert cfg.gate_configured is True

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


class TestRegressionDirection:
    def _row(self, **kw: Any) -> dict[str, Any]:
        base = {
            "annotation_name": "pass",
            "num_improved": 0,
            "num_regressed": 0,
            "diff": 0.0,
            "optimization_direction": "maximize",
        }
        base.update(kw)
        return base

    def test_maximize_regression(self) -> None:
        # More regressed than improved AND mean dropped -> regression.
        assert _is_regression(self._row(num_regressed=3, num_improved=1, diff=-0.2)) is True

    def test_maximize_no_regression_when_improved(self) -> None:
        assert _is_regression(self._row(num_regressed=1, num_improved=3, diff=-0.2)) is False

    def test_maximize_no_regression_when_diff_positive(self) -> None:
        assert _is_regression(self._row(num_regressed=3, num_improved=1, diff=0.1)) is False

    def test_minimize_regression(self) -> None:
        # For minimize, a positive diff (score went up) with more regressed is a regression.
        assert (
            _is_regression(
                self._row(
                    num_regressed=3, num_improved=1, diff=0.2, optimization_direction="minimize"
                )
            )
            is True
        )

    def test_null_baseline_no_regression(self) -> None:
        assert _is_regression(self._row(num_regressed=None, num_improved=None, diff=None)) is False
