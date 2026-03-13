from collections.abc import Generator
from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _skip_server_version_check() -> Generator[None, None, None]:
    """Bypass server-version gating in unit tests."""
    with (
        patch(
            "phoenix.client.utils.server_version_utils.ensure_server_capability",
            return_value=None,
        ),
        patch(
            "phoenix.client.utils.server_version_utils.async_ensure_server_capability",
            return_value=None,
        ),
    ):
        yield
