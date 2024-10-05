import os
from contextlib import ExitStack
from dataclasses import asdict
from itertools import count, starmap
from typing import Generator, Iterator, List, Optional, Tuple, cast
from unittest import mock

import pytest
from _pytest.fixtures import SubRequest
from _pytest.tmpdir import TempPathFactory
from faker import Faker
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from phoenix.auth import REQUIREMENTS_FOR_PHOENIX_SECRET
from phoenix.config import (
    ENV_PHOENIX_GRPC_PORT,
    ENV_PHOENIX_PORT,
    ENV_PHOENIX_SQL_DATABASE_SCHEMA,
    ENV_PHOENIX_SQL_DATABASE_URL,
    ENV_PHOENIX_WORKING_DIR,
)
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from portpicker import pick_unused_port  # type: ignore[import-untyped]
from sqlalchemy import URL, make_url
from typing_extensions import assert_never

from ._helpers import (
    _DEFAULT_ADMIN,
    _HTTPX_OP_IDX,
    _MEMBER,
    _TEST_NAME,
    _Email,
    _GetUser,
    _grpc_span_exporter,
    _http_span_exporter,
    _Password,
    _Profile,
    _random_schema,
    _RoleOrUser,
    _SpanExporterFactory,
    _start_span,
    _User,
    _UserFactory,
    _UserGenerator,
    _Username,
)


@pytest.fixture(scope="session")
def _ports() -> Iterator[int]:
    def _(used: List[int]) -> Iterator[int]:
        while True:
            port = pick_unused_port()
            if port not in used:
                used.append(port)
                yield port

    return _([])


@pytest.fixture(scope="session")
def _sql_database_url(request: SubRequest) -> URL:
    backend = os.getenv("CI_TEST_DB_BACKEND")
    if not backend or backend == "sqlite":
        return make_url("sqlite:///:memory:")
    if backend == "postgresql":
        return make_url("postgresql://127.0.0.1:5432/postgres?user=postgres&password=phoenix")
    pytest.fail(f"Unknown database backend: {backend}")


@pytest.fixture(scope="session", params=["http", "grpc"])
def _span_exporter(request: SubRequest) -> _SpanExporterFactory:
    if request.param == "http":
        return _http_span_exporter
    if request.param == "grpc":
        return _grpc_span_exporter
    raise ValueError(f"Unknown exporter: {request.param}")


@pytest.fixture(scope="module")
def _fake() -> Faker:
    return Faker()


@pytest.fixture(autouse=True, scope="module")
def _env(
    _sql_database_url: URL,
    _ports: Iterator[int],
    tmp_path_factory: TempPathFactory,
) -> Iterator[None]:
    tmp = tmp_path_factory.getbasetemp()
    values = (
        (ENV_PHOENIX_PORT, str(next(_ports))),
        (ENV_PHOENIX_GRPC_PORT, str(next(_ports))),
        (ENV_PHOENIX_WORKING_DIR, str(tmp)),
    )
    with mock.patch.dict(os.environ, values):
        yield


@pytest.fixture(autouse=True, scope="module")
def _env_phoenix_sql_database_url(
    _sql_database_url: URL,
    _fake: Faker,
) -> Iterator[None]:
    values = [(ENV_PHOENIX_SQL_DATABASE_URL, _sql_database_url.render_as_string())]
    with ExitStack() as stack:
        if _sql_database_url.get_backend_name().startswith("postgresql"):
            schema = stack.enter_context(_random_schema(_sql_database_url))
            values.append((ENV_PHOENIX_SQL_DATABASE_SCHEMA, schema))
        stack.enter_context(mock.patch.dict(os.environ, values))
        yield


@pytest.fixture(scope="module")
def _emails(_fake: Faker) -> Iterator[_Email]:
    return (_fake.unique.email() for _ in count())


@pytest.fixture(scope="module")
def _passwords(_fake: Faker) -> Iterator[_Password]:
    return (_fake.unique.password(**asdict(REQUIREMENTS_FOR_PHOENIX_SECRET)) for _ in count())


@pytest.fixture(scope="module")
def _usernames(_fake: Faker) -> Iterator[_Username]:
    return (_fake.unique.pystr() for _ in count())


@pytest.fixture(scope="module")
def _profiles(
    _emails: Iterator[_Email],
    _passwords: Iterator[_Password],
    _usernames: Iterator[_Username],
) -> Iterator[_Profile]:
    return starmap(_Profile, zip(_emails, _passwords, _usernames))


@pytest.fixture(scope="module")
def _users(
    _profiles: Iterator[_Profile],
) -> _UserGenerator:
    def _() -> Generator[Optional[_User], Tuple[UserRoleInput, Optional[_Profile]], None]:
        role, profile = yield None
        while True:
            user = _DEFAULT_ADMIN.create_user(role, profile=profile or next(_profiles))
            role, profile = yield user

    g = _()
    next(g)
    return cast(_UserGenerator, g)


@pytest.fixture(scope="module")
def _new_user(
    _users: _UserGenerator,
) -> _UserFactory:
    def _(
        role: UserRoleInput = _MEMBER,
        /,
        *,
        profile: Optional[_Profile] = None,
    ) -> _User:
        return _users.send((role, profile))

    return _


@pytest.fixture(scope="module")
def _get_user(
    _new_user: _UserFactory,
) -> _GetUser:
    def _(
        role_or_user: _RoleOrUser = _MEMBER,
        /,
        *,
        profile: Optional[_Profile] = None,
    ) -> _User:
        assert profile is None or isinstance(role_or_user, UserRoleInput)
        if isinstance(role_or_user, _User):
            user = role_or_user
            return user
        elif isinstance(role_or_user, UserRoleInput):
            role = role_or_user
            return _new_user(role, profile=profile)
        else:
            assert_never(role_or_user)

    return _


@pytest.fixture
def _spans(_fake: Faker) -> Tuple[ReadableSpan, ...]:
    memory = InMemorySpanExporter()
    project_name, span_name = _fake.unique.pystr(), _fake.unique.pystr()
    _start_span(project_name=project_name, span_name=span_name, exporter=memory).end()
    return memory.get_finished_spans()


@pytest.fixture(autouse=True)
def _test_name(request: SubRequest) -> Iterator[str]:
    _HTTPX_OP_IDX.set(0)
    name = request.node.name
    token = _TEST_NAME.set(name)
    yield name
    _TEST_NAME.reset(token)
