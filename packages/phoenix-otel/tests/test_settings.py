import os
from typing import Optional
from unittest.mock import patch
from urllib.parse import urlparse

import pytest

from phoenix.otel.otel import _construct_http_endpoint
from phoenix.otel.settings import get_env_collector_endpoint, parse_env_headers


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
