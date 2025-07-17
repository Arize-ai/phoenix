from __future__ import annotations

import os
from collections.abc import Generator, Iterator
from itertools import count, starmap
from secrets import token_hex
from types import ModuleType
from typing import Optional, cast

import pytest
from _pytest.fixtures import SubRequest
from faker import Faker
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from phoenix.client.__generated__ import v1
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from portpicker import pick_unused_port  # type: ignore[import-untyped]
from smtpdfix import AuthController, Config, SMTPDFix
from smtpdfix.certs import _generate_certs
from sqlalchemy import URL, make_url
from typing_extensions import assert_never

from ._helpers import (
    _ADMIN,
    _DB_BACKEND,
    _HTTPX_OP_IDX,
    _MEMBER,
    _TEST_NAME,
    _AppInfo,
    _Email,
    _GetUser,
    _GqlId,
    _grpc_span_exporter,
    _http_span_exporter,
    _httpx_client,
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
    def _(used: list[int]) -> Iterator[int]:
        while True:
            port = pick_unused_port()
            if port not in used:
                used.append(port)
                yield port

    return _([])


@pytest.fixture(scope="session")
def _db_backend() -> _DB_BACKEND:
    backend = os.getenv("CI_TEST_DB_BACKEND", "sqlite").lower()
    assert backend in ("sqlite", "postgresql")
    return cast(_DB_BACKEND, backend)


@pytest.fixture(scope="session")
def _sql_database_url(
    _db_backend: _DB_BACKEND,
) -> URL:
    if _db_backend == "sqlite":
        return make_url("sqlite:///:memory:")
    if _db_backend == "postgresql":
        return make_url("postgresql://127.0.0.1:5432/postgres?user=postgres&password=phoenix")
    assert_never(_db_backend)


@pytest.fixture(scope="session", params=["http", "grpc"])
def _span_exporter(request: SubRequest) -> _SpanExporterFactory:
    if request.param == "http":
        return _http_span_exporter
    if request.param == "grpc":
        return _grpc_span_exporter
    raise ValueError(f"Unknown exporter: {request.param}")


@pytest.fixture(scope="package")
def _fake() -> Faker:
    return Faker()


@pytest.fixture
def _emails() -> Iterator[_Email]:
    return (f"{token_hex(16)}@{token_hex(16)}.com" for _ in count())


@pytest.fixture
def _passwords() -> Iterator[_Password]:
    return (token_hex(16) for _ in count())


@pytest.fixture
def _usernames() -> Iterator[_Username]:
    return (token_hex(16) for _ in count())


@pytest.fixture
def _profiles(
    _emails: Iterator[_Email],
    _passwords: Iterator[_Password],
    _usernames: Iterator[_Username],
) -> Iterator[_Profile]:
    return starmap(_Profile, zip(_emails, _passwords, _usernames))


@pytest.fixture
def _users(
    _profiles: Iterator[_Profile],
) -> _UserGenerator:
    def _() -> Generator[Optional[_User], tuple[_AppInfo, UserRoleInput, Optional[_Profile]], None]:
        app, role, profile = yield None
        while True:
            profile = profile or next(_profiles)
            url = "v1/users"
            user = v1.LocalUserData(
                auth_method="LOCAL",
                email=profile.email,
                username=profile.username,
                password=profile.password,
                role="ADMIN" if role is _ADMIN else "MEMBER",
            )
            json_ = v1.CreateUserRequestBody(user=user, send_welcome_email=False)
            resp = _httpx_client(app, app.admin_secret).post(url=url, json=json_)
            resp.raise_for_status()
            gid = _GqlId(cast(v1.CreateUserResponseBody, resp.json())["data"]["id"])
            app, role, profile = yield _User(gid, role, profile)

    g = _()
    next(g)
    return cast(_UserGenerator, g)


@pytest.fixture
def _new_user(
    _users: _UserGenerator,
) -> _UserFactory:
    def _(
        app: _AppInfo,
        role: UserRoleInput = _MEMBER,
        /,
        *,
        profile: Optional[_Profile] = None,
    ) -> _User:
        return _users.send((app, role, profile))

    return _


@pytest.fixture
def _get_user(
    _new_user: _UserFactory,
) -> _GetUser:
    def _(
        app: _AppInfo,
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
            return _new_user(app, role, profile=profile)
        else:
            assert_never(role_or_user)

    return _


@pytest.fixture
def _spans(_fake: Faker) -> tuple[ReadableSpan, ...]:
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


@pytest.fixture(scope="package")
def _env_ports(
    _ports: Iterator[int],
) -> dict[str, str]:
    """Configure port environment variables for testing."""
    return {
        "PHOENIX_PORT": str(next(_ports)),
        "PHOENIX_GRPC_PORT": str(next(_ports)),
    }


@pytest.fixture(scope="package")
def _env_database(
    _sql_database_url: URL,
) -> Iterator[dict[str, str]]:
    """Configure database environment variables for testing."""
    env = {"PHOENIX_SQL_DATABASE_URL": _sql_database_url.render_as_string()}
    if not _sql_database_url.get_backend_name().startswith("postgresql"):
        yield env
    else:
        with _random_schema(_sql_database_url) as schema:
            yield {**env, "PHOENIX_SQL_DATABASE_SCHEMA": schema}


@pytest.fixture(scope="package")
def _env_auth() -> dict[str, str]:
    """Configure authentication and security environment variables for testing."""
    return {
        "PHOENIX_ENABLE_AUTH": "true",
        "PHOENIX_SECRET": token_hex(16),
        "PHOENIX_ADMIN_SECRET": token_hex(16),
        "PHOENIX_DISABLE_RATE_LIMIT": "true",
        "PHOENIX_CSRF_TRUSTED_ORIGINS": ",http://localhost,",
    }


@pytest.fixture(scope="package")
def _env_smtp(
    _smtpd: AuthController,
) -> dict[str, str]:
    """Configure SMTP environment variables for testing."""
    return {
        "PHOENIX_SMTP_HOSTNAME": _smtpd.config.host or "127.0.0.1",
        "PHOENIX_SMTP_PORT": str(_smtpd.config.port),
        "PHOENIX_SMTP_USERNAME": _smtpd.config.login_username,
        "PHOENIX_SMTP_PASSWORD": _smtpd.config.login_password,
        "PHOENIX_SMTP_VALIDATE_CERTS": "false",
    }


@pytest.fixture(scope="package")
def _smtpd_config(
    _ports: Iterator[int],
    tmp_path_factory: pytest.TempPathFactory,
) -> Config:
    """Configure SMTP server for testing."""
    hostname = "127.0.0.1"
    port = next(_ports)
    path = tmp_path_factory.mktemp(f"certs_for_server_{token_hex(8)}")
    certs = _generate_certs(path, separate_key=True)
    config = Config()
    config.ssl_cert_files = (certs.cert.resolve(), certs.key[0].resolve())
    config.host = hostname
    config.port = port
    config.login_username = token_hex(8)
    config.login_password = token_hex(16)
    config.use_starttls = True
    return config


@pytest.fixture(scope="package")
def _smtpd(
    _smtpd_config: Config,
) -> Iterator[AuthController]:
    """SMTP server fixture for testing email functionality."""
    with SMTPDFix(
        hostname=_smtpd_config.host or "127.0.0.1",
        port=_smtpd_config.port,
        config=_smtpd_config,
    ) as controller:
        yield controller


@pytest.fixture(autouse=True, scope="session")
def _patch_opentelemetry_exporters_to_reduce_retries() -> None:
    from opentelemetry.exporter.otlp.proto.grpc import exporter
    from opentelemetry.exporter.otlp.proto.http import trace_exporter

    assert isinstance(exporter, ModuleType)
    assert isinstance(trace_exporter, ModuleType)

    name = "_MAX_RETRYS"
    assert isinstance(getattr(exporter, name), int)
    assert isinstance(getattr(trace_exporter, name), int)
    setattr(exporter, name, 2)
    setattr(trace_exporter, name, 2)
