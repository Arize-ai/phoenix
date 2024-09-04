import secrets
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from functools import partial
from typing import (
    Any,
    ContextManager,
    Dict,
    Optional,
    Protocol,
    Tuple,
)
from urllib.parse import urljoin

import httpx
import jwt
import pytest
from faker import Faker
from httpx import HTTPStatusError
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import Span
from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
)
from phoenix.config import get_base_url
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from typing_extensions import TypeAlias

NOW = datetime.now(timezone.utc)

_ProjectName: TypeAlias = str
_SpanName: TypeAlias = str
_Headers: TypeAlias = Dict[str, Any]
_Name: TypeAlias = str

_UserName: TypeAlias = str
_Email: TypeAlias = str
_Password: TypeAlias = str
_Token: TypeAlias = str
_AccessToken: TypeAlias = str
_RefreshToken: TypeAlias = str
_ApiKey: TypeAlias = str
_GqlId: TypeAlias = str


class _LogIn(Protocol):
    def __call__(
        self,
        *,
        email: _Email,
        password: _Password,
    ) -> ContextManager[Tuple[_AccessToken, _RefreshToken]]: ...


class _LogOut(Protocol):
    def __call__(self, token: _Token, /) -> None: ...


class _CreateUser(Protocol):
    def __call__(
        self,
        *,
        email: _Email,
        password: _Password,
        role: UserRoleInput,
        username: Optional[_UserName] = None,
        token: Optional[_Token] = None,
    ) -> _GqlId: ...


class _PatchUser(Protocol):
    def __call__(
        self,
        gid: _GqlId,
        /,
        *,
        email: Optional[_Email] = None,
        username: Optional[_UserName] = None,
        password: Optional[_Password] = None,
        role: Optional[UserRoleInput] = None,
        token: Optional[_Token] = None,
    ) -> _Token: ...


class _CreateSystemApiKey(Protocol):
    def __call__(
        self,
        *,
        name: _Name,
        expires_at: Optional[datetime] = None,
        token: Optional[_Token] = None,
    ) -> Tuple[_ApiKey, _GqlId]: ...


class _DeleteSystemApiKey(Protocol):
    def __call__(
        self,
        gid: _GqlId,
        /,
        *,
        token: Optional[_Token] = None,
    ) -> None: ...


class _SpanExporterFactory(Protocol):
    def __call__(
        self,
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter: ...


class _StartSpan(Protocol):
    def __call__(
        self,
        *,
        project_name: _ProjectName,
        span_name: _SpanName,
        exporter: SpanExporter,
    ) -> Span: ...


class TestTokens:
    def test_log_in_tokens_should_change(
        self,
        admin_email: str,
        secret: str,
        log_in: _LogIn,
    ) -> None:
        n, access_tokens, refresh_tokens = 2, set(), set()
        for _ in range(n):
            with log_in(email=admin_email, password=secret) as (access_token, refresh_token):
                access_tokens.add(access_token)
                refresh_tokens.add(refresh_token)
        assert len(access_tokens) == n
        assert len(refresh_tokens) == n
        decode = partial(jwt.decode, options=dict(verify_signature=False))
        assert len({decode(token)["jti"] for token in access_tokens}) == n
        assert len({decode(token)["jti"] for token in refresh_tokens}) == n


class TestUsers:
    @pytest.mark.parametrize(
        "email,use_secret,expectation",
        [
            ("admin@localhost", True, nullcontext()),
            ("admin@localhost", False, pytest.raises(HTTPStatusError, match="401 Unauthorized")),
            ("system@localhost", True, pytest.raises(HTTPStatusError, match="401 Unauthorized")),
            ("admin", True, pytest.raises(HTTPStatusError, match="401 Unauthorized")),
        ],
    )
    def test_admin(
        self,
        email: str,
        use_secret: bool,
        expectation: ContextManager[Optional[Unauthorized]],
        secret: str,
        log_in: _LogIn,
        create_system_api_key: _CreateSystemApiKey,
        fake: Faker,
    ) -> None:
        password = secret if use_secret else secrets.token_hex(32)
        with expectation:
            with log_in(email=email, password=password) as (token, _):
                create_system_api_key(name=fake.unique.pystr(), token=token)
            with pytest.raises(Unauthorized):
                create_system_api_key(name=fake.unique.pystr(), token=token)

    def test_end_to_end_credentials_flow(
        self,
        admin_email: str,
        secret: str,
        httpx_client: httpx.Client,
        create_system_api_key: _CreateSystemApiKey,
        fake: Faker,
    ) -> None:
        # user logs into first browser
        resp = httpx_client.post(
            urljoin(get_base_url(), "/auth/login"),
            json={"email": admin_email, "password": secret},
        )
        resp.raise_for_status()
        assert (browser_0_access_token_0 := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        assert (browser_0_refresh_token_0 := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))

        # user creates api key in the first browser
        create_system_api_key(name="api-key-0", token=browser_0_access_token_0)

        # tokens are refreshed in the first browser
        resp = httpx_client.post(
            urljoin(get_base_url(), "/auth/refresh"),
            cookies={
                PHOENIX_ACCESS_TOKEN_COOKIE_NAME: browser_0_access_token_0,
                PHOENIX_REFRESH_TOKEN_COOKIE_NAME: browser_0_refresh_token_0,
            },
        )
        resp.raise_for_status()
        assert (browser_0_access_token_1 := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        assert (browser_0_refresh_token_1 := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))

        # user creates api key in the first browser
        create_system_api_key(name="api-key-1", token=browser_0_access_token_1)

        # refresh token is good for one use only
        resp = httpx_client.post(
            urljoin(get_base_url(), "/auth/refresh"),
            cookies={
                PHOENIX_ACCESS_TOKEN_COOKIE_NAME: browser_0_access_token_0,
                PHOENIX_REFRESH_TOKEN_COOKIE_NAME: browser_0_refresh_token_0,
            },
        )
        with pytest.raises(HTTPStatusError):
            resp.raise_for_status()

        # original access token is invalid after refresh
        with pytest.raises(Unauthorized):
            create_system_api_key(name="api-key-2", token=browser_0_access_token_0)

        # user logs into second browser
        resp = httpx_client.post(
            urljoin(get_base_url(), "/auth/login"),
            json={"email": admin_email, "password": secret},
        )
        resp.raise_for_status()
        assert (browser_1_access_token_0 := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        assert resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME)

        # user creates api key in the second browser
        create_system_api_key(name="api-key-3", token=browser_1_access_token_0)

        # user logs out in first browser
        resp = httpx_client.post(
            urljoin(get_base_url(), "/auth/logout"),
            cookies={
                PHOENIX_ACCESS_TOKEN_COOKIE_NAME: browser_0_access_token_1,
                PHOENIX_REFRESH_TOKEN_COOKIE_NAME: browser_0_refresh_token_1,
            },
        )
        resp.raise_for_status()

        # user is logged out of both browsers
        with pytest.raises(Unauthorized):
            create_system_api_key(name="api-key-4", token=browser_0_access_token_1)
        with pytest.raises(Unauthorized):
            create_system_api_key(name="api-key-5", token=browser_1_access_token_0)

    @pytest.mark.parametrize(
        "role,expectation",
        [
            (UserRoleInput.ADMIN, nullcontext()),
            (UserRoleInput.MEMBER, pytest.raises(Unauthorized)),
        ],
    )
    def test_create_user(
        self,
        role: UserRoleInput,
        expectation: ContextManager[Optional[Unauthorized]],
        admin_email: str,
        secret: str,
        log_in: _LogIn,
        create_user: _CreateUser,
        create_system_api_key: _CreateSystemApiKey,
        fake: Faker,
    ) -> None:
        email = fake.unique.email()
        username = fake.unique.pystr()
        password = secrets.token_hex(32)
        with log_in(email=admin_email, password=secret) as (token, _):
            create_user(
                email=email,
                password=password,
                role=role,
                username=username,
                token=token,
            )
        with log_in(email=email, password=password) as (token, _):
            with expectation:
                create_system_api_key(name=fake.unique.pystr(), token=token)
            for _role in UserRoleInput:
                _email = fake.unique.email()
                _username = fake.unique.pystr()
                _password = secrets.token_hex(32)
                with expectation:
                    create_user(
                        email=_email,
                        password=_password,
                        role=_role,
                        username=_username,
                        token=token,
                    )


class TestSpanExporters:
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
        span_exporter: _SpanExporterFactory,
        start_span: _StartSpan,
        create_system_api_key: _CreateSystemApiKey,
        delete_system_api_key: _DeleteSystemApiKey,
        admin_token: _Token,
        fake: Faker,
    ) -> None:
        headers: Optional[Dict[str, Any]] = None
        gid: Optional[_GqlId] = None
        if with_headers:
            system_api_key, gid = create_system_api_key(
                name=fake.unique.pystr(),
                expires_at=expires_at,
                token=admin_token,
            )
            headers = {"authorization": f"Bearer {system_api_key}"}
        export = span_exporter(headers=headers).export
        project_name, span_name = fake.unique.pystr(), fake.unique.pystr()
        memory = InMemorySpanExporter()
        start_span(project_name=project_name, span_name=span_name, exporter=memory).end()
        spans = memory.get_finished_spans()
        assert len(spans) == 1
        for _ in range(2):
            assert export(spans) is expected
        if gid is not None and expected is SpanExportResult.SUCCESS:
            delete_system_api_key(gid, token=admin_token)
            assert export(spans) is SpanExportResult.FAILURE
