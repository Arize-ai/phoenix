import os

import pytest

from phoenix.utilities.env_vars import without_env_vars


class TestWithoutEnvVars:
    def test_removes_and_restores_variable(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("TEST_VAR", "original")
        with without_env_vars("TEST_VAR"):
            assert "TEST_VAR" not in os.environ
        assert os.environ["TEST_VAR"] == "original"

    def test_handles_multiple_and_nonexistent_keys(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("VAR_A", "a")
        monkeypatch.setenv("VAR_B", "b")
        with without_env_vars("VAR_A", "VAR_B", "NONEXISTENT"):
            assert "VAR_A" not in os.environ
            assert "VAR_B" not in os.environ
        assert os.environ["VAR_A"] == "a"
        assert os.environ["VAR_B"] == "b"

    def test_restores_on_exception(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("TEST_VAR", "value")
        with pytest.raises(RuntimeError):
            with without_env_vars("TEST_VAR"):
                raise RuntimeError("test")
        assert os.environ["TEST_VAR"] == "value"

    def test_glob_pattern_matching(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PREFIX_A", "a")
        monkeypatch.setenv("PREFIX_B", "b")
        monkeypatch.setenv("OTHER_VAR", "other")
        with without_env_vars("PREFIX_*"):
            assert "PREFIX_A" not in os.environ
            assert "PREFIX_B" not in os.environ
            assert os.environ["OTHER_VAR"] == "other"
        assert os.environ["PREFIX_A"] == "a"
        assert os.environ["PREFIX_B"] == "b"

    def test_respects_in_context_modifications(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("MY_VAR", "original")
        with without_env_vars("MY_VAR"):
            assert "MY_VAR" not in os.environ
            os.environ["MY_VAR"] = "modified"
        assert os.environ["MY_VAR"] == "modified"
