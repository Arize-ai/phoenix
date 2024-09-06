from __future__ import annotations

import os
import sys
from abc import ABC
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from subprocess import PIPE, STDOUT
from threading import Lock, Thread
from time import sleep, time
from typing import (
    Any,
    Dict,
    Iterator,
    List,
    Mapping,
    NamedTuple,
    Optional,
    Protocol,
    Tuple,
    cast,
)
from urllib.parse import urljoin
from urllib.request import urlopen

import httpx
import pytest
from faker import Faker
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExporter
from opentelemetry.trace import Span, Tracer
from phoenix.auth import PHOENIX_ACCESS_TOKEN_COOKIE_NAME, PHOENIX_REFRESH_TOKEN_COOKIE_NAME
from phoenix.config import (
    get_base_url,
    get_env_database_connection_str,
    get_env_database_schema,
    get_env_grpc_port,
    get_env_host,
)
from phoenix.server.api.auth import IsAdmin, IsAuthenticated
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from psutil import STATUS_ZOMBIE, Popen
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import OperationalError
from typing_extensions import TypeAlias

_ProjectName: TypeAlias = str
_SpanName: TypeAlias = str
_Headers: TypeAlias = Dict[str, Any]
_Name: TypeAlias = str


class _String(str, ABC):
    def __new__(cls, string: Optional[str] = None) -> _String:
        assert string
        return super().__new__(cls, string)


_Secret: TypeAlias = str
_Email: TypeAlias = str
_Password: TypeAlias = str
_Username: TypeAlias = str


@dataclass(frozen=True)
class _Profile:
    email: _Email
    password: _Password
    username: Optional[_Username] = None


class _GqlId(_String): ...


@dataclass(frozen=True)
class _User:
    gid: _GqlId
    role: UserRoleInput
    profile: _Profile


class _Token(_String, ABC): ...


class _AccessToken(_Token): ...


class _ApiKey(_Token): ...


class _RefreshToken(_Token): ...


class _LoggedInTokens(NamedTuple):
    access: _AccessToken
    refresh: _RefreshToken

    def log_out(self) -> None:
        _log_out(self.access)

    def __enter__(self) -> _LoggedInTokens:
        return self

    def __exit__(self, *args: Any, **kwargs: Any) -> None:
        self.log_out()


@dataclass(frozen=True)
class _LoggedInUser(_User):
    tokens: _LoggedInTokens


class _UserGenerator(Protocol):
    def send(self, role: UserRoleInput) -> _LoggedInUser: ...


class _GetNewUser(Protocol):
    def __call__(self, role: UserRoleInput) -> _LoggedInUser: ...


class _SpanExporterConstructor(Protocol):
    def __call__(
        self,
        *,
        headers: Optional[_Headers] = None,
    ) -> SpanExporter: ...


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
    project_name: str,
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
    return _get_tracer(project_name=project_name, exporter=exporter).start_span(span_name)


def _httpx_client(
    access_token: Optional[_AccessToken] = None,
    refresh_token: Optional[_RefreshToken] = None,
    cookies: Optional[Dict[str, Any]] = None,
) -> httpx.Client:
    if access_token:
        cookies = {**(cookies or {}), PHOENIX_ACCESS_TOKEN_COOKIE_NAME: access_token}
    if refresh_token:
        cookies = {**(cookies or {}), PHOENIX_REFRESH_TOKEN_COOKIE_NAME: refresh_token}
    # Having no timeout is useful when stepping through the debugger on the server side.
    return httpx.Client(timeout=None, cookies=cookies)


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


def _is_alive(process: Popen) -> bool:
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
def _random_schema(url: URL, _fake: Faker) -> Iterator[str]:
    engine = create_engine(url.set(drivername="postgresql+psycopg"))
    try:
        engine.connect()
    except OperationalError as ex:
        pytest.skip(f"PostgreSQL unavailable: {ex}")
    schema = _fake.unique.pystr().lower()
    yield schema
    with engine.connect() as conn:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE;"))
        conn.commit()
    engine.dispose()


def _gql(
    access_token: Optional[_AccessToken] = None,
    /,
    *,
    query: str,
    variables: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    resp = _httpx_client(access_token).post(
        urljoin(get_base_url(), "graphql"),
        json=dict(query=query, variables=dict(variables or {})),
    )
    return _json(resp)


def _get_gql_spans(*keys: str) -> Dict[_ProjectName, List[Dict[str, Any]]]:
    out = "name spans{edges{node{" + " ".join(keys) + "}}}"
    query = "query{projects{edges{node{" + out + "}}}}"
    resp_dict = _gql(query=query)
    assert not resp_dict.get("errors")
    return {
        project["node"]["name"]: [span["node"] for span in project["node"]["spans"]["edges"]]
        for project in resp_dict["data"]["projects"]["edges"]
    }


def _create_user(
    access_token: Optional[_AccessToken] = None,
    /,
    *,
    email: _Email,
    password: _Password,
    role: UserRoleInput,
    username: Optional[_Username] = None,
) -> _GqlId:
    args = [f'email:"{email}"', f'password:"{password}"', f"role:{role.value}"]
    if username:
        args.append(f'username:"{username}"')
    out = "user{id email role{name}}"
    query = "mutation{createUser(input:{" + ",".join(args) + "}){" + out + "}}"
    resp_dict = _gql(access_token, query=query)
    assert (user := resp_dict["data"]["createUser"]["user"])
    assert user["email"] == email
    assert user["role"]["name"] == role.value
    return _GqlId(user["id"])


def _patch_user(
    gid: _GqlId,
    access_token: Optional[_AccessToken] = None,
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
    resp_dict = _gql(access_token, query=query)
    assert (user := resp_dict["data"]["patchUser"]["user"])
    assert user["id"] == gid
    if new_username:
        assert user["username"] == new_username
    if new_role:
        assert user["role"]["name"] == new_role.value


def _patch_viewer(
    access_token: Optional[_AccessToken] = None,
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
    resp_dict = _gql(access_token, query=query)
    assert (user := resp_dict["data"]["patchViewer"]["user"])
    if new_username:
        assert user["username"] == new_username


def _create_system_api_key(
    access_token: Optional[_AccessToken] = None,
    /,
    *,
    name: _Name,
    expires_at: Optional[datetime] = None,
) -> Tuple[_ApiKey, _GqlId]:
    exp = f' expiresAt:"{expires_at.isoformat()}"' if expires_at else ""
    args, out = (f'name:"{name}"' + exp), "jwt apiKey{id name expiresAt}"
    query = "mutation{createSystemApiKey(input:{" + args + "}){" + out + "}}"
    resp_dict = _gql(access_token, query=query)
    assert (result := resp_dict["data"]["createSystemApiKey"])
    assert (api_key := result["apiKey"])
    assert api_key["name"] == name
    exp_t = datetime.fromisoformat(api_key["expiresAt"]) if api_key["expiresAt"] else None
    assert exp_t == expires_at
    assert (jwt := result["jwt"])
    assert (id_ := api_key["id"])
    return _ApiKey(jwt), _GqlId(id_)


def _delete_system_api_key(
    gid: _GqlId,
    access_token: Optional[_AccessToken] = None,
    /,
) -> None:
    args, out = f'id:"{gid}"', "apiKeyId"
    query = "mutation{deleteSystemApiKey(input:{" + args + "}){" + out + "}}"
    resp_dict = _gql(access_token, query=query)
    assert resp_dict["data"]["deleteSystemApiKey"]["apiKeyId"] == gid


def _log_in(
    password: _Password,
    /,
    *,
    email: _Email,
) -> _LoggedInTokens:
    resp = _httpx_client().post(
        urljoin(get_base_url(), "auth/login"),
        json={"email": email, "password": password},
    )
    resp.raise_for_status()
    assert (access_token := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
    assert (refresh_token := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))
    return _LoggedInTokens(_AccessToken(access_token), _RefreshToken(refresh_token))


def _log_out(
    access_token: Optional[_AccessToken] = None,
    refresh_token: Optional[_RefreshToken] = None,
    /,
) -> None:
    resp = _httpx_client(
        access_token,
        refresh_token,
    ).post(urljoin(get_base_url(), "auth/logout"))
    resp.raise_for_status()


def _json(
    resp: httpx.Response,
) -> Dict[str, Any]:
    resp.raise_for_status()
    assert (resp_dict := cast(Dict[str, Any], resp.json()))
    if errers := resp_dict.get("errors"):
        msg = errers[0]["message"]
        if "not auth" in msg or IsAuthenticated.message in msg or IsAdmin.message in msg:
            raise Unauthorized(msg)
        raise RuntimeError(msg)
    return resp_dict
