import json
import os
from itertools import count, starmap
from pathlib import Path
from secrets import token_hex, token_urlsafe
from time import sleep, time
from typing import Dict, Generator, Iterator, List, Optional, Tuple, cast
from unittest import mock

import pytest
from _pytest.fixtures import SubRequest
from _pytest.tmpdir import TempPathFactory
from faker import Faker
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from phoenix.auth import DEFAULT_SECRET_LENGTH
from phoenix.config import (
    ENV_PHOENIX_DISABLE_RATE_LIMIT,
    ENV_PHOENIX_GRPC_PORT,
    ENV_PHOENIX_PORT,
    ENV_PHOENIX_SECRET,
    ENV_PHOENIX_SMTP_HOSTNAME,
    ENV_PHOENIX_SMTP_MAIL_FROM,
    ENV_PHOENIX_SMTP_PASSWORD,
    ENV_PHOENIX_SMTP_PORT,
    ENV_PHOENIX_SMTP_USERNAME,
    ENV_PHOENIX_SMTP_VALIDATE_CERTS,
    ENV_PHOENIX_SQL_DATABASE_SCHEMA,
    ENV_PHOENIX_SQL_DATABASE_URL,
    ENV_PHOENIX_WORKING_DIR,
)
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from portpicker import pick_unused_port  # type: ignore[import-untyped]
from sqlalchemy import URL, create_engine, make_url, text
from sqlalchemy.exc import OperationalError
from typing_extensions import assert_never

from ._helpers import (
    _DEFAULT_ADMIN,
    _HTTPX_OP_IDX,
    _MEMBER,
    _TEST_NAME,
    _Email,
    _file_lock,
    _GetUser,
    _grpc_span_exporter,
    _http_span_exporter,
    _Password,
    _Profile,
    _RoleOrUser,
    _SpanExporterFactory,
    _start_span,
    _tmp_path,
    _User,
    _UserFactory,
    _UserGenerator,
    _Username,
)


@pytest.fixture(scope="session")
def _ports() -> Iterator[int]:
    def _(used: List[int]) -> Iterator[int]:
        while True:
            with _file_lock() as f:
                used = json.loads(f.read_text()).get("used", []) if f.is_file() else used
                while (port := pick_unused_port()) in used:
                    continue
                used.append(port)
                f.write_text(json.dumps(dict(used=used)))
            print(f"Using {port=} ({used=})")
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


@pytest.fixture(scope="session")
def _fake() -> Faker:
    return Faker()


@pytest.fixture(scope="module")
def _tmp(
    _sql_database_url: URL,
    tmp_path_factory: TempPathFactory,
    request: SubRequest,
    worker_id: str,
) -> Path:
    base = tmp_path_factory.getbasetemp().parent
    db_url = _sql_database_url
    db_name = db_url.get_backend_name()
    module = request.module.__name__
    tmp = base / f"{module}" / f"{db_name}"
    tmp.mkdir(parents=True, exist_ok=True)
    _tmp_path.set((worker_id, tmp))
    return tmp


@pytest.fixture(autouse=True, scope="module")
def _fail_if_postgresql_is_needed_but_unavailable(
    _sql_database_url: URL,
    _tmp: Path,
) -> None:
    db_url = _sql_database_url
    if not db_url.get_backend_name().startswith("postgresql"):
        return
    with _file_lock() as f:
        if f.is_file():
            if not json.loads((f.read_text()))["available"]:
                pytest.fail("PostgreSQL unavailable")
            return
        engine = create_engine(db_url.set(drivername="postgresql+psycopg"))
        try:
            engine.connect().close()
        except OperationalError:
            f.write_text(json.dumps(dict(available=False)))
            pytest.fail("PostgreSQL unavailable")
        f.write_text(json.dumps(dict(available=True)))
    engine.dispose()


@pytest.fixture(scope="module")
def _environment_variables(
    _sql_database_url: URL,
    _tmp: Path,
    _ports: Iterator[int],
) -> Dict[str, str]:
    fake = Faker()
    with _file_lock() as f:
        if f.is_file():
            return cast(Dict[str, str], json.loads(f.read_text()))
        db_url = _sql_database_url
        secret = token_urlsafe(DEFAULT_SECRET_LENGTH)
        working_dir = _tmp / ".phoenix"
        working_dir.mkdir(exist_ok=True)
        values = {
            ENV_PHOENIX_SQL_DATABASE_URL: db_url.render_as_string(),
            ENV_PHOENIX_PORT: str(next(_ports)),
            ENV_PHOENIX_GRPC_PORT: str(next(_ports)),
            ENV_PHOENIX_WORKING_DIR: str(working_dir),
            ENV_PHOENIX_DISABLE_RATE_LIMIT: "true",
            ENV_PHOENIX_SECRET: secret,
            ENV_PHOENIX_SMTP_HOSTNAME: "127.0.0.1",
            ENV_PHOENIX_SMTP_PORT: str(next(_ports)),
            ENV_PHOENIX_SMTP_USERNAME: fake.user_name(),
            ENV_PHOENIX_SMTP_PASSWORD: fake.password(),
            ENV_PHOENIX_SMTP_MAIL_FROM: fake.email(),
            ENV_PHOENIX_SMTP_VALIDATE_CERTS: "false",
        }
        if db_url.get_backend_name().startswith("postgresql"):
            # schema string must not exceed 31 characters.
            values[ENV_PHOENIX_SQL_DATABASE_SCHEMA] = f"_{token_hex(15)}"
        f.write_text(json.dumps(values))
        return values


@pytest.fixture(autouse=True, scope="module")
def _environment(
    _environment_variables: Dict[str, str],
) -> Iterator[None]:
    with mock.patch.dict(os.environ, _environment_variables.items()):
        yield
    if not (
        (db_url := make_url(_environment_variables[ENV_PHOENIX_SQL_DATABASE_URL]))
        .get_backend_name()
        .startswith("postgresql")
    ):
        return
    assert (schema := _environment_variables.get(ENV_PHOENIX_SQL_DATABASE_SCHEMA))
    engine = create_engine(db_url.set(drivername="postgresql+psycopg"))
    time_limit = time() + 30
    while time() < time_limit:
        try:
            with engine.connect() as conn:
                conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE;"))
                conn.commit()
        except OperationalError as exc:
            if "too many clients" in str(exc):
                sleep(1)
                continue
            raise
        break
    engine.dispose()


@pytest.fixture(scope="module")
def _email_domain(
    worker_id: str,
) -> str:
    return f"{worker_id.strip().encode().hex()}.com"


@pytest.fixture(scope="module")
def _emails(
    _email_domain: str,
) -> Iterator[_Email]:
    return (f"{token_urlsafe(_ENTROPY)}@{_email_domain}" for _ in count())


@pytest.fixture(scope="module")
def _passwords(
    worker_id: str,
) -> Iterator[_Password]:
    return (f"{worker_id.strip().replace(' ', '_')}_{token_urlsafe(_ENTROPY)}" for _ in count())


@pytest.fixture(scope="module")
def _usernames(
    worker_id: str,
) -> Iterator[_Username]:
    return (f"{worker_id.strip()} {token_urlsafe(_ENTROPY)}" for _ in count())


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


@pytest.fixture(scope="module")
def _project_names() -> Iterator[str]:
    return (token_urlsafe(_ENTROPY) for _ in count())


@pytest.fixture(scope="module")
def _span_names() -> Iterator[str]:
    return (token_urlsafe(_ENTROPY) for _ in count())


@pytest.fixture
def _spans(
    _project_names: Iterator[str],
    _span_names: Iterator[str],
) -> Tuple[ReadableSpan, ...]:
    memory = InMemorySpanExporter()
    project_name, span_name = next(_project_names), next(_span_names)
    _start_span(project_name=project_name, span_name=span_name, exporter=memory).end()
    return memory.get_finished_spans()


@pytest.fixture(autouse=True)
def _test_name(request: SubRequest) -> Iterator[str]:
    _HTTPX_OP_IDX.set(0)
    name = request.node.name
    token = _TEST_NAME.set(name)
    yield name
    _TEST_NAME.reset(token)


_ENTROPY = 30
