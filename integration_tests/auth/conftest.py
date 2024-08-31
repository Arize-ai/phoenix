import os
import secrets
from contextlib import ExitStack, contextmanager
from datetime import datetime
from typing import (
    Any,
    Callable,
    ContextManager,
    Dict,
    Iterator,
    List,
    Optional,
    Protocol,
    Tuple,
    cast,
)
from unittest import mock
from urllib.parse import urljoin

import httpx
import pytest
from faker import Faker
from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
)
from phoenix.config import (
    ENV_PHOENIX_ENABLE_AUTH,
    ENV_PHOENIX_SECRET,
    get_base_url,
)
from phoenix.server.api.auth import IsAdmin, IsAuthenticated
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from phoenix.server.api.mutations.auth_mutations import FAILED_LOGIN_MESSAGE
from typing_extensions import TypeAlias

_ProjectName: TypeAlias = str
_Name: TypeAlias = str
_ApiKey: TypeAlias = str
_GqlId: TypeAlias = str

_UserName: TypeAlias = str
_Email: TypeAlias = str
_Password: TypeAlias = str
_Token: TypeAlias = str
_AccessToken: TypeAlias = str
_RefreshToken: TypeAlias = str


class _LogIn(Protocol):
    def __call__(
        self,
        *,
        email: _Email,
        password: _Password,
    ) -> ContextManager[Tuple[_AccessToken, _RefreshToken]]: ...


class _LogOut(Protocol):
    def __call__(self, token: _Token) -> None: ...


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


class _GetGqlSpans(Protocol):
    def __call__(self, *keys: str) -> Dict[_ProjectName, List[Dict[str, Any]]]: ...


@pytest.fixture(scope="class")
def secret(fake: Faker) -> str:
    return secrets.token_hex(32)


@pytest.fixture(autouse=True, scope="class")
def app(
    secret: str,
    env_phoenix_sql_database_url: Any,
    server: Callable[[], ContextManager[None]],
) -> Iterator[None]:
    values = (
        (ENV_PHOENIX_ENABLE_AUTH, "true"),
        (ENV_PHOENIX_SECRET, secret),
    )
    with ExitStack() as stack:
        stack.enter_context(mock.patch.dict(os.environ, values))
        stack.enter_context(server())
        yield


@pytest.fixture
def admin_token(
    admin_email: str,
    secret: str,
    log_in: _LogIn,
) -> Iterator[_Token]:
    with log_in(email=admin_email, password=secret) as (token, _):
        yield token


@pytest.fixture(scope="module")
def admin_email() -> _Email:
    return "admin@localhost"


@pytest.fixture(scope="module")
def create_user(
    httpx_client: httpx.Client,
) -> _CreateUser:
    def _(
        *,
        email: _Email,
        password: _Password,
        role: UserRoleInput,
        username: Optional[_UserName] = None,
        token: Optional[_Token] = None,
    ) -> _GqlId:
        args = [f'email:"{email}"', f'password:"{password}"', f"role:{role.value}"]
        if username:
            args.append(f'username:"{username}"')
        out = "user{id email role{name}}"
        query = "mutation{createUser(input:{" + ",".join(args) + "}){" + out + "}}"
        resp = httpx_client.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=query),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
        )
        resp_dict = _json(resp)
        assert (user := resp_dict["data"]["createUser"]["user"])
        assert user["email"] == email
        assert user["role"]["name"] == role.value
        return cast(_GqlId, user["id"])

    return _


@pytest.fixture(scope="module")
def create_system_api_key(
    httpx_client: httpx.Client,
) -> _CreateSystemApiKey:
    def _(
        *,
        name: _Name,
        expires_at: Optional[datetime] = None,
        token: Optional[_Token] = None,
    ) -> Tuple[_ApiKey, _GqlId]:
        exp = f' expiresAt:"{expires_at.isoformat()}"' if expires_at else ""
        args, out = (f'name:"{name}"' + exp), "jwt apiKey{id name expiresAt}"
        query = "mutation{createSystemApiKey(input:{" + args + "}){" + out + "}}"
        resp = httpx_client.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=query),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
        )
        resp_dict = _json(resp)
        assert (result := resp_dict["data"]["createSystemApiKey"])
        assert (api_key := result["apiKey"])
        assert api_key["name"] == name
        exp_t = datetime.fromisoformat(api_key["expiresAt"]) if api_key["expiresAt"] else None
        assert exp_t == expires_at
        return cast(_ApiKey, result["jwt"]), cast(_GqlId, api_key["id"])

    return _


@pytest.fixture(scope="module")
def delete_system_api_key(
    httpx_client: httpx.Client,
) -> _DeleteSystemApiKey:
    def _(gid: _GqlId, /, *, token: Optional[_Token] = None) -> None:
        args, out = f'id:"{gid}"', "id"
        query = "mutation{deleteSystemApiKey(input:{" + args + "}){" + out + "}}"
        resp = httpx_client.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=query),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
        )
        resp_dict = _json(resp)
        assert resp_dict["data"]["deleteSystemApiKey"]["id"] == gid

    return _


@pytest.fixture(scope="module")
def log_in(
    httpx_client: httpx.Client,
    log_out: _LogOut,
) -> _LogIn:
    @contextmanager
    def _(*, email: _Email, password: _Password) -> Iterator[Tuple[_AccessToken, _RefreshToken]]:
        resp = httpx_client.post(
            urljoin(get_base_url(), "/auth/login"),
            json={"email": email, "password": password},
        )
        resp.raise_for_status()
        assert (access_token := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        assert (refresh_token := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))
        yield access_token, refresh_token
        log_out(access_token)

    return _


@pytest.fixture(scope="module")
def log_out(
    httpx_client: httpx.Client,
) -> _LogOut:
    def _(token: _Token) -> None:
        query = "mutation{logout}"
        resp = httpx_client.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=query),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token},
        )
        _json(resp)

    return _


def _json(resp: httpx.Response) -> Dict[str, Any]:
    resp.raise_for_status()
    assert (resp_dict := cast(Dict[str, Any], resp.json()))
    if errers := resp_dict.get("errors"):
        msg = errers[0]["message"]
        if (
            "not auth" in msg
            or FAILED_LOGIN_MESSAGE in msg
            or IsAuthenticated.message in msg
            or IsAdmin.message in msg
        ):
            raise Unauthorized(msg)
        raise RuntimeError(msg)
    return resp_dict
