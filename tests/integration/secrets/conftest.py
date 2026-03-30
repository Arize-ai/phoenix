from __future__ import annotations

from typing import Iterator, Mapping

import pytest

from .._helpers import _AppInfo, _server


@pytest.fixture(scope="package")
def _env(
    _env_ports: Mapping[str, str],
    _env_database: Mapping[str, str],
    _env_auth: Mapping[str, str],
) -> dict[str, str]:
    """Combine environment variable configurations for secrets testing."""
    return {
        **_env_ports,
        **_env_database,
        **_env_auth,
    }


@pytest.fixture(scope="package")
def _app(
    _env: dict[str, str],
) -> Iterator[_AppInfo]:
    with _server(_AppInfo(_env)) as app:
        yield app
