from collections.abc import Iterator
from unittest.mock import AsyncMock, patch

import pytest

REAL_SERVER_VERSION_CHECK = "real_server_version_check"


@pytest.fixture(autouse=True)
def _skip_server_version_check(request: pytest.FixtureRequest) -> Iterator[None]:
    """Bypass server-version gating in unit tests unless a test opts into the real check."""
    if request.node.get_closest_marker(REAL_SERVER_VERSION_CHECK):
        yield
        return
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
