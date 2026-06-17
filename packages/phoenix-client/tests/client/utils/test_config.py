import os
from typing import Optional
from unittest.mock import patch

import pytest

from phoenix.client.utils.config import get_base_url, get_env_collector_endpoint


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


def test_get_base_url_includes_host_root_path() -> None:
    env = {
        "PHOENIX_HOST": "example.com",
        "PHOENIX_PORT": "6006",
        "PHOENIX_HOST_ROOT_PATH": "/phoenix",
    }
    with patch.dict(os.environ, env, clear=True):
        assert str(get_base_url()) == "http://example.com:6006/phoenix"


def test_get_base_url_keeps_collector_endpoint_precedence_over_host_root_path() -> None:
    env = {
        "PHOENIX_COLLECTOR_ENDPOINT": "http://collector.example.com",
        "PHOENIX_HOST_ROOT_PATH": "/phoenix",
    }
    with patch.dict(os.environ, env, clear=True):
        assert str(get_base_url()) == "http://collector.example.com"
