import os
from typing import Optional
from unittest.mock import patch
from urllib.parse import urlparse

import pytest

import phoenix.otel.settings as settings_module
from phoenix.otel.otel import _construct_http_endpoint
from phoenix.otel.settings import (
    get_env_collector_endpoint,
    get_env_project_name,
    parse_env_headers,
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
    "endpoint, expected",
    [
        ("http://localhost:6006", "http://localhost:6006/v1/traces"),
        ("http://localhost:6006/v1/traces", "http://localhost:6006/v1/traces"),
        ("http://localhost:6006/prefix/v1/traces", "http://localhost:6006/prefix/v1/traces"),
    ],
)
def test_construct_http_endpoint(endpoint: str, expected: str) -> None:
    parsed = urlparse(endpoint)
    result = _construct_http_endpoint(parsed)
    assert result.geturl() == expected


@pytest.mark.parametrize(
    "headers, expected",
    [
        ("x=a,y=b", {"x": "a", "y": "b"}),
        # Malformed segment without "=" is skipped rather than crashing
        ("Authorization", {}),
        # Mixed valid/invalid: valid entries are kept, invalid ones skipped
        ("x=a,bad", {"x": "a"}),
    ],
)
def test_parse_env_headers_skips_malformed_segments(headers: str, expected: dict[str, str]) -> None:
    assert parse_env_headers(headers) == expected


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
    monkeypatch.setattr(settings_module, "_warned_project_conflict", False)
    with patch.dict(os.environ, env, clear=True):
        assert get_env_project_name() == expected


def test_get_env_project_name_warns_once_on_conflict(
    caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings_module, "_warned_project_conflict", False)
    env = {"PHOENIX_PROJECT": "canonical", "PHOENIX_PROJECT_NAME": "alias"}
    with patch.dict(os.environ, env, clear=True):
        with caplog.at_level("WARNING"):
            assert get_env_project_name() == "canonical"
            assert get_env_project_name() == "canonical"
    warnings = [r for r in caplog.records if r.levelname == "WARNING"]
    assert len(warnings) == 1
    assert "PHOENIX_PROJECT_NAME" in warnings[0].message
    assert "PHOENIX_PROJECT" in warnings[0].message
