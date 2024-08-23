import os
from dataclasses import asdict
from datetime import datetime
from typing import Any, Callable, ContextManager, Dict, Iterator, List, Optional, Protocol, cast
from unittest import mock
from urllib.parse import urljoin

import httpx
import pytest
from _pytest.fixtures import SubRequest
from faker import Faker
from phoenix.auth import REQUIREMENTS_FOR_PHOENIX_SECRET
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


@pytest.fixture(autouse=True, scope="module")
def env_phoenix_enable_auth(fake: Faker) -> Iterator[None]:
    secret = fake.unique.password(**asdict(REQUIREMENTS_FOR_PHOENIX_SECRET))
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


@pytest.fixture(scope="module")
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


@pytest.fixture(autouse=True, scope="module")
def create_system_api_key() -> Callable[[Name, Optional[datetime]], ApiKey]:
    def _(name: Name, expires_at: Optional[datetime]) -> str:
        mutation = (
            "mutation{createSystemApiKey(input: {name: "
            + f'"{name}"'
            + (f' expiresAt: "{expires_at.isoformat()}"' if expires_at else "")
            + "}){jwt apiKey{name expiresAt}}}"
        )
        resp = httpx.post(urljoin(get_base_url(), "graphql"), json=dict(query=mutation))
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
