from __future__ import annotations

import asyncio
import os
import re
import ssl
import string
import sys
from abc import ABC, abstractmethod
from base64 import b64decode, urlsafe_b64encode
from collections.abc import Iterable, Iterator, Mapping
from contextlib import AbstractContextManager, contextmanager, nullcontext
from contextvars import ContextVar
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from email.message import Message
from functools import cached_property
from io import BytesIO
from itertools import chain
from random import random
from secrets import randbits, token_hex
from subprocess import PIPE, STDOUT
from threading import Lock, Thread
from time import sleep, time
from types import MappingProxyType, TracebackType
from typing import (
    Any,
    Awaitable,
    Callable,
    Generator,
    Generic,
    Literal,
    NamedTuple,
    Optional,
    Protocol,
    Sequence,
    Type,
    TypeVar,
    Union,
    cast,
)
from urllib.parse import parse_qs, urljoin, urlparse, urlunparse
from urllib.request import urlopen

import bs4
import httpx
import jwt
import pytest
import smtpdfix
from fastapi import FastAPI
from httpx import Headers, HTTPStatusError
from jwt import DecodeError
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.exporter.otlp.proto.grpc.exporter import _load_credentials
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.sdk.trace.id_generator import IdGenerator
from opentelemetry.trace import Span, Tracer, format_span_id
from opentelemetry.util.types import AttributeValue
from psutil import STATUS_ZOMBIE, Popen
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import OperationalError
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse, Response
from strawberry.relay import GlobalID
from typing_extensions import Self, TypeAlias, assert_never, override

from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_OAUTH2_NONCE_COOKIE_NAME,
    PHOENIX_OAUTH2_STATE_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
    sanitize_email,
)
from phoenix.config import (
    ENV_PHOENIX_SQL_DATABASE_SCHEMA,
    ENV_PHOENIX_SQL_DATABASE_URL,
)
from phoenix.server.api.auth import IsAdmin
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from phoenix.server.thread_server import ThreadServer

_DB_BACKEND: TypeAlias = Literal["sqlite", "postgresql"]

_ADMIN = UserRoleInput.ADMIN
_MEMBER = UserRoleInput.MEMBER
_VIEWER = UserRoleInput.VIEWER

_ProjectName: TypeAlias = str
_SpanName: TypeAlias = str
_Headers: TypeAlias = dict[str, Any]
_Name: TypeAlias = str

_Secret: TypeAlias = str
_Email: TypeAlias = str
_Password: TypeAlias = str
_Username: TypeAlias = str


@dataclass(frozen=True)
class _Profile:
    email: _Email
    password: _Password
    username: _Username


class _GqlId(str): ...


_AnyT = TypeVar("_AnyT")


class _CanLogOut(Generic[_AnyT], ABC):
    @abstractmethod
    def log_out(self, app: _AppInfo) -> _AnyT: ...


@dataclass(frozen=True)
class _User:
    gid: _GqlId
    role: UserRoleInput
    profile: _Profile
    profile_picture_url: Optional[str]

    def log_in(self, app: _AppInfo) -> _LoggedInUser:
        tokens = _log_in(app, self.password, email=self.email)
        return _LoggedInUser(self.gid, self.role, self.profile, self.profile_picture_url, tokens)

    @cached_property
    def password(self) -> _Password:
        return self.profile.password

    @cached_property
    def email(self) -> _Email:
        return self.profile.email

    @cached_property
    def username(self) -> Optional[_Username]:
        return self.profile.username

    def gql(
        self,
        app: _AppInfo,
        query: str,
        variables: Optional[Mapping[str, Any]] = None,
        operation_name: Optional[str] = None,
    ) -> tuple[dict[str, Any], Headers]:
        return _gql(app, self, query=query, variables=variables, operation_name=operation_name)

    def create_user(
        self,
        app: _AppInfo,
        role: UserRoleInput = _MEMBER,
        /,
        *,
        profile: _Profile,
        send_welcome_email: bool = False,
        local: bool = True,
    ) -> _User:
        return _create_user(
            app,
            self,
            role=role,
            profile=profile,
            send_welcome_email=send_welcome_email,
            local=local,
        )

    def delete_users(self, app: _AppInfo, *users: Union[_GqlId, _User]) -> list[_GqlId]:
        return _delete_users(app, self, users=users)

    def list_users(self, app: _AppInfo) -> list[_User]:
        return _list_users(app, self)

    def patch_user_gid(
        self,
        app: _AppInfo,
        gid: _GqlId,
        /,
        *,
        new_username: Optional[_Username] = None,
        new_password: Optional[_Password] = None,
        new_role: Optional[UserRoleInput] = None,
    ) -> None:
        return _patch_user_gid(
            app,
            gid,
            self,
            new_username=new_username,
            new_password=new_password,
            new_role=new_role,
        )

    def patch_user(
        self,
        app: _AppInfo,
        user: _User,
        /,
        *,
        new_username: Optional[_Username] = None,
        new_password: Optional[_Password] = None,
        new_role: Optional[UserRoleInput] = None,
    ) -> _User:
        return _patch_user(
            app,
            user,
            self,
            new_username=new_username,
            new_password=new_password,
            new_role=new_role,
        )

    def patch_viewer(
        self,
        app: _AppInfo,
        /,
        *,
        new_username: Optional[_Username] = None,
        new_password: Optional[_Password] = None,
    ) -> None:
        return _patch_viewer(
            app,
            self,
            self.password,
            new_username=new_username,
            new_password=new_password,
        )

    def create_api_key(
        self,
        app: _AppInfo,
        kind: _ApiKeyKind = "User",
        /,
        *,
        name: Optional[_Name] = None,
        expires_at: Optional[datetime] = None,
    ) -> _ApiKey:
        return _create_api_key(app, self, kind, name=name, expires_at=expires_at)

    def delete_api_key(self, app: _AppInfo, api_key: _ApiKey, /) -> None:
        return _delete_api_key(app, api_key, self)

    def export_embeddings(self, app: _AppInfo, filename: str) -> None:
        _export_embeddings(app, self, filename=filename)

    def initiate_password_reset(
        self,
        app: _AppInfo,
        smtpd: smtpdfix.AuthController,
        /,
        *,
        should_receive_email: bool = True,
    ) -> Optional[_PasswordResetToken]:
        return _initiate_password_reset(
            app,
            self.email,
            smtpd,
            should_receive_email=should_receive_email,
        )


_SYSTEM_USER_GID = _GqlId(GlobalID(type_name="User", node_id="1"))
_DEFAULT_ADMIN = _User(
    _GqlId(GlobalID("User", "2")),
    _ADMIN,
    _Profile(
        email=DEFAULT_ADMIN_EMAIL,
        password=DEFAULT_ADMIN_PASSWORD,
        username=DEFAULT_ADMIN_USERNAME,
    ),
    profile_picture_url=None,
)

_ApiKeyKind = Literal["System", "User"]


class _ApiKey(str):
    def __new__(
        cls,
        string: str,
        gid: _GqlId,
        kind: _ApiKeyKind = "User",
    ) -> _ApiKey:
        return super().__new__(cls, string)

    def __init__(
        self,
        string: str,
        gid: _GqlId,
        kind: _ApiKeyKind = "User",
    ) -> None:
        self._gid = gid
        self._kind: _ApiKeyKind = kind

    @cached_property
    def gid(self) -> _GqlId:
        return self._gid

    @cached_property
    def kind(self) -> _ApiKeyKind:
        return self._kind


class _AdminSecret(str): ...


class _Token(str, ABC): ...


class _PasswordResetToken(_Token):
    def reset(self, app: _AppInfo, password: _Password, /) -> None:
        return _reset_password(app, self, password=password)


class _AccessToken(_Token, _CanLogOut[None]):
    def log_out(self, app: _AppInfo) -> None:
        _log_out(app, self)


class _RefreshToken(_Token, _CanLogOut[None]):
    def log_out(self, app: _AppInfo) -> None:
        _log_out(app, self)


@dataclass(frozen=True)
class _LoggedInTokens(_CanLogOut[None]):
    access_token: _AccessToken
    refresh_token: _RefreshToken

    @override
    def log_out(self, app: _AppInfo) -> None:
        self.access_token.log_out(app)

    def refresh(self, app: _AppInfo) -> _LoggedInTokens:
        resp = _httpx_client(app, self).post("auth/refresh")
        resp.raise_for_status()
        access_token = _AccessToken(resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        refresh_token = _RefreshToken(resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))
        return _LoggedInTokens(access_token, refresh_token)


@dataclass(frozen=True)
class _LoggedInUser(_User, _CanLogOut[_User]):
    tokens: _LoggedInTokens

    @property
    def user(self) -> _User:
        return _User(self.gid, self.role, self.profile, self.profile_picture_url)

    @override
    def log_out(self, app: _AppInfo) -> _User:
        self.tokens.access_token.log_out(app)
        return self.user

    def refresh(self, app: _AppInfo) -> _LoggedInUser:
        return replace(self, tokens=self.tokens.refresh(app))

    def visit(self, app: _AppInfo, expected_status_code: int = 200) -> None:
        response = _httpx_client(app, self).get("/graphql")
        assert response.status_code == expected_status_code


_RoleOrUser = Union[UserRoleInput, _User]
_SecurityArtifact: TypeAlias = Union[
    _AdminSecret,
    _AccessToken,
    _RefreshToken,
    _LoggedInTokens,
    _ApiKey,
    _LoggedInUser,
    _User,
]


class _UserGenerator(Protocol):
    def send(self, _: tuple[_AppInfo, UserRoleInput, Optional[_Profile]]) -> _User: ...


class _UserFactory(Protocol):
    def __call__(
        self,
        app: _AppInfo,
        role: UserRoleInput = _MEMBER,
        /,
        *,
        profile: Optional[_Profile] = None,
    ) -> _User: ...


class _GetUser(Protocol):
    def __call__(
        self,
        app: _AppInfo,
        role_or_user: Union[_User, UserRoleInput] = _MEMBER,
        /,
        *,
        profile: Optional[_Profile] = None,
    ) -> _User: ...


class _SpanExporterFactory(Protocol):
    def __call__(
        self,
        app: _AppInfo,
        /,
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter: ...


class _GetSpan(Protocol):
    def __call__(
        self,
        app: _AppInfo,
        /,
        project_name: Optional[str] = None,
        span_name: Optional[str] = None,
        attributes: Optional[dict[str, AttributeValue]] = None,
    ) -> ReadableSpan: ...


class _SendSpans(Protocol):
    def __call__(
        self,
        app: _AppInfo,
        api_key: Optional[_ApiKey] = None,
        /,
        spans: Iterable[ReadableSpan] = (),
        headers: Optional[dict[str, str]] = None,
    ) -> SpanExportResult: ...


@dataclass(frozen=True)
class _AppInfo:
    env: Mapping[str, str]

    def __post_init__(self) -> None:
        object.__setattr__(self, "env", MappingProxyType(dict(self.env)))

    @cached_property
    def base_url(self) -> str:
        scheme = (
            "https"
            if self.env.get(
                "PHOENIX_TLS_ENABLED_FOR_HTTP",
                self.env.get("PHOENIX_TLS_ENABLED", "false"),
            ).lower()
            == "true"
            else "http"
        )
        hostname = self.env.get("PHOENIX_HOSTNAME", "127.0.0.1")
        port = self.env.get("PHOENIX_PORT", "6006")
        path = self.env.get("PHOENIX_ROOT_PATH", "")
        return str(urljoin(f"{scheme}://{hostname}:{port}", path))

    @cached_property
    def grpc_url(self) -> str:
        scheme = (
            "https"
            if self.env.get(
                "PHOENIX_TLS_ENABLED_FOR_GRPC",
                self.env.get("PHOENIX_TLS_ENABLED", "false"),
            ).lower()
            == "true"
            else "http"
        )
        hostname = self.env.get("PHOENIX_HOSTNAME", "127.0.0.1")
        port = self.env.get("PHOENIX_GRPC_PORT", "4317")
        return f"{scheme}://{hostname}:{port}"

    @cached_property
    def admin_secret(self) -> _AdminSecret:
        return _AdminSecret(self.env.get("PHOENIX_ADMIN_SECRET", ""))

    @cached_property
    def certificate_file(self) -> Optional[str]:
        return self.env.get("PHOENIX_TLS_CERT_FILE")

    @cached_property
    def client_certificate_file(self) -> Optional[str]:
        return self.env.get("PHOENIX_TLS_CA_FILE")

    @cached_property
    def client_key_file(self) -> Optional[str]:
        return self.env.get("PHOENIX_TLS_CA_FILE")


def _http_span_exporter(
    app: _AppInfo,
    /,
    *,
    headers: Optional[_Headers] = None,
) -> SpanExporter:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

    endpoint = urljoin(app.base_url, "v1/traces")
    exporter = OTLPSpanExporter(
        endpoint=endpoint,
        headers=headers,
        certificate_file=app.certificate_file,
        client_key_file=app.client_key_file,
        client_certificate_file=app.client_certificate_file,
    )
    return exporter


def _grpc_span_exporter(
    app: _AppInfo,
    *,
    headers: Optional[_Headers] = None,
) -> SpanExporter:
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

    endpoint = app.grpc_url
    return OTLPSpanExporter(
        endpoint=endpoint,
        headers=headers,
        credentials=_load_credentials(
            certificate_file=app.certificate_file,
            client_key_file=app.client_key_file,
            client_certificate_file=app.client_certificate_file,
        ),
    )


def _change_port(url: str, new_port: int) -> str:
    # Parse the URL
    parsed_url = urlparse(url)

    # Replace the netloc part with the new port
    netloc = parsed_url.netloc
    if ":" in netloc:
        # If there's already a port, replace it
        netloc = netloc.split(":")[0] + f":{new_port}"
    else:
        # If there's no port, add it
        netloc = netloc + f":{new_port}"

    # Create a new parsed URL with the updated netloc
    updated_parts = parsed_url._replace(netloc=netloc)

    # Combine the parts back into a URL
    return urlunparse(updated_parts)


class _RandomIdGenerator(IdGenerator):
    """
    Generate random trace and span IDs without being influenced by the current seed.
    """

    def generate_span_id(self) -> int:
        return randbits(64)

    def generate_trace_id(self) -> int:
        return randbits(128)


def _get_tracer(
    *,
    project_name: _ProjectName,
    exporter: SpanExporter,
) -> Tracer:
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name})
    tracer_provider = TracerProvider(resource=resource, id_generator=_RandomIdGenerator())
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    return tracer_provider.get_tracer(__name__)


def _start_span(
    *,
    exporter: SpanExporter,
    project_name: Optional[str] = None,
    span_name: Optional[str] = None,
    attributes: Optional[Mapping[str, AttributeValue]] = None,
    start_time: Optional[int] = None,
) -> Span:
    return _get_tracer(
        project_name=project_name or token_hex(16),
        exporter=exporter,
    ).start_span(
        name=span_name or token_hex(16),
        attributes=attributes,
        start_time=start_time,
    )


class _DefaultAdminTokens(ABC):
    """
    Because the tests can be run concurrently, and we need the default admin to create database
    entities (e.g. to add new users), the default admin should never log out once logged in,
    because logging out invalidates all existing access tokens, resulting in a race among the
    tests. The approach here is to add a middleware to block any inadvertent use of the default
    admin's access tokens for logging out. This class is intended to be used as a singleton
    container to ensure that all tokens are always accounted for. Furthermore, the tokens are
    disambiguated by the port of the server to which they belong.
    """

    _set: set[tuple[int, str]] = set()
    _lock: Lock = Lock()

    @classmethod
    def __new__(cls) -> Self:
        raise NotImplementedError("This class is intended as a singleton to be used directly.")

    @classmethod
    def stash(cls, port: int, headers: Headers) -> None:
        tokens = _extract_tokens(headers, "set-cookie").values()
        for token in tokens:
            with cls._lock:
                cls._set.add((port, token))

    @classmethod
    def intersect(cls, port: int, headers: Headers) -> bool:
        tokens = _extract_tokens(headers).values()
        for token in tokens:
            with cls._lock:
                if (port, token) in cls._set:
                    return True
        return False


class _LogResponse(httpx.Response):
    def __init__(self, info: BytesIO, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._info = info

    def iter_bytes(self, *args: Any, **kwargs: Any) -> Iterator[bytes]:
        for chunk in super().iter_bytes(*args, **kwargs):
            self._info.write(chunk)
            yield chunk
        print(self._info.getvalue().decode())


def _get_token_from_cookie(cookie: str) -> str:
    return cookie.split(";", 1)[0].split("=", 1)[1]


_TEST_NAME: ContextVar[str] = ContextVar("test_name", default="")
_HTTPX_OP_IDX: ContextVar[int] = ContextVar("httpx_operation_index", default=0)


class _LogTransport(httpx.BaseTransport):
    def __init__(self, transport: httpx.BaseTransport) -> None:
        self._transport = transport

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        info = BytesIO()
        info.write(f"{'-' * 50}\n".encode())
        if test_name := _TEST_NAME.get():
            op_idx = _HTTPX_OP_IDX.get()
            _HTTPX_OP_IDX.set(op_idx + 1)
            info.write(f"({op_idx})".encode())
            info.write(f"{test_name}\n".encode())
        info.write(f"{request.method} {request.url}\n".encode())
        if token_ids := _decode_token_ids(request.headers):
            info.write(f"{' '.join(token_ids)}\n".encode())
        info.write(f"{request.headers}\n".encode())
        info.write(request.read())
        info.write(b"\n")
        try:
            response = self._transport.handle_request(request)
        except BaseException:
            print(info.getvalue().decode())
            raise
        info.write(f"{response.status_code} {response.headers}\n".encode())
        if returned_token_ids := _decode_token_ids(response.headers, "set-cookie"):
            info.write(f"{' '.join(returned_token_ids)}\n".encode())
        return _LogResponse(
            info=info,
            status_code=response.status_code,
            headers=response.headers,
            stream=response.stream,
            extensions=response.extensions,
        )


def _httpx_client(
    app: _AppInfo,
    auth: Optional[_SecurityArtifact] = None,
    headers: Optional[_Headers] = None,
    cookies: Optional[dict[str, Any]] = None,
    transport: Optional[httpx.BaseTransport] = None,
) -> httpx.Client:
    if isinstance(auth, _AccessToken):
        cookies = {**(cookies or {}), PHOENIX_ACCESS_TOKEN_COOKIE_NAME: auth}
    elif isinstance(auth, _RefreshToken):
        cookies = {**(cookies or {}), PHOENIX_REFRESH_TOKEN_COOKIE_NAME: auth}
    elif isinstance(auth, _LoggedInTokens):
        cookies = {
            **(cookies or {}),
            PHOENIX_ACCESS_TOKEN_COOKIE_NAME: auth.access_token,
            PHOENIX_REFRESH_TOKEN_COOKIE_NAME: auth.refresh_token,
        }
    elif isinstance(auth, _LoggedInUser):
        cookies = {
            **(cookies or {}),
            PHOENIX_ACCESS_TOKEN_COOKIE_NAME: auth.tokens.access_token,
            PHOENIX_REFRESH_TOKEN_COOKIE_NAME: auth.tokens.refresh_token,
        }
    elif isinstance(auth, _User):
        logged_in_user = auth.log_in(app)
        return _httpx_client(app, logged_in_user.tokens, headers, cookies, transport)
    elif isinstance(auth, _ApiKey):
        headers = {**(headers or {}), "authorization": f"Bearer {auth}"}
    elif isinstance(auth, _AdminSecret):
        headers = {**(headers or {}), "authorization": f"Bearer {auth}"}
    elif auth is None:
        pass
    else:
        assert_never(auth)
    ssl_context = _get_ssl_context(app.env)
    # Having no timeout is useful when stepping through the debugger on the server side.
    return httpx.Client(
        timeout=None,
        headers=headers,
        cookies=cookies,
        base_url=app.base_url,
        transport=_LogTransport(transport or httpx.HTTPTransport(verify=ssl_context or False)),
    )


def _get_ssl_context(env: Mapping[str, str]) -> Optional[ssl.SSLContext]:
    if (
        env.get("PHOENIX_TLS_ENABLED_FOR_HTTP", env.get("PHOENIX_TLS_ENABLED", "false")).lower()
        != "true"
    ):
        return None
    context = ssl.create_default_context()
    ca_file = env.get("PHOENIX_TLS_CERT_FILE")
    context.load_verify_locations(cafile=ca_file)
    if env.get("PHOENIX_TLS_VERIFY_CLIENT", "false").lower() != "true":
        return context
    assert (cert_file := env.get("PHOENIX_TLS_CA_FILE"))
    context.load_cert_chain(certfile=cert_file)
    return context


_SCHEMA_PREFIX = f"_{token_hex(3)}"


@contextmanager
def _server(app: _AppInfo) -> Iterator[_AppInfo]:
    if not (sql_database_url := app.env.get(ENV_PHOENIX_SQL_DATABASE_URL)):
        raise ValueError(f"{ENV_PHOENIX_SQL_DATABASE_URL} is required.")
    if sql_database_url.startswith("postgresql") and not str(
        app.env.get(ENV_PHOENIX_SQL_DATABASE_SCHEMA, "")
    ).startswith(_SCHEMA_PREFIX):
        raise ValueError(f"{ENV_PHOENIX_SQL_DATABASE_SCHEMA} should start with {_SCHEMA_PREFIX}")
    command = f"{sys.executable} -m phoenix.server.main serve"
    env = {**os.environ, **app.env} if sys.platform == "win32" else dict(app.env)
    process = Popen(command.split(), stdout=PIPE, stderr=STDOUT, text=True, env=env)
    log: list[str] = []
    lock: Lock = Lock()
    Thread(target=_capture_stdout, args=(process, log, lock), daemon=True).start()
    t = 60
    time_limit = time() + t
    timed_out = False
    url = str(urljoin(app.base_url, "healthz"))
    ssl_context = _get_ssl_context(app.env)
    while not timed_out and _is_alive(process):
        sleep(0.1)
        try:
            urlopen(url, context=ssl_context)
            break
        except BaseException:
            timed_out = time() > time_limit
    try:
        if timed_out:
            raise TimeoutError(f"Server {url} did not start within {t} seconds.")
        assert _is_alive(process)
        with lock:
            for line in log:
                print(line, end="")
            log.clear()
        yield app
        process.kill()
        process.wait(10)
    finally:
        for line in log:
            print(line, end="")


def _is_alive(
    process: Popen,
) -> bool:
    return process.is_running() and process.status() != STATUS_ZOMBIE


def _capture_stdout(
    process: Popen,
    log: list[str],
    lock: Lock,
) -> None:
    while _is_alive(process):
        line = process.stdout.readline()
        if line or (log and log[-1] != line):
            with lock:
                log.append(line)


@contextmanager
def _random_schema(
    url: URL,
) -> Iterator[str]:
    engine = create_engine(url.set(drivername="postgresql+psycopg"))
    engine.connect().close()
    engine.dispose()
    schema = f"{_SCHEMA_PREFIX}{token_hex(16)}"[:63]
    yield schema
    time_limit = time() + 30
    while time() < time_limit:
        try:
            with engine.connect() as conn:
                conn.execute(text(f"DROP SCHEMA {schema} CASCADE;"))
                conn.commit()
        except OperationalError as exc:
            if "too many clients" in str(exc):
                sleep(1)
                continue
            raise
        break
    engine.dispose()


def _gql(
    app: _AppInfo,
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    query: str,
    variables: Optional[Mapping[str, Any]] = None,
    operation_name: Optional[str] = None,
) -> tuple[dict[str, Any], Headers]:
    json_ = dict(query=query, variables=dict(variables or {}), operationName=operation_name)
    resp = _httpx_client(app, auth).post("graphql", json=json_)
    return _json(resp), resp.headers


def _get_gql_spans(
    app: _AppInfo,
    auth: Optional[_SecurityArtifact] = None,
    /,
    *fields: str,
) -> dict[_ProjectName, list[dict[str, Any]]]:
    out = "name spans{edges{node{" + " ".join(fields) + "}}}"
    query = "query{projects{edges{node{" + out + "}}}}"
    resp_dict, headers = _gql(app, auth, query=query)
    assert not resp_dict.get("errors")
    assert not headers.get("set-cookie")
    return {
        project["node"]["name"]: [span["node"] for span in project["node"]["spans"]["edges"]]
        for project in resp_dict["data"]["projects"]["edges"]
    }


def _list_users(
    app: _AppInfo,
    auth: Optional[_SecurityArtifact] = None,
    /,
) -> list[_User]:
    all_users = []
    has_next_page = True
    end_cursor = None

    while has_next_page:
        args = ["first:1000"]
        if end_cursor:
            args.append(f'after:"{end_cursor}"')
        args_str = f"({','.join(args)})"
        query = (
            "query{users"
            + args_str
            + "{edges{node{id email username profilePictureUrl role{name}}} pageInfo{hasNextPage endCursor}}}"
        )
        resp_dict, _ = _gql(app, auth, query=query)

        users_data = resp_dict["data"]["users"]
        users = [e["node"] for e in users_data["edges"]]
        all_users.extend(
            [
                _User(
                    _GqlId(u["id"]),
                    UserRoleInput(u["role"]["name"]),
                    _Profile(u["email"] or "", "", u["username"]),
                    profile_picture_url=u.get("profilePictureUrl"),
                )
                for u in users
            ]
        )

        page_info = users_data["pageInfo"]
        has_next_page = page_info["hasNextPage"]
        end_cursor = page_info["endCursor"]

    return all_users


def _create_user(
    app: _AppInfo,
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    role: UserRoleInput,
    profile: _Profile,
    send_welcome_email: bool = False,
    local: bool = True,
) -> _User:
    email = profile.email
    password = profile.password
    username = profile.username
    args = [f'email:"{email}"', f'password:"{password}"', f"role:{role.value}"]
    if username:
        args.append(f'username:"{username}"')
    if not local:
        args.append("authMethod:OAUTH2")
    args.append(f"sendWelcomeEmail:{str(send_welcome_email).lower()}")
    out = "user{id email profilePictureUrl role{name}}"
    query = "mutation{createUser(input:{" + ",".join(args) + "}){" + out + "}}"
    resp_dict, headers = _gql(app, auth, query=query)
    assert (user := resp_dict["data"]["createUser"]["user"])
    assert user["email"] == sanitize_email(email)
    assert user["role"]["name"] == role.value
    assert not headers.get("set-cookie")
    return _User(
        _GqlId(user["id"]), role, profile, profile_picture_url=user.get("profilePictureUrl")
    )


def _delete_users(
    app: _AppInfo,
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    users: Iterable[Union[_GqlId, _User]],
) -> list[_GqlId]:
    user_ids = [u.gid if isinstance(u, _User) else u for u in users]
    query = "mutation($userIds:[ID!]!){deleteUsers(input:{userIds:$userIds}){userIds}}"
    response, headers = _gql(app, auth, query=query, variables=dict(userIds=user_ids))
    assert not headers.get("set-cookie")
    return [_GqlId(user_id) for user_id in response["data"]["deleteUsers"]["userIds"]]


def _patch_user_gid(
    app: _AppInfo,
    gid: _GqlId,
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    new_username: Optional[_Username] = None,
    new_password: Optional[_Password] = None,
    new_role: Optional[UserRoleInput] = None,
) -> None:
    args = [f'userId:"{gid}"']
    if new_password:
        args.append(f'newPassword:"{new_password}"')
    if new_username:
        args.append(f'newUsername:"{new_username}"')
    if new_role:
        args.append(f"newRole:{new_role.value}")
    out = "user{id username role{name}}"
    query = "mutation{patchUser(input:{" + ",".join(args) + "}){" + out + "}}"
    resp_dict, headers = _gql(app, auth, query=query)
    assert (data := resp_dict["data"]["patchUser"])
    assert (result := data["user"])
    assert result["id"] == gid
    if new_username:
        assert result["username"] == new_username
    if new_role:
        assert result["role"]["name"] == new_role.value
    assert not headers.get("set-cookie")


def _patch_user(
    app: _AppInfo,
    user: _User,
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    new_username: Optional[_Username] = None,
    new_password: Optional[_Password] = None,
    new_role: Optional[UserRoleInput] = None,
) -> _User:
    _patch_user_gid(
        app,
        user.gid,
        auth,
        new_username=new_username,
        new_password=new_password,
        new_role=new_role,
    )
    if new_username:
        user = replace(user, profile=replace(user.profile, username=new_username))
    if new_role:
        user = replace(user, role=new_role)
    if new_password:
        user = replace(user, profile=replace(user.profile, password=new_password))
    return user


def _patch_viewer(
    app: _AppInfo,
    auth: Optional[_SecurityArtifact] = None,
    current_password: Optional[_Password] = None,
    /,
    *,
    new_username: Optional[_Username] = None,
    new_password: Optional[_Password] = None,
) -> None:
    args = []
    if new_password:
        args.append(f'newPassword:"{new_password}"')
    if current_password:
        args.append(f'currentPassword:"{current_password}"')
    if new_username:
        args.append(f'newUsername:"{new_username}"')
    out = "user{username}"
    query = "mutation{patchViewer(input:{" + ",".join(args) + "}){" + out + "}}"
    resp_dict, headers = _gql(app, auth, query=query)
    assert (data := resp_dict["data"]["patchViewer"])
    assert (user := data["user"])
    if new_username:
        assert user["username"] == new_username
    if new_password:
        assert headers.get("set-cookie")
    else:
        assert not headers.get("set-cookie")


def _create_api_key(
    app: _AppInfo,
    auth: Optional[_SecurityArtifact] = None,
    kind: _ApiKeyKind = "User",
    /,
    *,
    name: Optional[_Name] = None,
    expires_at: Optional[datetime] = None,
) -> _ApiKey:
    if name is None:
        name = datetime.now(timezone.utc).isoformat()
    exp = f' expiresAt:"{expires_at.isoformat()}"' if expires_at else ""
    args, out = (f'name:"{name}"' + exp), "jwt apiKey{id name expiresAt}"
    field = f"create{kind}ApiKey"
    query = "mutation{" + field + "(input:{" + args + "}){" + out + "}}"
    resp_dict, headers = _gql(app, auth, query=query)
    assert (data := resp_dict["data"][field])
    assert (key := data["apiKey"])
    assert key["name"] == name
    exp_t = datetime.fromisoformat(key["expiresAt"]) if key["expiresAt"] else None
    assert exp_t == expires_at
    assert not headers.get("set-cookie")
    return _ApiKey(data["jwt"], _GqlId(key["id"]), kind)


def _delete_api_key(
    app: _AppInfo,
    api_key: _ApiKey,
    auth: Optional[_SecurityArtifact] = None,
    /,
) -> None:
    kind = api_key.kind
    field = f"delete{kind}ApiKey"
    gid = api_key.gid
    args, out = f'id:"{gid}"', "apiKeyId"
    query = "mutation{" + field + "(input:{" + args + "}){" + out + "}}"
    resp_dict, headers = _gql(app, auth, query=query)
    assert resp_dict["data"][field]["apiKeyId"] == gid
    assert not headers.get("set-cookie")


def _will_be_asked_to_reset_password(
    app: _AppInfo,
    user: _User,
) -> bool:
    query = "query($gid:ID!){node(id:$gid){... on User{passwordNeedsReset}}}"
    variables = dict(gid=user.gid)
    resp_dict, _ = user.log_in(app).gql(app, query, variables)
    return cast(bool, resp_dict["data"]["node"]["passwordNeedsReset"])


def _log_in(
    app: _AppInfo,
    password: _Password,
    /,
    *,
    email: _Email,
) -> _LoggedInTokens:
    json_ = dict(email=email, password=password)
    resp = _httpx_client(app).post("auth/login", json=json_)
    resp.raise_for_status()
    assert (access_token := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
    assert (refresh_token := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))
    return _LoggedInTokens(_AccessToken(access_token), _RefreshToken(refresh_token))


def _log_out(
    app: _AppInfo,
    auth: Optional[_SecurityArtifact] = None,
    /,
) -> None:
    resp = _httpx_client(app, auth).get("auth/logout", follow_redirects=False)
    try:
        resp.raise_for_status()
    except HTTPStatusError as e:
        if e.response.status_code != 302:
            raise
        assert e.response.headers["location"] in ("/login", "/logout")
    tokens = _extract_tokens(resp.headers, "set-cookie")
    for k in _COOKIE_NAMES:
        assert tokens[k] == '""'


def _initiate_password_reset(
    app: _AppInfo,
    email: _Email,
    smtpd: smtpdfix.AuthController,
    /,
    *,
    should_receive_email: bool = True,
) -> Optional[_PasswordResetToken]:
    old_msg_count = len(smtpd.messages)
    json_ = dict(email=email)
    resp = _httpx_client(app).post("auth/password-reset-email", json=json_)
    resp.raise_for_status()
    new_msg_count = len(smtpd.messages) - old_msg_count
    assert new_msg_count == int(should_receive_email)
    if not should_receive_email:
        return None
    msg = smtpd.messages[-1]
    assert msg["to"] == sanitize_email(email)
    return _extract_password_reset_token(msg)


def _reset_password(
    app: _AppInfo,
    token: _PasswordResetToken,
    /,
    password: _Password,
) -> None:
    json_ = dict(token=token, password=password)
    resp = _httpx_client(app).post("auth/password-reset", json=json_)
    resp.raise_for_status()


def _export_embeddings(
    app: _AppInfo, auth: Optional[_SecurityArtifact] = None, /, *, filename: str
) -> None:
    resp = _httpx_client(app, auth).get("/exports", params={"filename": filename})
    resp.raise_for_status()


def _json(
    resp: httpx.Response,
) -> dict[str, Any]:
    resp.raise_for_status()
    assert (resp_dict := cast(dict[str, Any], resp.json()))
    if errers := resp_dict.get("errors"):
        msg = errers[0]["message"]
        # Raise Unauthorized for permission-related errors
        if (
            "not auth" in msg
            or IsAdmin.message in msg
            or "Viewers cannot perform this action" in msg
        ):
            raise Unauthorized(msg)
        raise RuntimeError(msg)
    return resp_dict


class _Expectation(Protocol):
    def __enter__(self) -> Optional[BaseException]: ...
    def __exit__(self, *args: Any, **kwargs: Any) -> None: ...


_OK_OR_DENIED: TypeAlias = AbstractContextManager[Optional[Unauthorized]]

_OK = nullcontext()
_DENIED = pytest.raises(Unauthorized)

_EXPECTATION_401 = pytest.raises(HTTPStatusError, match="401 Unauthorized")
_EXPECTATION_403 = pytest.raises(HTTPStatusError, match="403 Forbidden")
_EXPECTATION_404 = pytest.raises(HTTPStatusError, match="404 Not Found")


def _extract_tokens(
    headers: Headers,
    key: Literal["cookie", "set-cookie"] = "cookie",
) -> dict[str, str]:
    if not (cookies := headers.get(key)):
        return {}
    parts = re.split(r"[ ,;=]", cookies)
    return {k: v for k, v in zip(parts[:-1], parts[1:]) if k in _COOKIE_NAMES}


def _decode_token_ids(
    headers: Headers,
    key: Literal["cookie", "set-cookie"] = "cookie",
) -> list[str]:
    ans = []
    for v in _extract_tokens(headers, key).values():
        if v == '""':
            continue
        try:
            token = jwt.decode(v, options={"verify_signature": False})["jti"]
        except (DecodeError, KeyError):
            continue
        ans.append(token)
    return ans


def _extract_password_reset_token(msg: Message) -> _PasswordResetToken:
    assert (soup := _extract_html(msg))
    assert isinstance((link := soup.find(id="reset-url")), bs4.Tag)
    assert isinstance((url := link.get("href")), str)
    assert url
    params = parse_qs(urlparse(url).query)
    assert (tokens := params["token"])
    assert (token := tokens[0])
    decoded = jwt.decode(token, options=dict(verify_signature=False))
    assert (jti := decoded["jti"])
    assert jti.startswith("PasswordResetToken")
    return _PasswordResetToken(token)


def _extract_html(msg: Message) -> Optional[bs4.BeautifulSoup]:
    for part in msg.walk():
        if (
            part.get_content_type() == "text/html"
            and (payload := part.get_payload(decode=True))
            and isinstance(payload, bytes)
        ):
            content = payload.decode(part.get_content_charset() or "utf-8")
            return bs4.BeautifulSoup(content, "html.parser")
    return None


_COOKIE_NAMES = (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
    PHOENIX_OAUTH2_STATE_COOKIE_NAME,
    PHOENIX_OAUTH2_NONCE_COOKIE_NAME,
)


async def _await_or_return(obj: Union[_AnyT, Awaitable[_AnyT]]) -> _AnyT:
    """Helper function to handle both synchronous and asynchronous operations uniformly.

    This function enables writing code that works with both synchronous and asynchronous
    operations without duplicating logic. It takes either a regular value or an awaitable
    and returns the resolved value, abstracting away the sync/async distinction.

    Args:
        obj: Either a regular value or an awaitable (like a coroutine or Future)

    Returns:
        The resolved value. If obj was an awaitable, it will be awaited first.

    Example:
        # This works with both sync and async operations:
        result = await _await_or_return(some_operation())
    """
    if isinstance(obj, Awaitable):
        return cast(_AnyT, await obj)
    return obj


@dataclass
class _TestOverrides:
    """Dynamic test overrides for simulating IDP state changes."""

    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    user_logins_remaining: int = 0

    role: Optional[str] = None
    role_logins_remaining: int = 0

    email: Optional[str] = None
    email_logins_remaining: int = 0

    picture: Optional[str] = None
    picture_logins_remaining: int = 0

    def consume_user(self) -> Optional[tuple[str, str, str]]:
        """Consume and return user override if available."""
        if self.user_logins_remaining > 0:
            self.user_logins_remaining -= 1
            assert self.user_id is not None
            assert self.user_email is not None
            assert self.user_name is not None
            return self.user_id, self.user_email, self.user_name
        return None

    def consume_role(self) -> Optional[str]:
        """Consume and return role override if available."""
        if self.role_logins_remaining > 0:
            self.role_logins_remaining -= 1
            return self.role
        return None

    def consume_email(self) -> Optional[str]:
        """Consume and return email override if available."""
        if self.email_logins_remaining > 0:
            self.email_logins_remaining -= 1
            return self.email
        return None

    def consume_picture(self) -> Optional[str]:
        """Consume and return picture override if available."""
        if self.picture_logins_remaining > 0:
            self.picture_logins_remaining -= 1
            return self.picture
        return None


class _OIDCServer:
    """
    A mock OpenID Connect (OIDC) server implementation for testing OAuth2/OIDC authentication flows.

    This class provides a lightweight, in-memory OIDC server that simulates the behavior of a real
    OIDC identity provider. It implements the core OIDC endpoints required for testing authentication
    flows, including authorization, token issuance, and user information retrieval.

    The server runs in a separate thread and can be used as a context manager to ensure proper
    cleanup of resources. It generates random client credentials and signing keys for each instance,
    making it suitable for isolated test scenarios.

    Key features:
    - Implements standard OIDC endpoints (/auth, /token, /.well-known/openid-configuration, etc.)
    - Supports both standard OAuth2 authorization code flow and PKCE
    - Supports group-based access control claims
    - Generates JWT tokens with appropriate claims
    - Provides JWKS endpoint for token verification
    - Runs in a separate thread to avoid blocking the main test process

    PKCE Support:
    - Public clients (no client_secret): Validates code_verifier only
    - Confidential clients with PKCE: Validates BOTH client_secret AND code_verifier (defense-in-depth)

    Usage:
        # Standard OAuth2 flow
        with _OIDCServer(port=8000) as oidc_server:
            # Use oidc_server.client_id and oidc_server.client_secret for OAuth2 configuration
            # The server will be available at oidc_server.base_url

        # PKCE flow with groups
        with _OIDCServer(port=8000, use_pkce=True, groups=["admin", "users"]) as oidc_server:
            # PKCE-enabled server with group claims
            pass
    """

    def __init__(
        self,
        port: int,
        use_pkce: bool = False,
        groups: Optional[list[str]] = None,
        role: Optional[str] = None,
    ):
        """
        Initialize a new OIDC server instance.

        Args:
            port: The port number on which the server will listen.
            use_pkce: Enable PKCE (Proof Key for Code Exchange) support.
            groups: List of groups to include in ID token claims (for group-based access control testing).
            role: Role to include in ID token claims (for role mapping testing).
        """
        self._name: str = f"oidc_server_{token_hex(8)}"
        self._client_id: str = f"client_id_{token_hex(8)}"
        self._client_secret: str = f"client_secret_{token_hex(8)}"
        self._secret_key: str = f"secret_key_{token_hex(16)}"
        self._host: str = "127.0.0.1"
        self._port: int = port
        self._use_pkce: bool = use_pkce
        self._groups: list[str] = groups or []
        self._role: Optional[str] = role
        self._app = FastAPI()
        # PKCE state: maps auth_code -> code_challenge
        self._code_challenges: dict[str, str] = {}
        # Dynamic test overrides for simulating IDP state changes
        self._test_overrides = _TestOverrides()
        # Auth sessions: maps auth_code -> session info
        self._auth_sessions: dict[str, dict[str, Any]] = {}
        # Current session data for /userinfo endpoint
        self._current_session: Optional[dict[str, Any]] = None
        self._server: Optional[Generator[Thread, None, None]] = None
        self._thread: Optional[Thread] = None
        self._setup_routes()

    def _generate_session_data(self, nonce: Optional[str]) -> dict[str, Any]:
        """
        Generate session data for the current auth request, considering test overrides.

        Returns:
            Dictionary containing user_id, user_email, user_name, user_picture, nonce, session_role, session_groups
        """
        # Determine user identity
        user_override = self._test_overrides.consume_user()
        if user_override:
            user_id, user_email, user_name = user_override
        else:
            user_id = f"user_id_{token_hex(8)}"
            user_email = _randomize_casing(f"{string.ascii_lowercase}@{token_hex(16)}.com")
            user_name = f"User {token_hex(8)}"

        # Apply email override (independent of user override)
        email_override = self._test_overrides.consume_email()
        if email_override:
            user_email = email_override

        # Determine profile picture
        picture_override = self._test_overrides.consume_picture()
        user_picture = (
            picture_override if picture_override is not None else "https://example.com/picture.jpg"
        )

        # Determine role
        role_override = self._test_overrides.consume_role()
        session_role = role_override if role_override is not None else self._role

        return {
            "user_id": user_id,
            "user_email": user_email,
            "user_name": user_name,
            "user_picture": user_picture,
            "nonce": nonce,
            "session_role": session_role,
            "session_groups": self._groups,
        }

    def _setup_routes(self) -> None:
        """
        Set up the FastAPI routes for the OIDC server.

        This method configures all the necessary endpoints for OIDC functionality:
        - /auth: Authorization endpoint that simulates the initial OAuth2 authorization request.
        - /token: Token endpoint that exchanges authorization codes for tokens
        - /.well-known/openid-configuration: Discovery document for OIDC clients
        - /userinfo: User information endpoint
        - /.well-known/jwks.json: JSON Web Key Set for token verification
        """

        @self._app.get("/auth")
        async def auth(request: Request) -> Response:
            """
            Authorization endpoint that simulates the initial OAuth2 authorization request.

            Validates the client_id and returns a redirect with an authorization code.
            For PKCE flows, also receives and stores the code_challenge.
            """
            params = dict(request.query_params)
            if params.get("client_id") != self._client_id:
                return JSONResponse({"error": "invalid_client"}, status_code=400)

            state = params.get("state")
            nonce = params.get("nonce")
            redirect_uri = params.get("redirect_uri")

            # Generate unique authorization code
            auth_code = f"auth_code_{token_hex(16)}"

            # PKCE: Store code_challenge if provided
            if self._use_pkce:
                code_challenge = params.get("code_challenge")
                code_challenge_method = params.get("code_challenge_method")

                if not code_challenge:
                    return JSONResponse(
                        {
                            "error": "invalid_request",
                            "error_description": "code_challenge required",
                        },
                        status_code=400,
                    )

                if code_challenge_method != "S256":
                    return JSONResponse(
                        {
                            "error": "invalid_request",
                            "error_description": "code_challenge_method must be S256",
                        },
                        status_code=400,
                    )

                self._code_challenges[auth_code] = code_challenge

            # Generate session data for this authorization request
            session_data = self._generate_session_data(nonce)

            # Store session info keyed by auth_code
            self._auth_sessions[auth_code] = session_data

            # Also store as current session so properties (user_email, etc.) work immediately
            self._current_session = session_data

            return RedirectResponse(
                f"{redirect_uri}?code={auth_code}&state={state}",
                status_code=302,
            )

        @self._app.post("/token")
        async def token(request: Request) -> Response:
            """
            Token endpoint that exchanges authorization codes for access and ID tokens.

            Supports both standard OAuth2 and PKCE flows:
            - Standard: Validates client_secret via HTTP Basic Auth
            - PKCE: Validates code_verifier against stored code_challenge
            - Confidential + PKCE: Validates BOTH client_secret AND code_verifier

            Returns a token response with access_token, id_token, and refresh_token.
            """
            from hashlib import sha256

            form_data = await request.form()
            code = form_data.get("code")

            if not code:
                return JSONResponse(
                    {"error": "invalid_request", "error_description": "code required"},
                    status_code=400,
                )

            # Type assertions for form data (FastAPI form_data.get returns Union[UploadFile, str])
            assert isinstance(code, str)

            # Step 1: Validate client authentication (if required)
            client_authenticated = False
            auth_header = request.headers.get("Authorization")

            # Try HTTP Basic Auth (client_secret_basic)
            if auth_header and auth_header.startswith("Basic "):
                try:
                    credentials = b64decode(auth_header[6:]).decode()
                    client_id, client_secret = credentials.split(":", 1)
                    if client_id == self._client_id and client_secret == self._client_secret:
                        client_authenticated = True
                except Exception:
                    pass

            # Try POST body (client_secret_post)
            if not client_authenticated:
                body_client_id = form_data.get("client_id")
                body_client_secret = form_data.get("client_secret")
                if body_client_id == self._client_id and body_client_secret == self._client_secret:
                    client_authenticated = True

            # Step 2: Validate PKCE (if required)
            pkce_valid = False
            code_verifier = form_data.get("code_verifier")

            if self._use_pkce and code in self._code_challenges:
                # Reject missing or empty code_verifier
                if not code_verifier:
                    return JSONResponse(
                        {
                            "error": "invalid_request",
                            "error_description": "code_verifier required for PKCE",
                        },
                        status_code=400,
                    )

                assert isinstance(code_verifier, str)

                # Compute challenge from verifier
                challenge = (
                    urlsafe_b64encode(sha256(code_verifier.encode()).digest()).decode().rstrip("=")
                )

                stored_challenge = self._code_challenges.get(code)
                if challenge == stored_challenge:
                    pkce_valid = True
                    # Clean up after successful validation
                    del self._code_challenges[code]
                else:
                    return JSONResponse(
                        {
                            "error": "invalid_grant",
                            "error_description": "code_verifier does not match code_challenge",
                        },
                        status_code=400,
                    )

            # Step 3: Determine authentication mode and validate
            if self._use_pkce:
                # PKCE flow
                if not pkce_valid:
                    return JSONResponse(
                        {"error": "invalid_grant", "error_description": "PKCE validation failed"},
                        status_code=400,
                    )
                # For confidential clients with PKCE, also check client_secret if provided
                # (This is defense-in-depth: both PKCE and client_secret)
                # If client_secret is in the request, it must be valid
                if auth_header or form_data.get("client_secret"):
                    if not client_authenticated:
                        return JSONResponse(
                            {
                                "error": "invalid_client",
                                "error_description": "Invalid client credentials",
                            },
                            status_code=400,
                        )
            else:
                # Standard flow (non-PKCE): Validate code_verifier BEFORE client auth
                # to avoid leaking information about server configuration
                if code_verifier is not None and code_verifier != "":
                    return JSONResponse(
                        {
                            "error": "invalid_request",
                            "error_description": "code_verifier not allowed when PKCE is not enabled",
                        },
                        status_code=400,
                    )

                # Now validate client authentication
                if not client_authenticated:
                    return JSONResponse(
                        {
                            "error": "invalid_client",
                            "error_description": "Invalid client credentials",
                        },
                        status_code=400,
                    )

            # Retrieve session info for this auth code
            session = self._auth_sessions.get(code)
            if not session:
                return JSONResponse(
                    {
                        "error": "invalid_grant",
                        "error_description": "Invalid or expired authorization code",
                    },
                    status_code=400,
                )

            # Store as current session for /userinfo endpoint
            self._current_session = session

            # Clean up session after first use (proper OAuth2 single-use behavior)
            del self._auth_sessions[code]

            # Create ID token with required claims
            now = int(time())
            id_token_claims = {
                "iss": self.base_url,
                "sub": session["user_id"],
                "aud": self._client_id,
                "iat": now,
                "exp": now + 3600,
                "email": session["user_email"],
                "name": session["user_name"],
                "picture": session["user_picture"],
                "nonce": session["nonce"],
            }

            # Add role if configured
            if session["session_role"]:
                id_token_claims["role"] = session["session_role"]

            # NOTE: Groups are intentionally NOT included in ID token to simulate
            # real-world IDPs (AWS Cognito, Azure AD) that keep ID tokens small.
            # Groups must be fetched from the /userinfo endpoint instead.

            id_token = jwt.encode(
                payload=id_token_claims,
                key=self._secret_key.encode(),
                algorithm="HS256",
            )

            # Return token response with all required fields
            return JSONResponse(
                {
                    "access_token": f"access_token_{token_hex(8)}",
                    "id_token": id_token,
                    "token_type": "bearer",
                    "expires_in": 3600,  # 1 hour in seconds
                    "refresh_token": f"refresh_token_{token_hex(8)}",
                    "scope": "openid profile email",
                }
            )

        @self._app.get("/.well-known/openid-configuration")
        async def openid_configuration() -> Response:
            """
            OpenID Connect discovery document endpoint.

            Returns the standard OIDC configuration document that clients use to
            discover the endpoints and capabilities of this identity provider.
            """
            config = {
                "issuer": self.base_url,
                "authorization_endpoint": self.auth_url,
                "token_endpoint": self.token_url,
                "userinfo_endpoint": f"{self.base_url}/userinfo",
                "jwks_uri": f"{self.base_url}/.well-known/jwks.json",
                "response_types_supported": ["code"],
                "subject_types_supported": ["public"],
                "id_token_signing_alg_values_supported": ["HS256"],
                "scopes_supported": ["openid", "profile", "email"],
                "token_endpoint_auth_methods_supported": [
                    "client_secret_basic",
                    "client_secret_post",
                ],
                "claims_supported": [
                    "sub",
                    "iss",
                    "aud",
                    "exp",
                    "iat",
                    "name",
                    "email",
                    "picture",
                ],
            }

            # Add PKCE support to discovery document
            if self._use_pkce:
                config["code_challenge_methods_supported"] = ["S256"]
                # Public clients don't require client authentication
                token_auth_methods = config["token_endpoint_auth_methods_supported"]
                assert isinstance(token_auth_methods, list)
                token_auth_methods.append("none")

            # Add role claim if configured
            if self._role:
                claims_supported = config["claims_supported"]
                assert isinstance(claims_supported, list)
                claims_supported.append("role")

            # Add groups claim if configured
            if self._groups:
                claims_supported = config["claims_supported"]
                assert isinstance(claims_supported, list)
                claims_supported.append("groups")

            return JSONResponse(config)

        @self._app.get("/userinfo")
        async def userinfo() -> Response:
            """
            User information endpoint.

            Returns a JSON response with user profile information that would typically
            be retrieved from a real identity provider's user database.
            Includes groups claim if configured.
            """
            if not self._current_session:
                return JSONResponse(
                    {"error": "invalid_token", "error_description": "No active session"},
                    status_code=401,
                )

            user_info = {
                "sub": self._current_session["user_id"],
                "name": self._current_session["user_name"],
                "email": self._current_session["user_email"],
                "picture": self._current_session["user_picture"],
            }

            # Add role if configured
            if self._current_session["session_role"]:
                user_info["role"] = self._current_session["session_role"]

            # Add groups if configured
            if self._current_session["session_groups"]:
                user_info["groups"] = self._current_session["session_groups"]

            return JSONResponse(user_info)

        @self._app.get("/.well-known/jwks.json")
        async def jwks() -> Response:
            """
            JSON Web Key Set endpoint.

            Returns the public keys that clients can use to verify the signatures
            of ID tokens issued by this server. In this implementation, we're using
            a symmetric key (HS256) for simplicity, but in a real OIDC provider,
            this would typically use asymmetric keys (RS256).
            """
            # Base64url encode the secret key
            encoded_key = urlsafe_b64encode(self._secret_key.encode()).decode().rstrip("=")
            return JSONResponse(
                {
                    "keys": [
                        {
                            "kty": "oct",
                            "kid": "test_key_id",
                            "use": "sig",
                            "alg": "HS256",
                            "k": encoded_key,
                        }
                    ]
                }
            )

    def __enter__(self) -> Self:
        self._server = ThreadServer(
            app=self._app,
            host=self._host,
            port=self._port,
            root_path="",
        ).run_in_thread()
        self._thread = next(self._server)
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> None:
        if not self._server:
            return
        self._server.close()
        if not self._thread:
            return
        self._thread.join(timeout=5)

    @cached_property
    def base_url(self) -> str:
        return f"http://{self._host}:{self._port}"

    @cached_property
    def auth_url(self) -> str:
        return f"{self.base_url}/auth"

    @cached_property
    def token_url(self) -> str:
        return f"{self.base_url}/token"

    @property
    def user_id(self) -> Optional[str]:
        """Get the current user ID."""
        return self._current_session["user_id"] if self._current_session else None

    @property
    def user_email(self) -> Optional[str]:
        """Get the current user email."""
        return self._current_session["user_email"] if self._current_session else None

    @property
    def user_name(self) -> Optional[str]:
        """Get the current user name."""
        return self._current_session["user_name"] if self._current_session else None

    @property
    def client_id(self) -> str:
        """Get the OAuth client ID."""
        return self._client_id

    @property
    def client_secret(self) -> str:
        """Get the OAuth client secret."""
        return self._client_secret

    @property
    def groups(self) -> list[str]:
        """Get the configured groups for this OIDC server."""
        return self._groups

    @property
    def role(self) -> Optional[str]:
        """Get the configured role for this OIDC server."""
        return self._role

    def set_role(self, role: Optional[str], num_logins: int) -> None:
        """
        Dynamically update the role that will be returned in ID token and userinfo claims.

        This is useful for testing scenarios where a user's role changes in the IDP
        between login sessions (e.g., a user gets promoted from MEMBER to ADMIN).

        Args:
            role: The new role value to return in claims, or None to remove role claims
            num_logins: Number of logins to use this role for (must be > 0)

        Example:
            server.set_role("Owner", num_logins=1)
        """
        assert num_logins > 0, "num_logins must be > 0"
        self._test_overrides.role = role
        self._test_overrides.role_logins_remaining = num_logins

    def set_email(self, email: str, num_logins: int) -> None:
        """
        Dynamically update the email that will be returned in ID token and userinfo claims.

        This is useful for testing scenarios where a user's email changes in the IDP
        between login sessions (e.g., a user updates their email address). This is
        independent of set_user() and allows changing just the email while keeping
        the same user_id.

        Args:
            email: The new email address to return in claims
            num_logins: Number of logins to use this email for (must be > 0)

        Example:
            server.set_user("user_123", "alice@example.com", num_logins=2)
            email1, _, _ = await complete_flow(app, server)  # alice@example.com

            server.set_email("alice.new@example.com", num_logins=1)
            email2, _, _ = await complete_flow(app, server)  # alice.new@example.com
        """
        assert num_logins > 0, "num_logins must be > 0"
        self._test_overrides.email = email
        self._test_overrides.email_logins_remaining = num_logins

    def set_picture(self, picture: str, num_logins: int) -> None:
        """
        Dynamically update the profile picture URL that will be returned in userinfo claims.

        This is useful for testing scenarios where a user's profile picture changes in the IDP
        between login sessions (e.g., a user updates their avatar). This is independent of
        set_user() and allows changing just the picture while keeping the same user_id.

        Args:
            picture: The new profile picture URL to return in claims
            num_logins: Number of logins to use this picture for (must be > 0)

        Example:
            server.set_user("user_123", "alice@example.com", num_logins=2)
            # First login - default picture

            server.set_picture("https://example.com/new_avatar.jpg", num_logins=1)
            # Second login - updated picture
        """
        assert num_logins > 0, "num_logins must be > 0"
        self._test_overrides.picture = picture
        self._test_overrides.picture_logins_remaining = num_logins

    def set_user(
        self,
        user_id: str,
        email: str,
        num_logins: int,
        name: Optional[str] = None,
    ) -> None:
        """
        Set a persistent user identity for the next N login flows.

        By default, the mock OIDC server generates a new random user on each /auth request.
        This method allows you to persist a user's identity across multiple login flows,
        which is essential for testing scenarios where the same user logs in multiple times
        (e.g., to test role updates or email changes).

        After num_logins auth requests, the server automatically reverts to generating
        random users, so no manual cleanup is needed.

        Args:
            user_id: The persistent user ID (sub claim) to use
            email: The persistent email to use
            num_logins: Number of login flows to use this user for (must be > 0)
            name: Optional name for the user (defaults to "User {user_id}" if None)

        Example:
            server.set_user("user_123", "alice@example.com", num_logins=2)
            email1, _, _ = await complete_flow(app, server)  # First login
            server.set_role("Owner", num_logins=1)  # Change role in IDP
            email2, _, _ = await complete_flow(app, server)  # Second login - same user!
            assert email1 == email2
        """
        assert num_logins > 0, "num_logins must be > 0"
        self._test_overrides.user_id = user_id
        self._test_overrides.user_email = email
        self._test_overrides.user_name = name if name is not None else f"User {user_id}"
        self._test_overrides.user_logins_remaining = num_logins

    @property
    def use_pkce(self) -> bool:
        """Check if PKCE is enabled for this OIDC server."""
        return self._use_pkce

    def __str__(self) -> str:
        return self._name


T = TypeVar("T")


async def _get(
    query_fn: Callable[..., Optional[T]] | Callable[..., Awaitable[Optional[T]]],
    args: Sequence[Any] = (),
    kwargs: Mapping[str, Any] = MappingProxyType({}),
    error_msg: str = "",
    no_wait: bool = False,
    retries: int = 20,
    initial_wait_time: float = 0.1,
    max_wait_time: float = 1,
) -> T:
    """If no_wait, run the query once. Otherwise, retry it if it returns None
    and raise if retries are exhausted.

    Args:
        query_fn: Function that returns Optional[T] or Awaitable[Optional[T]]
        args: Positional arguments for query_fn
        kwargs: Keyword arguments for query_fn
        error_msg: Error message if all retries fail
        no_wait: If True, only try once without retries
        retries: Maximum number of retry attempts
        initial_wait_time: Initial wait time between retries in seconds
        max_wait_time: Maximum wait time between retries in seconds

    Returns:
        Result from query_fn

    Raises:
        AssertionError: If query_fn returns None after all retries
    """
    from asyncio import sleep

    wt = 0 if no_wait else initial_wait_time
    while True:
        await sleep(wt)
        res = query_fn(*args, **kwargs)
        ans = cast(Optional[T], await res) if isinstance(res, Awaitable) else res
        if ans is not None:
            return ans
        if no_wait or not retries:
            raise AssertionError(error_msg)
        retries -= 1
        wt = min(wt * 1.5, max_wait_time)


_SpanId: TypeAlias = str
_TraceId: TypeAlias = str
_SessionId: TypeAlias = str

_SpanGlobalId: TypeAlias = GlobalID
_TraceGlobalId: TypeAlias = GlobalID
_SessionGlobalId: TypeAlias = GlobalID
_ProjectGlobalId: TypeAlias = GlobalID


class _ExistingProject(NamedTuple):
    id: _ProjectGlobalId
    name: _ProjectName


class _ExistingSession(NamedTuple):
    id: _SessionGlobalId
    session_id: _SessionId


class _ExistingTrace(NamedTuple):
    id: _TraceGlobalId
    trace_id: _TraceId
    project: _ExistingProject
    session: Optional[_ExistingSession]


class _ExistingSpan(NamedTuple):
    id: _SpanGlobalId
    span_id: _SpanId
    trace: _ExistingTrace


def _insert_spans(app: _AppInfo, n: int) -> tuple[_ExistingSpan, ...]:
    assert n > 0, "Number of spans to insert must be greater than 0"
    memory = InMemorySpanExporter()
    project_name = token_hex(16)
    for _ in range(n):
        _start_span(
            project_name=project_name,
            attributes={
                "session.id": token_hex(8),
                "retrieval.documents.0.document.id": token_hex(8),
                "retrieval.documents.1.document.id": token_hex(8),
                "retrieval.documents.2.document.id": token_hex(8),
            },
            exporter=memory,
        ).end()
    assert len(spans := memory.get_finished_spans()) == n

    headers = {"authorization": f"Bearer {app.admin_secret}"}
    assert _grpc_span_exporter(app, headers=headers).export(spans) is SpanExportResult.SUCCESS

    span_ids = set()
    for span in spans:
        assert (context := span.get_span_context())  # type: ignore[no-untyped-call]
        span_ids.add(format_span_id(context.span_id))
    assert len(span_ids) == n

    return asyncio.run(
        _get(
            lambda: tuple(ans) if len(ans := _get_existing_spans(app, span_ids)) == n else None,
            error_msg="spans not found",
        )
    )


def _get_existing_spans(
    app: _AppInfo,
    span_ids: Iterable[_SpanId],
) -> set[_ExistingSpan]:
    ids = list(span_ids)
    query = """
      query ($spanId: String!) {
        getSpanByOtelId(spanId: $spanId) {
          id
          spanId
          trace {
            id
            traceId
            project {
              id
              name
            }
            session {
              id
              sessionId
            }
          }
        }
      }
    """
    result: set[_ExistingSpan] = set()
    for span_id in ids:
        res, _ = _gql(
            app,
            app.admin_secret,
            query=query,
            variables={"spanId": span_id},
        )
        span = res["data"]["getSpanByOtelId"]
        if span is None:
            continue
        result.add(
            _ExistingSpan(
                id=GlobalID.from_id(span["id"]),
                span_id=span["spanId"],
                trace=_ExistingTrace(
                    id=GlobalID.from_id(span["trace"]["id"]),
                    trace_id=span["trace"]["traceId"],
                    project=_ExistingProject(
                        id=GlobalID.from_id(span["trace"]["project"]["id"]),
                        name=span["trace"]["project"]["name"],
                    ),
                    session=(
                        _ExistingSession(
                            id=GlobalID.from_id(span["trace"]["session"]["id"]),
                            session_id=span["trace"]["session"]["sessionId"],
                        )
                        if span["trace"]["session"] is not None
                        else None
                    ),
                ),
            )
        )
    return result


async def _until_spans_exist(app: _AppInfo, span_ids: Iterable[_SpanId]) -> None:
    ids = set(span_ids)
    await _get(lambda: (len(_get_existing_spans(app, ids)) == len(ids)) or None)


def _randomize_casing(email: str) -> str:
    return "".join(c.lower() if random() < 0.5 else c.upper() for c in email)


# GET endpoints that all roles can read with expected status codes
_COMMON_RESOURCE_ENDPOINTS = (
    # Projects
    (404, "GET", "v1/projects/fake-id-{}"),
    (200, "GET", "v1/projects"),
    # Datasets
    (422, "GET", "v1/datasets/fake-id-{}"),
    (200, "GET", "v1/datasets"),
    (422, "GET", "v1/datasets/fake-id-{}/versions"),
    (422, "GET", "v1/datasets/fake-id-{}/examples"),
    (422, "GET", "v1/datasets/fake-id-{}/csv"),
    (422, "GET", "v1/datasets/fake-id-{}/jsonl/openai_ft"),
    (422, "GET", "v1/datasets/fake-id-{}/jsonl/openai_evals"),
    # Experiments
    (422, "GET", "v1/experiments/fake-id-{}"),
    (422, "GET", "v1/datasets/fake-id-{}/experiments"),
    (422, "GET", "v1/experiments/fake-id-{}/runs"),
    (422, "GET", "v1/experiments/fake-id-{}/incomplete-runs"),
    (422, "GET", "v1/experiments/fake-id-{}/incomplete-evaluations"),
    (422, "GET", "v1/experiments/fake-id-{}/json"),
    (422, "GET", "v1/experiments/fake-id-{}/csv"),
    # Prompts
    (200, "GET", "v1/prompts"),
    (200, "GET", "v1/prompts/fake-id-{}/versions"),
    (422, "GET", "v1/prompt_versions/fake-id-{}"),
    (404, "GET", "v1/prompts/fake-id-{}/tags/test-tag"),
    (404, "GET", "v1/prompts/fake-id-{}/latest"),
    (422, "GET", "v1/prompt_versions/fake-id-{}/tags"),
    # Annotation configs
    (200, "GET", "v1/annotation_configs"),
    (404, "GET", "v1/annotation_configs/fake-id-{}"),
    # Evaluations
    (404, "GET", "v1/evaluations"),
    # Spans (project-scoped)
    (404, "GET", "v1/projects/fake-id-{}/spans"),
    (404, "GET", "v1/projects/fake-id-{}/spans/otlpv1"),
    # Annotations (project-scoped)
    (422, "GET", "v1/projects/fake-id-{}/span_annotations"),
    (422, "GET", "v1/projects/fake-id-{}/trace_annotations"),
    (422, "GET", "v1/projects/fake-id-{}/session_annotations"),
    # Spans
    (422, "GET", "v1/spans"),
)

# Admin-only endpoints (user management, project CRUD)
# Non-admins always receive 403, admins get expected_admin_status
_ADMIN_ONLY_ENDPOINTS = (
    (200, "GET", "v1/users"),
    (422, "POST", "v1/users"),
    (422, "DELETE", "v1/users/fake-id-{}"),
    (422, "PUT", "v1/projects/fake-id-{}"),
    (404, "DELETE", "v1/projects/fake-id-{}"),
)

# Write operations blocked for viewers (POST/PUT/DELETE)
# Viewers always receive 403, non-viewers (admins/members) get expected_non_viewer_status
_VIEWER_BLOCKED_WRITE_OPERATIONS = (
    # POST routes
    (422, "POST", "v1/annotation_configs"),
    (400, "POST", "v1/datasets/upload"),
    (422, "POST", "v1/datasets/fake-id-{}/experiments"),
    (422, "POST", "v1/document_annotations"),
    (415, "POST", "v1/evaluations"),
    (422, "POST", "v1/experiment_evaluations"),
    (422, "POST", "v1/experiments/fake-id-{}/runs"),
    (422, "POST", "v1/projects"),
    (422, "POST", "v1/projects/fake-id-{}/spans"),
    (422, "POST", "v1/prompts"),
    (422, "POST", "v1/prompt_versions/fake-id-{}/tags"),
    (422, "POST", "v1/session_annotations"),
    (422, "POST", "v1/span_annotations"),
    (422, "POST", "v1/span_notes"),
    (422, "POST", "v1/spans"),
    (422, "POST", "v1/trace_annotations"),
    (415, "POST", "v1/traces"),
    # PUT routes
    (422, "PUT", "v1/annotation_configs/fake-id-{}"),
    # DELETE routes
    (422, "DELETE", "v1/annotation_configs/fake-id-{}"),
    (422, "DELETE", "v1/datasets/fake-id-{}"),
    (422, "DELETE", "v1/experiments/fake-id-{}"),
    (404, "DELETE", "v1/spans/fake-id-{}"),
    (404, "DELETE", "v1/traces/fake-id-{}"),
)


def _ensure_endpoint_coverage_is_exhaustive() -> None:
    """Verify that test constants cover all actual v1 API routes.

    This runs at module import time as a prerequisite check. If endpoint
    coverage is incomplete, all tests that import this module will fail fast.
    """
    import re

    from fastapi.routing import APIRoute

    from phoenix.server.api.routers.v1 import create_v1_router

    # Get all actual routes from the v1 router
    router = create_v1_router(authentication_enabled=False)
    actual_routes = {
        (method, route.path)
        for route in router.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    }

    # Get all routes from test constants
    test_routes = {
        (method, endpoint)
        for _, method, endpoint in chain(
            _COMMON_RESOURCE_ENDPOINTS,
            _ADMIN_ONLY_ENDPOINTS,
            _VIEWER_BLOCKED_WRITE_OPERATIONS,
        )
    }

    # Normalize paths: server uses {param_name}, tests use fake-id-{}
    def normalize_path(path: str) -> str:
        if not path.startswith("/"):
            path = "/" + path
        path = re.sub(r"fake-id-\{\}", "{id}", path)
        path = re.sub(r"\{[^}]*\}", "{id}", path)
        path = re.sub(r"/tags/test-tag$", "/tags/{id}", path)
        return path

    # Map normalized paths back to original paths for error reporting
    normalized_to_actual = {(m, normalize_path(p)): (m, p) for m, p in actual_routes}
    normalized_to_test = {(m, normalize_path(p)): (m, p) for m, p in test_routes}

    normalized_actual = set(normalized_to_actual.keys())
    normalized_test = set(normalized_to_test.keys())

    # Check for discrepancies
    missing_in_tests = normalized_actual - normalized_test
    extra_in_tests = normalized_test - normalized_actual

    if missing_in_tests or extra_in_tests:
        error_parts = []
        if missing_in_tests:
            # Show actual server paths (not normalized)
            actual_paths = [normalized_to_actual[route] for route in sorted(missing_in_tests)]
            routes_str = "\n".join(f"  {m} {p}" for m, p in actual_paths)
            error_parts.append(
                f"Routes in server but NOT in test constants:\n{routes_str}\n\n"
                f"Add these to _helpers.py:\n"
                f"  - GET routes → _COMMON_RESOURCE_ENDPOINTS\n"
                f"  - Admin-only routes (users, project CRUD) → _ADMIN_ONLY_ENDPOINTS\n"
                f"  - Write operations (POST/PUT/DELETE) → _VIEWER_BLOCKED_WRITE_OPERATIONS\n\n"
                f"Format: (expected_status_code, method, endpoint_path)\n"
                f'Example: (404, "GET", "v1/projects/fake-id-{{}}") or (422, "POST", "v1/datasets/upload")'
            )
        if extra_in_tests:
            # Show actual test paths (not normalized)
            test_paths = [normalized_to_test[route] for route in sorted(extra_in_tests)]
            routes_str = "\n".join(f"  {m} {p}" for m, p in test_paths)
            error_parts.append(
                f"Routes in test constants but NOT in server (removed?):\n{routes_str}\n\n"
                f"Remove these from _COMMON_RESOURCE_ENDPOINTS, _ADMIN_ONLY_ENDPOINTS,\n"
                f"or _VIEWER_BLOCKED_WRITE_OPERATIONS in _helpers.py"
            )
        raise AssertionError("Endpoint coverage is incomplete!\n\n" + "\n\n".join(error_parts))


_ensure_endpoint_coverage_is_exhaustive()
