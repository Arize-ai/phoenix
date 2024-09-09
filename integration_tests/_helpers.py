from __future__ import annotations

import os
import secrets
import sys
from abc import ABC, abstractmethod
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from functools import cached_property
from io import BytesIO
from subprocess import PIPE, STDOUT
from threading import Lock, Thread
from time import sleep, time
from typing import (
    Any,
    ContextManager,
    Dict,
    Generic,
    Iterable,
    Iterator,
    List,
    Literal,
    Mapping,
    Optional,
    Protocol,
    Tuple,
    TypeVar,
    Union,
    cast,
)
from urllib.parse import urljoin
from urllib.request import urlopen

import httpx
import pytest
from httpx import HTTPStatusError
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.trace import Span, Tracer
from opentelemetry.util.types import AttributeValue
from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
)
from phoenix.config import (
    get_base_url,
    get_env_database_connection_str,
    get_env_database_schema,
    get_env_grpc_port,
    get_env_host,
)
from phoenix.server.api.auth import IsAdmin
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from psutil import STATUS_ZOMBIE, Popen
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import OperationalError
from strawberry.relay import GlobalID
from typing_extensions import Self, TypeAlias, assert_never

_ADMIN = UserRoleInput.ADMIN
_MEMBER = UserRoleInput.MEMBER

_ProjectName: TypeAlias = str
_SpanName: TypeAlias = str
_Headers: TypeAlias = Dict[str, Any]
_Name: TypeAlias = str

_Secret: TypeAlias = str
_Email: TypeAlias = str
_Password: TypeAlias = str
_Username: TypeAlias = str


@dataclass(frozen=True)
class _Profile:
    email: _Email
    password: _Password
    username: Optional[_Username] = None


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
    ) -> Dict[str, Any]:
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


class _AccessToken(_Token, _CanLogOut[None]):
    def log_out(self) -> None:
        _log_out(self)


class _RefreshToken(_Token): ...


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
    def send(self, _: Tuple[UserRoleInput, Optional[_Profile]]) -> _User: ...


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
        attributes: Optional[Dict[str, AttributeValue]] = None,
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


def _get_tracer(
    *,
    project_name: _ProjectName,
    exporter: SpanExporter,
) -> Tracer:
    resource = Resource({ResourceAttributes.PROJECT_NAME: project_name})
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    return tracer_provider.get_tracer(__name__)


def _start_span(
    *,
    project_name: str,
    span_name: str,
    exporter: SpanExporter,
) -> Span:
    return _get_tracer(
        project_name=project_name,
        exporter=exporter,
    ).start_span(span_name)


class _LogResponse(httpx.Response):
    def __init__(self, info: BytesIO, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._info = info

    def iter_bytes(self, *args: Any, **kwargs: Any) -> Iterator[bytes]:
        for chunk in super().iter_bytes(*args, **kwargs):
            self._info.write(chunk)
            yield chunk
        print(self._info.getvalue().decode())


class _LogTransport(httpx.BaseTransport):
    def __init__(self, transport: httpx.BaseTransport) -> None:
        self._transport = transport

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        info = BytesIO()
        info.write(f"{'-'*50}\n".encode())
        info.write(f"{datetime.now(timezone.utc).isoformat()}\n".encode())
        response = self._transport.handle_request(request)
        info.write(f"{response.status_code} {request.method} {request.url}\n".encode())
        info.write(f"{request.headers}\n".encode())
        info.write(f"{response.headers}\n".encode())
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
    cookies: Optional[Dict[str, Any]] = None,
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
        transport=transport or _LogTransport(httpx.HTTPTransport()),
    )


@contextmanager
def _server() -> Iterator[None]:
    if get_env_database_connection_str().startswith("postgresql"):
        # double-check for safety
        assert get_env_database_schema()
    command = f"{sys.executable} -m phoenix.server.main serve"
    process = Popen(command.split(), stdout=PIPE, stderr=STDOUT, text=True, env=os.environ)
    log: List[str] = []
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
    log: List[str],
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
    try:
        engine.connect()
    except OperationalError as exc:
        pytest.skip(f"PostgreSQL unavailable: {exc}")
    schema = f"_{secrets.token_hex(15)}"
    yield schema
    with engine.connect() as conn:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE;"))
        conn.commit()
    engine.dispose()


def _gql(
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    query: str,
    variables: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    json_ = dict(query=query, variables=dict(variables or {}))
    resp = _httpx_client(auth).post("graphql", json=json_)
    return _json(resp)


def _get_gql_spans(
    auth: Optional[_SecurityArtifact] = None,
    /,
    *fields: str,
) -> Dict[_ProjectName, List[Dict[str, Any]]]:
    out = "name spans{edges{node{" + " ".join(fields) + "}}}"
    query = "query{projects{edges{node{" + out + "}}}}"
    resp_dict = _gql(auth, query=query)
    assert not resp_dict.get("errors")
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
    resp_dict = _gql(auth, query=query)
    assert (user := resp_dict["data"]["createUser"]["user"])
    assert user["email"] == email
    assert user["role"]["name"] == role.value
    return _User(_GqlId(user["id"]), role, profile)


def _delete_users(
    auth: Optional[_SecurityArtifact] = None,
    /,
    *,
    users: Iterable[Union[_GqlId, _User]],
) -> None:
    user_ids = [u.gid if isinstance(u, _User) else u for u in users]
    query = "mutation($userIds:[GlobalID!]!){deleteUsers(input:{userIds:$userIds})}"
    _gql(auth, query=query, variables=dict(userIds=user_ids))


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
    resp_dict = _gql(auth, query=query)
    assert (data := resp_dict["data"]["patchUser"])
    assert (result := data["user"])
    assert result["id"] == gid
    if new_username:
        assert result["username"] == new_username
    if new_role:
        assert result["role"]["name"] == new_role.value


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
    resp_dict = _gql(auth, query=query)
    assert (data := resp_dict["data"]["patchViewer"])
    assert (user := data["user"])
    if new_username:
        assert user["username"] == new_username


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
    resp_dict = _gql(auth, query=query)
    assert (data := resp_dict["data"][field])
    assert (key := data["apiKey"])
    assert key["name"] == name
    exp_t = datetime.fromisoformat(key["expiresAt"]) if key["expiresAt"] else None
    assert exp_t == expires_at
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
    resp_dict = _gql(auth, query=query)
    assert resp_dict["data"][field]["apiKeyId"] == gid


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


def _json(
    resp: httpx.Response,
) -> Dict[str, Any]:
    resp.raise_for_status()
    assert (resp_dict := cast(Dict[str, Any], resp.json()))
    if errers := resp_dict.get("errors"):
        msg = errers[0]["message"]
        if "not auth" in msg or IsAdmin.message in msg:
            raise Unauthorized(msg)
        raise RuntimeError(msg)
    return resp_dict


class _Expectation(Protocol):
    def __enter__(self) -> Optional[BaseException]: ...
    def __exit__(self, *args: Any, **kwargs: Any) -> None: ...


_OK_OR_DENIED: TypeAlias = ContextManager[Optional[Unauthorized]]

_OK = nullcontext()
_DENIED = pytest.raises(Unauthorized)

_EXPECTATION_401 = pytest.raises(HTTPStatusError, match="401 Unauthorized")
_EXPECTATION_403 = pytest.raises(HTTPStatusError, match="403 Forbidden")
