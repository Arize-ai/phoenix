import os
from typing import Optional
from unittest.mock import patch

import pytest

import phoenix.client.utils.config as config_module
from phoenix.client.utils.config import get_env_collector_endpoint, get_env_project_name


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
        ({"PHOENIX_PROJECT_NAME": "canonical"}, "canonical"),
        ({"PHOENIX_PROJECT": "alias"}, "alias"),
        # PHOENIX_PROJECT_NAME takes precedence over the PHOENIX_PROJECT alias.
        ({"PHOENIX_PROJECT_NAME": "canonical", "PHOENIX_PROJECT": "alias"}, "canonical"),
        # Matching values are not a conflict.
        ({"PHOENIX_PROJECT_NAME": "same", "PHOENIX_PROJECT": "same"}, "same"),
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
    env = {"PHOENIX_PROJECT_NAME": "canonical", "PHOENIX_PROJECT": "alias"}
    with patch.dict(os.environ, env, clear=True):
        with caplog.at_level("WARNING"):
            assert get_env_project_name() == "canonical"
            assert get_env_project_name() == "canonical"
    warnings = [r for r in caplog.records if r.levelname == "WARNING"]
    assert len(warnings) == 1
    assert "PHOENIX_PROJECT_NAME" in warnings[0].message
    assert "PHOENIX_PROJECT" in warnings[0].message
