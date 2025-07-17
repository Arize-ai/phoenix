from secrets import token_hex
from typing import Iterator, Mapping

import pytest
from phoenix.client import Client
from strawberry.relay import GlobalID

from .._helpers import (
    _AppInfo,
    _ExistingProject,
    _ExistingSpan,
    _insert_spans,
    _server,
)


@pytest.fixture(scope="package")
def _env(
    _env_ports: Mapping[str, str],
    _env_database: Mapping[str, str],
    _env_auth: Mapping[str, str],
    _env_smtp: Mapping[str, str],
) -> dict[str, str]:
    """Combine all environment variable configurations for testing."""
    return {
        **_env_ports,
        **_env_database,
        **_env_auth,
        **_env_smtp,
    }


@pytest.fixture(scope="package")
def _app(
    _env: dict[str, str],
) -> Iterator[_AppInfo]:
    with _server(_AppInfo(_env)) as app:
        yield app


@pytest.fixture(scope="package")
def _existing_spans(
    _app: _AppInfo,
) -> tuple[_ExistingSpan, ...]:
    return _insert_spans(_app, 102)


@pytest.fixture(scope="function")
def _existing_project(
    _app: _AppInfo,
) -> _ExistingProject:
    project = Client(
        base_url=_app.base_url,
        api_key=_app.admin_secret,
    ).projects.create(name=token_hex(16))
    return _ExistingProject(
        id=GlobalID.from_id(project["id"]),
        name=project["name"],
    )
