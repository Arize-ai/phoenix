import os
from pathlib import Path
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


@pytest.mark.parametrize(
    "env,expected",
    [
        (
            {"PHOENIX_COLLECTOR_ENDPOINT": "http://localhost:6006"},
            "http://localhost:6006",
        ),
        (
            {
                "PHOENIX_COLLECTOR_ENDPOINT": "http://localhost:6006",
                "PHOENIX_HOST_ROOT_PATH": "/phoenix",
            },
            "http://localhost:6006/phoenix",
        ),
        (
            {
                "PHOENIX_COLLECTOR_ENDPOINT": "http://localhost:6006/",
                "PHOENIX_HOST_ROOT_PATH": "/phoenix",
            },
            "http://localhost:6006/phoenix",
        ),
        (
            {"PHOENIX_HOST": "127.0.0.1", "PHOENIX_PORT": "6006"},
            "http://127.0.0.1:6006",
        ),
        (
            {
                "PHOENIX_HOST": "127.0.0.1",
                "PHOENIX_PORT": "6006",
                "PHOENIX_HOST_ROOT_PATH": "/phoenix",
            },
            "http://127.0.0.1:6006/phoenix",
        ),
    ],
)
def test_get_base_url(env: dict[str, str], expected: str) -> None:
    with patch.dict(os.environ, env, clear=True):
        assert str(get_base_url()) == expected
