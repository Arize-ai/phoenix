import os
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime
from typing import (
    Any,
    Callable,
    ContextManager,
    Dict,
    Iterator,
    List,
    Literal,
    Optional,
    Protocol,
    cast,
)
from unittest import mock
from urllib.parse import urljoin

import httpx
import pytest
from _pytest.fixtures import SubRequest
from faker import Faker
from phoenix.auth import PHOENIX_ACCESS_TOKEN_COOKIE_NAME, REQUIREMENTS_FOR_PHOENIX_SECRET
from phoenix.config import (
    ENV_PHOENIX_ENABLE_AUTH,
    ENV_PHOENIX_SECRET,
    ENV_PHOENIX_SQL_DATABASE_URL,
    get_base_url,
)
from sqlalchemy import URL, make_url
from typing_extensions import TypeAlias

ProjectName: TypeAlias = str
Name: TypeAlias = str
ApiKey: TypeAlias = str


class GetGqlSpans(Protocol):
    def __call__(self, *keys: str) -> Dict[ProjectName, List[Dict[str, Any]]]: ...


@pytest.fixture(scope="class")
def secret(fake: Faker) -> str:
    return cast(str, fake.unique.password(**asdict(REQUIREMENTS_FOR_PHOENIX_SECRET)))


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


Role: TypeAlias = Literal["MEMBER", "ADMIN"]
UserName: TypeAlias = str
Email: TypeAlias = str
Password: TypeAlias = str
Token: TypeAlias = str


@pytest.fixture(scope="module")
def admin_email() -> Email:
    return "admin@localhost"


@pytest.fixture(scope="module")
def create_user() -> Callable[[Email, UserName, Password, Role, Token], None]:
    def _(email: Email, username: UserName, password: Password, role: Role, token: Token) -> None:
        mutation = (
            "mutation{createUser(input:{"
            + f'email:"{email}",username:"{username}",password:"{password}",role:{role.upper()}'
            + "}){user{email role{name}}}}"
        )
        resp = httpx.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=mutation),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
        )
        resp.raise_for_status()
        resp_dict = resp.json()
        assert not resp_dict.get("errors")
        assert resp_dict["data"]["createUser"]["user"]["email"] == email
        assert resp_dict["data"]["createUser"]["user"]["role"]["name"].upper() == role.upper()

    return _


@pytest.fixture(scope="module")
def create_system_api_key() -> Callable[[Name, Optional[datetime]], ApiKey]:
    def _(
        name: Name,
        expires_at: Optional[datetime] = None,
        token: Optional[Token] = None,
    ) -> str:
        mutation = (
            "mutation{createSystemApiKey(input:{"
            + f'name:"{name}"'
            + (f' expiresAt:"{expires_at.isoformat()}"' if expires_at else "")
            + "}){jwt apiKey{name expiresAt}}}"
        )
        resp = httpx.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=mutation),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
        )
        resp.raise_for_status()
        resp_dict = resp.json()
        assert not resp_dict.get("errors")
        result = resp_dict["data"]["createSystemApiKey"]
        api_key = result["apiKey"]
        assert api_key["name"] == name
        assert (
            datetime.fromisoformat(api_key["expiresAt"]) if api_key["expiresAt"] else None
        ) == expires_at
        return cast(ApiKey, result["jwt"])

    return _


@pytest.fixture(scope="module")
def login(
    logout: Callable[[Token], None],
) -> Callable[[Email, Password], ContextManager[Token]]:
    @contextmanager
    def _(email: Email, password: Password) -> Iterator[Token]:
        mutation = "mutation{login(input:{" + f'email:"{email}", password:"{password}"' + "})}"
        resp = httpx.post(urljoin(get_base_url(), "graphql"), json=dict(query=mutation))
        resp.raise_for_status()
        resp_dict = resp.json()
        assert not resp_dict.get("errors")
        token = resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME)
        assert token
        yield token
        logout(token)

    return _


@pytest.fixture(scope="module")
def logout() -> Callable[[Token], None]:
    def _(token: str) -> None:
        mutation = "mutation{logout}"
        resp = httpx.post(
            urljoin(get_base_url(), "graphql"),
            json=dict(query=mutation),
            cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token},
        )
        resp.raise_for_status()
        resp_dict = resp.json()
        assert not resp_dict.get("errors")

    return _
