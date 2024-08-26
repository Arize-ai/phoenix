from contextlib import nullcontext
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, ContextManager, Dict, Iterator, Literal, Optional, cast, get_args

import pytest
from faker import Faker
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Span
from phoenix.auth import REQUIREMENTS_FOR_PHOENIX_SECRET
from typing_extensions import TypeAlias

ProjectName: TypeAlias = str
SpanName: TypeAlias = str
Headers: TypeAlias = Dict[str, Any]
Name: TypeAlias = str

Role: TypeAlias = Literal["MEMBER", "ADMIN"]
UserName: TypeAlias = str
Email: TypeAlias = str
Password: TypeAlias = str
Token: TypeAlias = str
ApiKey: TypeAlias = str

NOW = datetime.now(timezone.utc)


class TestUsers:
    @pytest.mark.parametrize(
        "email,use_secret,expectation",
        [
            ("admin@localhost", True, nullcontext()),
            ("admin@localhost", False, pytest.raises(BaseException)),
            ("system@localhost", True, pytest.raises(BaseException)),
            ("admin", True, pytest.raises(BaseException)),
        ],
    )
    def test_admin(
        self,
        email: str,
        use_secret: bool,
        expectation: ContextManager[Optional[BaseException]],
        secret: str,
        login: Callable[[Email, Password], ContextManager[Token]],
        create_system_api_key: Callable[[Name, Optional[datetime], Token], ApiKey],
        fake: Faker,
    ) -> None:
        password = (
            secret
            if use_secret
            else fake.unique.password(**asdict(REQUIREMENTS_FOR_PHOENIX_SECRET))
        )
        with expectation:
            with login(email, password) as token:
                assert create_system_api_key(fake.unique.pystr(), None, token)
            with pytest.raises(BaseException):
                assert create_system_api_key(fake.unique.pystr(), None, token)

    @pytest.mark.parametrize(
        "role,expectation",
        [
            ("ADMIN", nullcontext()),
            ("MEMBER", pytest.raises(BaseException)),
        ],
    )
    def test_create_user(
        self,
        role: Role,
        expectation: ContextManager[Optional[BaseException]],
        admin_email: str,
        secret: str,
        login: Callable[[Email, Password], ContextManager[Token]],
        create_user: Callable[[Email, UserName, Password, Role, Token], None],
        create_system_api_key: Callable[[Name, Optional[datetime], Token], ApiKey],
        fake: Faker,
    ) -> None:
        profile = fake.simple_profile()
        email = cast(str, profile["mail"])
        username = cast(str, profile["username"])
        password = fake.password(**asdict(REQUIREMENTS_FOR_PHOENIX_SECRET))
        with login(admin_email, secret) as token:
            create_user(email, username, password, role, token)
        with login(email, password) as token:
            with expectation:
                assert create_system_api_key(fake.unique.pystr(), None, token)
            for another_role in get_args(Role):
                another_profile = fake.simple_profile()
                another_email = cast(str, another_profile["mail"])
                another_username = cast(str, another_profile["username"])
                with expectation:
                    create_user(
                        another_email,
                        another_username,
                        fake.password(**asdict(REQUIREMENTS_FOR_PHOENIX_SECRET)),
                        another_role,
                        token,
                    )


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
        create_system_api_key: Callable[[Name, Optional[datetime], Token], ApiKey],
        token: Token,
        fake: Faker,
    ) -> None:
        if with_headers:
            system_api_key = create_system_api_key(fake.unique.pystr(), expires_at, token)
            headers = {"Authorization": f"Bearer {system_api_key}"}
        else:
            headers = None
        project_name, span_name = fake.unique.pystr(), fake.unique.pystr()
        in_memory_span_exporter = InMemorySpanExporter()
        start_span(project_name, span_name, in_memory_span_exporter).end()
        actual = span_exporter(headers).export(in_memory_span_exporter.get_finished_spans())
        assert actual is expected
