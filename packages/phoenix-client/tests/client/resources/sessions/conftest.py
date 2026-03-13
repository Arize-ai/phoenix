from collections.abc import Generator
from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _skip_server_version_check() -> Generator[None]:
    """Bypass server-version gating in unit tests."""
    with (
        patch(
            "phoenix.client.resources.sessions.ensure_server_capability",
            return_value=None,
        ),
        patch(
            "phoenix.client.resources.sessions.async_ensure_server_capability",
            return_value=None,
        ),
        patch(
            "phoenix.client.resources.spans.ensure_server_capability",
            return_value=None,
        ),
        patch(
            "phoenix.client.resources.spans.async_ensure_server_capability",
            return_value=None,
        ),
    ):
        yield
