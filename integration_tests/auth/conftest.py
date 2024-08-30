import os
import secrets
from contextlib import contextmanager
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
from _pytest.fixtures import SubRequest
from faker import Faker
from phoenix.auth import PHOENIX_ACCESS_TOKEN_COOKIE_NAME
from phoenix.config import (
    ENV_PHOENIX_ENABLE_AUTH,
    ENV_PHOENIX_SECRET,
    ENV_PHOENIX_SQL_DATABASE_URL,
    get_base_url,
)
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from sqlalchemy import URL, make_url
from typing_extensions import TypeAlias

ProjectName: TypeAlias = str
Name: TypeAlias = str
ApiKey: TypeAlias = str
GqlId: TypeAlias = str


class GetGqlSpans(Protocol):
    def __call__(self, *keys: str) -> Dict[ProjectName, List[Dict[str, Any]]]: ...


@pytest.fixture(scope="class")
def secret(fake: Faker) -> str:
    return secrets.token_hex(32)


@pytest.fixture(autouse=True, scope="class")
def env_phoenix_enable_auth(
    secret: str,
    fake: Faker,
) -> Iterator[None]:
    values = (
        (ENV_PHOENIX_ENABLE_AUTH, "true"),
        (ENV_PHOENIX_SECRET, secret),
    )
    with mock.patch.dict(os.environ, values):
        yield


@pytest.fixture(
    scope="module",
    params=["sqlite:///:memory:"],
)
def phoenix_sql_database_url(request: SubRequest) -> URL:
    return make_url(request.param)


@pytest.fixture(scope="class")
def env_phoenix_sql_database_url(
    phoenix_sql_database_url: URL,
) -> Iterator[None]:
    url = phoenix_sql_database_url.render_as_string()
    values = ((ENV_PHOENIX_SQL_DATABASE_URL, url),)
    with mock.patch.dict(os.environ, values):
        yield


@pytest.fixture(autouse=True, scope="class")
def app(
    env_phoenix_enable_auth: Any,
    env_phoenix_sql_database_url: Any,
    server: Callable[[], ContextManager[None]],
) -> Iterator[None]:
    with server():
        yield


UserName: TypeAlias = str
Email: TypeAlias = str
Password: TypeAlias = str
Token: TypeAlias = str


@pytest.fixture(scope="module")
def admin_email() -> Email:
    return "admin@localhost"


@pytest.fixture(scope="module")
def create_user(
    httpx_client: httpx.Client,
) -> Callable[[Email, UserName, Password, UserRoleInput, Token], None]:
    def _(
        email: Email,
        username: UserName,
        password: Password,
        role: UserRoleInput,
        token: Token,
    ) -> None:
        args = f'email:"{email}",username:"{username}",password:"{password}",role:{role.value}'
        out = "user{email role{name}}"
        query = "mutation{createUser(input:{" + args + "}){" + out + "}}"
        resp = httpx_client.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=query),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
        )
        resp.raise_for_status()
        assert (resp_dict := resp.json())
        assert not resp_dict.get("errors")
        assert (user := resp_dict["data"]["createUser"]["user"])
        assert user["email"] == email
        assert user["role"]["name"] == role.value

    return _


@pytest.fixture(scope="module")
def create_system_api_key(
    httpx_client: httpx.Client,
) -> Callable[[Name, Optional[datetime], Optional[Token]], Tuple[ApiKey, GqlId]]:
    def _(
        name: Name,
        expires_at: Optional[datetime] = None,
        token: Optional[Token] = None,
    ) -> Tuple[ApiKey, GqlId]:
        exp = f' expiresAt:"{expires_at.isoformat()}"' if expires_at else ""
        args, out = (f'name:"{name}"' + exp), "jwt apiKey{id name expiresAt}"
        query = "mutation{createSystemApiKey(input:{" + args + "}){" + out + "}}"
        resp = httpx_client.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=query),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
        )
        resp.raise_for_status()
        assert (resp_dict := resp.json())
        assert not resp_dict.get("errors")
        assert (result := resp_dict["data"]["createSystemApiKey"])
        assert (api_key := result["apiKey"])
        assert api_key["name"] == name
        exp_t = datetime.fromisoformat(api_key["expiresAt"]) if api_key["expiresAt"] else None
        assert exp_t == expires_at
        return cast(ApiKey, result["jwt"]), cast(GqlId, api_key["id"])

    return _


@pytest.fixture(scope="module")
def delete_system_api_key(
    httpx_client: httpx.Client,
) -> Callable[[GqlId, Optional[Token]], None]:
    def _(gid: GqlId, token: Optional[Token] = None) -> None:
        args, out = f'id:"{gid}"', "id"
        query = "mutation{deleteSystemApiKey(input:{" + args + "}){" + out + "}}"
        resp = httpx_client.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=query),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
        )
        resp.raise_for_status()
        assert (resp_dict := resp.json())
        assert not resp_dict.get("errors")
        assert resp_dict["data"]["deleteSystemApiKey"]["id"] == gid

    return _


@pytest.fixture(scope="module")
def login(
    httpx_client: httpx.Client,
    logout: Callable[[Token], None],
) -> Callable[[Email, Password], ContextManager[Token]]:
    @contextmanager
    def _(email: Email, password: Password) -> Iterator[Token]:
        args = f'email:"{email}", password:"{password}"'
        query = "mutation{login(input:{" + args + "})}"
        resp = httpx_client.post(urljoin(get_base_url(), "graphql"), json=dict(query=query))
        resp.raise_for_status()
        assert (resp_dict := resp.json())
        assert not resp_dict.get("errors")
        assert (token := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
        yield token
        logout(token)

    return _


@pytest.fixture(scope="module")
def logout(
    httpx_client: httpx.Client,
) -> Callable[[Token], None]:
    def _(token: Token) -> None:
        query = "mutation{logout}"
        resp = httpx_client.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=query),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token},
        )
        resp.raise_for_status()
        assert (resp_dict := resp.json())
        assert not resp_dict.get("errors")

    return _
