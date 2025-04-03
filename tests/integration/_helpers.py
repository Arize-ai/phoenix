from __future__ import annotations

import os
import re
import sys
from abc import ABC, abstractmethod
from collections.abc import Iterable, Iterator, Mapping
from contextlib import AbstractContextManager, contextmanager, nullcontext
from contextvars import ContextVar
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from email.message import Message
from functools import cached_property
from io import BytesIO
from secrets import randbits, token_hex
from subprocess import PIPE, STDOUT
from threading import Lock, Thread
from time import sleep, time
from typing import Any, Awaitable, Generic, Literal, Optional, Protocol, TypeVar, Union, cast
from urllib.parse import parse_qs, urljoin, urlparse
from urllib.request import urlopen

import bs4
import httpx
import jwt
import pytest
import smtpdfix
from httpx import Headers, HTTPStatusError
from jwt import DecodeError
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.id_generator import IdGenerator
from opentelemetry.trace import Span, Tracer
from opentelemetry.util.types import AttributeValue
from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_OAUTH2_NONCE_COOKIE_NAME,
    PHOENIX_OAUTH2_STATE_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
)
from phoenix.config import (
    get_base_url,
    get_env_database_connection_str,
    get_env_database_schema,
    get_env_grpc_port,
    get_env_host,
    get_env_smtp_mail_from,
)
from phoenix.server.api.auth import IsAdmin
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from psutil import STATUS_ZOMBIE, Popen
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import OperationalError
from strawberry.relay import GlobalID
from typing_extensions import Self, TypeAlias, assert_never

_DB_BACKEND: TypeAlias = Literal["sqlite", "postgresql"]

_ADMIN = UserRoleInput.ADMIN
_MEMBER = UserRoleInput.MEMBER

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


class _String(str, ABC):
    def __new__(cls, obj: Any) -> _String:
        assert obj is not None
        return super().__new__(cls, str(obj))


class _GqlId(_String): ...


_AnyT = TypeVar("_AnyT")


class _CanLogOut(Generic[_AnyT], ABC):
    @abstractmethod
    def log_out(self) -> _AnyT: ...

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args: Any, **kwargs: Any) -> None:
        self.log_out()


@dataclass(frozen=True)
class _User:
    gid: _GqlId
    role: UserRoleInput
    profile: _Profile

    def log_in(self) -> _LoggedInUser:
        tokens = _log_in(self.password, email=self.email)
        return _LoggedInUser(self.gid, self.role, self.profile, tokens)

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
        query: str,
        variables: Optional[Mapping[str, Any]] = None,
    ) -> tuple[dict[str, Any], Headers]:
        return _gql(self, query=query, variables=variables)

    def create_user(
        self,
        role: UserRoleInput = _MEMBER,
        /,
        *,
        profile: _Profile,
    ) -> _User:
        return _create_user(self, role=role, profile=profile)

    def delete_users(self, *users: Union[_GqlId, _User]) -> None:
        return _delete_users(self, users=users)

    def patch_user_gid(
        self,
        gid: _GqlId,
        /,
        *,
        new_username: Optional[_Username] = None,
        new_password: Optional[_Password] = None,
        new_role: Optional[UserRoleInput] = None,
    ) -> None:
        return _patch_user_gid(
            gid,
            self,
            new_username=new_username,
            new_password=new_password,
            new_role=new_role,
        )

    def patch_user(
        self,
        user: _User,
        /,
        *,
        new_username: Optional[_Username] = None,
        new_password: Optional[_Password] = None,
        new_role: Optional[UserRoleInput] = None,
    ) -> _User:
        return _patch_user(
            user,
            self,
            new_username=new_username,
            new_password=new_password,
            new_role=new_role,
        )

    def patch_viewer(
        self,
        /,
        *,
        new_username: Optional[_Username] = None,
        new_password: Optional[_Password] = None,
    ) -> None:
        return _patch_viewer(
            self,
            self.password,
            new_username=new_username,
            new_password=new_password,
        )

    def create_api_key(
        self,
        kind: _ApiKeyKind = "User",
        /,
        *,
        name: Optional[_Name] = None,
        expires_at: Optional[datetime] = None,
    ) -> _ApiKey:
        return _create_api_key(self, kind, name=name, expires_at=expires_at)

    def delete_api_key(self, api_key: _ApiKey, /) -> None:
        return _delete_api_key(api_key, self)

    def export_embeddings(self, filename: str) -> None:
        _export_embeddings(self, filename=filename)

    def initiate_password_reset(
        self,
        smtpd: smtpdfix.AuthController,
        /,
        *,
        should_receive_email: bool = True,
    ) -> Optional[_PasswordResetToken]:
        return _initiate_password_reset(
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
)

_ApiKeyKind = Literal["System", "User"]


class _ApiKey(str):
    def __new__(cls, string: Optional[str], *args: Any, **kwargs: Any) -> _ApiKey:
        return super().__new__(cls, string)

    def __init__(
        self,
        _: Any,
        gid: _GqlId,
        kind: _ApiKeyKind = "User",
    ) -> None:
        self._gid = gid
        self._kind = kind

    @cached_property
    def gid(self) -> _GqlId:
        return self._gid

    @cached_property
    def kind(self) -> _ApiKeyKind:
        return self._kind


class _Token(_String, ABC): ...


class _PasswordResetToken(_Token):
    def reset(self, password: _Password, /) -> None:
        return _reset_password(self, password=password)


class _AccessToken(_Token, _CanLogOut[None]):
    def log_out(self) -> None:
        _log_out(self)


class _RefreshToken(_Token, _CanLogOut[None]):
    def log_out(self) -> None:
        _log_out(self)


@dataclass(frozen=True)
class _LoggedInTokens(_CanLogOut[None]):
    access_token: _AccessToken
    refresh_token: _RefreshToken

    def log_out(self) -> None:
        self.access_token.log_out()

    def refresh(self) -> _LoggedInTokens:
        resp = _httpx_client(self).post("auth/refresh")
        resp.raise_for_status()
        access_token = _AccessToken(resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        refresh_token = _RefreshToken(resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))
        return _LoggedInTokens(access_token, refresh_token)


@dataclass(frozen=True)
class _LoggedInUser(_User, _CanLogOut[_User]):
    tokens: _LoggedInTokens

    def log_out(self) -> _User:
        self.tokens.access_token.log_out()
        return _User(self.gid, self.role, self.profile)

    def refresh(self) -> _LoggedInUser:
        return replace(self, tokens=self.tokens.refresh())


_RoleOrUser = Union[UserRoleInput, _User]
_SecurityArtifact: TypeAlias = Union[
    _AccessToken,
    _RefreshToken,
    _LoggedInTokens,
    _ApiKey,
    _LoggedInUser,
    _User,
]


class _UserGenerator(Protocol):
    def send(self, _: tuple[UserRoleInput, Optional[_Profile]]) -> _User: ...


class _UserFactory(Protocol):
    def __call__(
        self,
        role: UserRoleInput = _MEMBER,
        /,
        *,
        profile: Optional[_Profile] = None,
    ) -> _User: ...


class _GetUser(Protocol):
    def __call__(
        self,
        role_or_user: Union[_User, UserRoleInput] = _MEMBER,
        /,
        *,
        profile: Optional[_Profile] = None,
    ) -> _User: ...


class _SpanExporterFactory(Protocol):
    def __call__(
        self,
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter: ...


class _GetSpan(Protocol):
    def __call__(
        self,
        /,
        project_name: Optional[str] = None,
        span_name: Optional[str] = None,
        attributes: Optional[dict[str, AttributeValue]] = None,
    ) -> ReadableSpan: ...


class _SendSpans(Protocol):
    def __call__(
        self,
        api_key: Optional[_ApiKey] = None,
        /,
        spans: Iterable[ReadableSpan] = (),
        headers: Optional[dict[str, str]] = None,
    ) -> SpanExportResult: ...


def _http_span_exporter(
    *,
    headers: Optional[_Headers] = None,
) -> SpanExporter:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

    endpoint = urljoin(get_base_url(), "v1/traces")
    exporter = OTLPSpanExporter(endpoint=endpoint, headers=headers, timeout=1)
    exporter._MAX_RETRY_TIMEOUT = 2
    return exporter


def _grpc_span_exporter(
    *,
    headers: Optional[_Headers] = None,
) -> SpanExporter:
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

    host = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    endpoint = f"http://{host}:{get_env_grpc_port()}"
    return OTLPSpanExporter(endpoint=endpoint, headers=headers, timeout=1)


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
) -> Span:
    return _get_tracer(
        project_name=project_name or token_hex(16),
        exporter=exporter,
    ).start_span(
        name=span_name or token_hex(16),
        attributes=attributes,
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


class _DefaultAdminTokenSequestration(httpx.BaseTransport):
    """
    This middleware sequesters the default admin's access and refresh tokens when they pass
    through the httpx client. If a sequestered token is used to log out, an exception is
    raised. This is because logging out the default admin during testing would revoke all
    existing access tokens being held by other concurrent tests attached to the same server.
    """

    message = "Default admin must not log out during testing."
    exc_cls = RuntimeError

    def __init__(self, transport: httpx.BaseTransport) -> None:
        self._transport = transport

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        assert (port := request.url.port)
        path, headers = request.url.path, request.headers
        sequester_tokens = False
        if "auth/login" in path:
            sequester_tokens = DEFAULT_ADMIN_EMAIL in request.content.decode()
        elif "auth/refresh" in path:
            sequester_tokens = _DefaultAdminTokens.intersect(port, headers)
        elif "auth/logout" in path and _DefaultAdminTokens.intersect(port, headers):
            raise self.exc_cls(self.message)
        response = self._transport.handle_request(request)
        if sequester_tokens and response.status_code // 100 == 2:
            _DefaultAdminTokens.stash(port, response.headers)
        return response


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
        info.write(f"{'-'*50}\n".encode())
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
        logged_in_user = auth.log_in()
        return _httpx_client(logged_in_user.tokens, headers, cookies, transport)
    elif isinstance(auth, _ApiKey):
        headers = {**(headers or {}), "authorization": f"Bearer {auth}"}
    elif auth is None:
        pass
    else:
        assert_never(auth)
    # Having no timeout is useful when stepping through the debugger on the server side.
    return httpx.Client(
        timeout=None,
        headers=headers,
        cookies=cookies,
        base_url=get_base_url(),
        transport=_LogTransport(
            _DefaultAdminTokenSequestration(
                transport or httpx.HTTPTransport(),
            )
        ),
    )


@contextmanager
def _server() -> Iterator[None]:
    if get_env_database_connection_str().startswith("postgresql"):
        # double-check for safety
        assert get_env_database_schema()
    command = f"{sys.executable} -m phoenix.server.main serve"
    process = Popen(command.split(), stdout=PIPE, stderr=STDOUT, text=True, env=os.environ)
    log: list[str] = []
    lock: Lock = Lock()
    Thread(target=_capture_stdout, args=(process, log, lock), daemon=True).start()
    t = 60
    time_limit = time() + t
    timed_out = False
    url = urljoin(get_base_url(), "healthz")
    while not timed_out and _is_alive(process):
        sleep(0.1)
        try:
            urlopen(url)
            break
        except BaseException:
            timed_out = time() > time_limit
    try:
        if timed_out:
            raise TimeoutError(f"Server did not start within {t} seconds.")
        assert _is_alive(process)
        with lock:
            for line in log:
                print(line, end="")
            log.clear()
        yield
        process.terminate()
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
    schema = f"_{token_hex(15)}"
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
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    query: str,
    variables: Optional[Mapping[str, Any]] = None,
) -> tuple[dict[str, Any], Headers]:
    json_ = dict(query=query, variables=dict(variables or {}))
    resp = _httpx_client(auth).post("graphql", json=json_)
    return _json(resp), resp.headers


def _get_gql_spans(
    auth: Optional[_SecurityArtifact] = None,
    /,
    *fields: str,
) -> dict[_ProjectName, list[dict[str, Any]]]:
    out = "name spans{edges{node{" + " ".join(fields) + "}}}"
    query = "query{projects{edges{node{" + out + "}}}}"
    resp_dict, headers = _gql(auth, query=query)
    assert not resp_dict.get("errors")
    assert not headers.get("set-cookie")
    return {
        project["node"]["name"]: [span["node"] for span in project["node"]["spans"]["edges"]]
        for project in resp_dict["data"]["projects"]["edges"]
    }


def _create_user(
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    role: UserRoleInput,
    profile: _Profile,
) -> _User:
    email = profile.email
    password = profile.password
    username = profile.username
    args = [f'email:"{email}"', f'password:"{password}"', f"role:{role.value}"]
    if username:
        args.append(f'username:"{username}"')
    out = "user{id email role{name}}"
    query = "mutation{createUser(input:{" + ",".join(args) + "}){" + out + "}}"
    resp_dict, headers = _gql(auth, query=query)
    assert (user := resp_dict["data"]["createUser"]["user"])
    assert user["email"] == email
    assert user["role"]["name"] == role.value
    assert not headers.get("set-cookie")
    return _User(_GqlId(user["id"]), role, profile)


def _delete_users(
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    users: Iterable[Union[_GqlId, _User]],
) -> None:
    user_ids = [u.gid if isinstance(u, _User) else u for u in users]
    query = "mutation($userIds:[GlobalID!]!){deleteUsers(input:{userIds:$userIds})}"
    _, headers = _gql(auth, query=query, variables=dict(userIds=user_ids))
    assert not headers.get("set-cookie")


def _patch_user_gid(
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
    resp_dict, headers = _gql(auth, query=query)
    assert (data := resp_dict["data"]["patchUser"])
    assert (result := data["user"])
    assert result["id"] == gid
    if new_username:
        assert result["username"] == new_username
    if new_role:
        assert result["role"]["name"] == new_role.value
    assert not headers.get("set-cookie")


def _patch_user(
    user: _User,
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    new_username: Optional[_Username] = None,
    new_password: Optional[_Password] = None,
    new_role: Optional[UserRoleInput] = None,
) -> _User:
    _patch_user_gid(
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
    resp_dict, headers = _gql(auth, query=query)
    assert (data := resp_dict["data"]["patchViewer"])
    assert (user := data["user"])
    if new_username:
        assert user["username"] == new_username
    if new_password:
        assert headers.get("set-cookie")
    else:
        assert not headers.get("set-cookie")


def _create_api_key(
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
    resp_dict, headers = _gql(auth, query=query)
    assert (data := resp_dict["data"][field])
    assert (key := data["apiKey"])
    assert key["name"] == name
    exp_t = datetime.fromisoformat(key["expiresAt"]) if key["expiresAt"] else None
    assert exp_t == expires_at
    assert not headers.get("set-cookie")
    return _ApiKey(data["jwt"], _GqlId(key["id"]), kind)


def _delete_api_key(
    api_key: _ApiKey,
    auth: Optional[_SecurityArtifact] = None,
    /,
) -> None:
    kind = api_key.kind
    field = f"delete{kind}ApiKey"
    gid = api_key.gid
    args, out = f'id:"{gid}"', "apiKeyId"
    query = "mutation{" + field + "(input:{" + args + "}){" + out + "}}"
    resp_dict, headers = _gql(auth, query=query)
    assert resp_dict["data"][field]["apiKeyId"] == gid
    assert not headers.get("set-cookie")


def _will_be_asked_to_reset_password(
    user: _User,
) -> bool:
    query = "query($gid:GlobalID!){node(id:$gid){... on User{passwordNeedsReset}}}"
    variables = dict(gid=user.gid)
    resp_dict, _ = user.log_in().gql(query, variables)
    return cast(bool, resp_dict["data"]["node"]["passwordNeedsReset"])


def _log_in(
    password: _Password,
    /,
    *,
    email: _Email,
) -> _LoggedInTokens:
    json_ = dict(email=email, password=password)
    resp = _httpx_client().post("auth/login", json=json_)
    resp.raise_for_status()
    assert (access_token := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
    assert (refresh_token := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))
    return _LoggedInTokens(_AccessToken(access_token), _RefreshToken(refresh_token))


def _log_out(
    auth: Optional[_SecurityArtifact] = None,
    /,
) -> None:
    resp = _httpx_client(auth).post("auth/logout")
    resp.raise_for_status()
    tokens = _extract_tokens(resp.headers, "set-cookie")
    for k in _COOKIE_NAMES:
        assert tokens[k] == '""'


def _initiate_password_reset(
    email: _Email,
    smtpd: smtpdfix.AuthController,
    /,
    *,
    should_receive_email: bool = True,
) -> Optional[_PasswordResetToken]:
    old_msg_count = len(smtpd.messages)
    json_ = dict(email=email)
    resp = _httpx_client().post("auth/password-reset-email", json=json_)
    resp.raise_for_status()
    new_msg_count = len(smtpd.messages) - old_msg_count
    assert new_msg_count == int(should_receive_email)
    if not should_receive_email:
        return None
    msg = smtpd.messages[-1]
    assert msg["to"] == email
    assert msg["from"] == get_env_smtp_mail_from()
    return _extract_password_reset_token(msg)


def _reset_password(
    token: _PasswordResetToken,
    /,
    password: _Password,
) -> None:
    json_ = dict(token=token, password=password)
    resp = _httpx_client().post("auth/password-reset", json=json_)
    resp.raise_for_status()


def _export_embeddings(auth: Optional[_SecurityArtifact] = None, /, *, filename: str) -> None:
    resp = _httpx_client(auth).get("/exports", params={"filename": filename})
    resp.raise_for_status()


def _json(
    resp: httpx.Response,
) -> dict[str, Any]:
    resp.raise_for_status()
    assert (resp_dict := cast(dict[str, Any], resp.json()))
    if errers := resp_dict.get("errors"):
        msg = errers[0]["message"]
        if "not auth" in msg or IsAdmin.message in msg:
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
        except DecodeError:
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


async def _run(obj: Union[_AnyT, Awaitable[_AnyT]]) -> _AnyT:
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
        result = await _run(some_operation())
    """
    if isinstance(obj, Awaitable):
        return cast(_AnyT, await obj)
    return obj
