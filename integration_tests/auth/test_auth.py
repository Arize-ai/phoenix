import secrets
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from typing import (
    Any,
    Callable,
    ContextManager,
    Dict,
    Iterator,
    Optional,
    Tuple,
    cast,
)

import pytest
from faker import Faker
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Span
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from typing_extensions import TypeAlias

ProjectName: TypeAlias = str
SpanName: TypeAlias = str
Headers: TypeAlias = Dict[str, Any]
Name: TypeAlias = str

UserName: TypeAlias = str
Email: TypeAlias = str
Password: TypeAlias = str
Token: TypeAlias = str
ApiKey: TypeAlias = str
GqlId: TypeAlias = str

NOW = datetime.now(timezone.utc)


class TestUsers:
    @pytest.mark.parametrize(
        "email,use_secret,expectation",
        [
            ("admin@localhost", True, nullcontext()),
            ("admin@localhost", False, pytest.raises(AssertionError)),
            ("system@localhost", True, pytest.raises(AssertionError)),
            ("admin", True, pytest.raises(AssertionError)),
        ],
    )
    def test_admin(
        self,
        email: str,
        use_secret: bool,
        expectation: ContextManager[Optional[AssertionError]],
        secret: str,
        login: Callable[[Email, Password], ContextManager[Token]],
        create_system_api_key: Callable[[Name, Optional[datetime], Token], Tuple[ApiKey, GqlId]],
        fake: Faker,
    ) -> None:
        password = secret if use_secret else secrets.token_hex(32)
        with expectation:
            with login(email, password) as token:
                create_system_api_key(fake.unique.pystr(), None, token)
            with pytest.raises(AssertionError):
                create_system_api_key(fake.unique.pystr(), None, token)

    @pytest.mark.parametrize(
        "role,expectation",
        [
            (UserRoleInput.ADMIN, nullcontext()),
            (UserRoleInput.MEMBER, pytest.raises(AssertionError)),
        ],
    )
    def test_create_user(
        self,
        role: UserRoleInput,
        expectation: ContextManager[Optional[AssertionError]],
        admin_email: str,
        secret: str,
        login: Callable[[Email, Password], ContextManager[Token]],
        create_user: Callable[[Email, UserName, Password, UserRoleInput, Token], None],
        create_system_api_key: Callable[[Name, Optional[datetime], Token], Tuple[ApiKey, GqlId]],
        fake: Faker,
    ) -> None:
        profile = fake.simple_profile()
        email = cast(str, profile["mail"])
        username = cast(str, profile["username"])
        password = secrets.token_hex(32)
        with login(admin_email, secret) as token:
            create_user(email, username, password, role, token)
        with login(email, password) as token:
            with expectation:
                create_system_api_key(fake.unique.pystr(), None, token)
            for _role in UserRoleInput:
                _profile = fake.simple_profile()
                _email = cast(str, _profile["mail"])
                _username = cast(str, _profile["username"])
                _password = secrets.token_hex(32)
                with expectation:
                    create_user(_email, _username, _password, _role, token)


class TestSpanExporters:
    @pytest.fixture(scope="class")
    def token(
        self,
        admin_email: str,
        secret: str,
        login: Callable[[Email, Password], ContextManager[Token]],
    ) -> Iterator[Token]:
        with login(admin_email, secret) as token:
            yield token

    @pytest.mark.parametrize(
        "with_headers,expires_at,expected",
        [
            (True, NOW + timedelta(days=1), SpanExportResult.SUCCESS),
            (True, None, SpanExportResult.SUCCESS),
            (True, NOW, SpanExportResult.FAILURE),
            (False, None, SpanExportResult.FAILURE),
        ],
    )
    def test_headers(
        self,
        with_headers: bool,
        expires_at: Optional[datetime],
        expected: SpanExportResult,
        span_exporter: Callable[[Optional[Headers]], SpanExporter],
        start_span: Callable[[ProjectName, SpanName, SpanExporter], Span],
        create_system_api_key: Callable[[Name, Optional[datetime], Token], Tuple[ApiKey, GqlId]],
        delete_system_api_key: Callable[[GqlId, Token], None],
        token: Token,
        fake: Faker,
    ) -> None:
        headers: Optional[Dict[str, Any]] = None
        gid: Optional[GqlId] = None
        if with_headers:
            system_api_key, gid = create_system_api_key(fake.unique.pystr(), expires_at, token)
            headers = {"authorization": f"Bearer {system_api_key}"}
        export = span_exporter(headers).export
        project_name, span_name = fake.unique.pystr(), fake.unique.pystr()
        memory = InMemorySpanExporter()
        start_span(project_name, span_name, memory).end()
        spans = memory.get_finished_spans()
        assert len(spans) == 1
        for _ in range(2):
            assert export(spans) is expected
        if gid is not None and expected is SpanExportResult.SUCCESS:
            delete_system_api_key(gid, token)
            assert export(spans) is SpanExportResult.FAILURE
