import os
from contextlib import ExitStack
from typing import Iterator
from unittest import mock

import pytest
from _pytest.fixtures import SubRequest
from _pytest.tmpdir import TempPathFactory
from faker import Faker
from phoenix.config import (
    ENV_PHOENIX_GRPC_PORT,
    ENV_PHOENIX_PORT,
    ENV_PHOENIX_SQL_DATABASE_SCHEMA,
    ENV_PHOENIX_SQL_DATABASE_URL,
    ENV_PHOENIX_WORKING_DIR,
)
from portpicker import pick_unused_port  # type: ignore[import-untyped]
from sqlalchemy import URL, make_url

from ._helpers import (
    _grpc_span_exporter,
    _http_span_exporter,
    _random_schema,
    _SpanExporterConstructor,
)


@pytest.fixture(scope="class")
def _fake() -> Faker:
    return Faker()


@pytest.fixture(autouse=True, scope="class")
def _env(tmp_path_factory: TempPathFactory) -> Iterator[None]:
    tmp = tmp_path_factory.getbasetemp()
    values = (
        (ENV_PHOENIX_PORT, str(pick_unused_port())),
        (ENV_PHOENIX_GRPC_PORT, str(pick_unused_port())),
        (ENV_PHOENIX_WORKING_DIR, str(tmp)),
    )
    with mock.patch.dict(os.environ, values):
        yield


@pytest.fixture(
    scope="session",
    params=[
        pytest.param("sqlite:///:memory:", id="sqlite"),
        pytest.param(
            "postgresql://127.0.0.1:5432/postgres?user=postgres&password=phoenix",
            id="postgresql",
        ),
    ],
)
def _sql_database_url(request: SubRequest) -> URL:
    return make_url(request.param)


@pytest.fixture(autouse=True, scope="class")
def _env_phoenix_sql_database_url(
    _sql_database_url: URL,
    _fake: Faker,
) -> Iterator[None]:
    values = [(ENV_PHOENIX_SQL_DATABASE_URL, _sql_database_url.render_as_string())]
    with ExitStack() as stack:
        if _sql_database_url.get_backend_name().startswith("postgresql"):
            schema = stack.enter_context(_random_schema(_sql_database_url, _fake))
            values.append((ENV_PHOENIX_SQL_DATABASE_SCHEMA, schema))
        stack.enter_context(mock.patch.dict(os.environ, values))
        yield


@pytest.fixture(scope="session", params=["http", "grpc"])
def _span_exporter(request: SubRequest) -> _SpanExporterConstructor:
    if request.param == "http":
        return _http_span_exporter
    if request.param == "grpc":
        return _grpc_span_exporter
    raise ValueError(f"Unknown exporter: {request.param}")
