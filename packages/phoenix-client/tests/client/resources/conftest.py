from collections.abc import Iterator
from unittest.mock import AsyncMock, patch

import pytest


@pytest.fixture(autouse=True)
def _skip_server_version_check() -> Iterator[None]:
    """Bypass server-version gating in unit tests."""
    with (
        patch(
            "phoenix.client.utils.server_requirements.ServerVersionGuard.require",
            return_value=None,
        ),
        patch(
            "phoenix.client.utils.server_requirements.AsyncServerVersionGuard.require",
            new=AsyncMock(return_value=None),
        ),
    ):
        yield
