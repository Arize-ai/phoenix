from __future__ import annotations

import base64
import hashlib
from dataclasses import dataclass
from secrets import token_hex
from typing import Any, Iterator, Mapping
from urllib.parse import parse_qs, urlparse

import pytest

from tests.integration._helpers import (
    _AppInfo,
    _httpx_client,
    _server,
)


@pytest.fixture(scope="package")
def _env_auth(_env_ports: Mapping[str, str]) -> dict[str, str]:
    port = _env_ports["PHOENIX_PORT"]
    return {
        "PHOENIX_ENABLE_AUTH": "true",
        "PHOENIX_SECRET": token_hex(16),
        "PHOENIX_ADMIN_SECRET": token_hex(16),
        "PHOENIX_DISABLE_RATE_LIMIT": "true",
        "PHOENIX_CSRF_TRUSTED_ORIGINS": f",http://localhost,https://127.0.0.1:{port},",
    }


@pytest.fixture
def _app_dcr_rate_limited(
    _ports: Iterator[int],
    tmp_path_factory: pytest.TempPathFactory,
) -> Iterator[_AppInfo]:
    port = next(_ports)
    env = _oauth2_app_env(
        port=port,
        grpc_port=next(_ports),
        database=str(tmp_path_factory.mktemp("oauth2_dcr_rate_limited") / "phoenix.db"),
        extra={
            "PHOENIX_OAUTH2_DCR_RATE_LIMIT_PER_HOUR": "1",
            "PHOENIX_OAUTH2_DCR_MAX_UNCONSUMED_PER_IP_PER_DAY": "10",
        },
    )
    with _server(_AppInfo(env)) as app:
        yield app


@pytest.fixture
def _app_dcr_enabled(
    _ports: Iterator[int],
    tmp_path_factory: pytest.TempPathFactory,
) -> Iterator[_AppInfo]:
    port = next(_ports)
    env = _oauth2_app_env(
        port=port,
        grpc_port=next(_ports),
        database=str(tmp_path_factory.mktemp("oauth2_dcr_enabled") / "phoenix.db"),
        extra={
            "PHOENIX_DISABLE_RATE_LIMIT": "true",
            "PHOENIX_OAUTH2_DYNAMIC_CLIENT_REGISTRATION": "enabled",
            "PHOENIX_OAUTH2_ALLOWED_REDIRECT_HOSTS": "vscode.dev,insiders.vscode.dev",
        },
    )
    with _server(_AppInfo(env)) as app:
        yield app


@pytest.fixture
def _app_dcr_disabled(
    _ports: Iterator[int],
    tmp_path_factory: pytest.TempPathFactory,
) -> Iterator[_AppInfo]:
    port = next(_ports)
    env = _oauth2_app_env(
        port=port,
        grpc_port=next(_ports),
        database=str(tmp_path_factory.mktemp("oauth2_dcr_disabled") / "phoenix.db"),
        extra={
            "PHOENIX_DISABLE_RATE_LIMIT": "true",
            "PHOENIX_OAUTH2_DYNAMIC_CLIENT_REGISTRATION": "disabled",
        },
    )
    with _server(_AppInfo(env)) as app:
        yield app


@pytest.fixture(scope="package")
def _oauth_public_client(_app: _AppInfo) -> Iterator[_OAuthPublicClient]:
    """Register a public client through dynamic client registration.

    Registration goes through the real /oauth2/register endpoint so these
    tests exercise the app purely over HTTP, with no assumptions about which
    database (or schema) the server is running on.
    """
    name = "OAuth public test client"
    redirect_uri = "http://127.0.0.1:8765/callback"
    response = _httpx_client(_app).post(
        "oauth2/register",
        json={"client_name": name, "redirect_uris": [redirect_uri]},
    )
    response.raise_for_status()
    registration = response.json()
    yield _OAuthPublicClient(
        client_id=registration["client_id"],
        name=name,
        redirect_uri=redirect_uri,
        app=_app,
    )


@dataclass(frozen=True)
class _OAuthPublicClient:
    client_id: str
    name: str
    redirect_uri: str
    app: _AppInfo
    code_verifier: str = ""
    code_challenge: str = ""

    def __post_init__(self) -> None:
        verifier = "a" + token_hex(48)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode()
        object.__setattr__(self, "code_verifier", verifier)
        object.__setattr__(self, "code_challenge", challenge.rstrip("="))

    def authorization_params(self, *, state: str | None = None) -> dict[str, str]:
        return {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "code_challenge": self.code_challenge,
            "code_challenge_method": "S256",
            "state": state or f"state-{token_hex(16)}",
            "scope": "read write ignored",
        }

    def authorize(self, auth: Any, *, state: str | None = None) -> dict[str, str]:
        params = self.authorization_params(state=state)
        response = _httpx_client(self.app, auth).get(
            "oauth2/authorize",
            params=params,
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert urlparse(response.headers["location"]).path.endswith("/oauth2/consent")
        return params

    def decide(self, auth: Any, params: dict[str, str], *, approved: bool = True) -> str:
        response = _httpx_client(
            self.app, auth, headers={"origin": _origin(self.app.base_url)}
        ).post(
            "oauth2/authorize/decision",
            json={**params, "approved": approved},
        )
        response.raise_for_status()
        redirect_to = response.json()["redirect_to"]
        assert isinstance(redirect_to, str)
        return redirect_to

    def exchange_code(self, redirect_to: str) -> dict[str, Any]:
        query = parse_qs(urlparse(redirect_to).query)
        code = query["code"][0]
        response = _httpx_client(self.app).post(
            "oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": self.client_id,
                "redirect_uri": self.redirect_uri,
                "code_verifier": self.code_verifier,
            },
        )
        response.raise_for_status()
        data = response.json()
        assert isinstance(data, dict)
        return data

    def complete_flow(self, auth: Any) -> dict[str, Any]:
        params = self.authorize(auth)
        redirect_to = self.decide(auth, params)
        return self.exchange_code(redirect_to)


def _active_grants(app: _AppInfo, user: Any) -> list[dict[str, Any]]:
    """The user's active (non-revoked) grants, observed through the GraphQL API.

    Revoked grants are filtered out by the server, so a grant's presence in
    this list doubles as the assertion that it has not been revoked.
    """
    response, _ = user.gql(
        app,
        "query { viewer { ... on User { oauth2Grants { id clientId scopes } } } }",
    )
    assert not response.get("errors")
    grants = response["data"]["viewer"]["oauth2Grants"]
    assert isinstance(grants, list)
    return grants


def _oauth2_app_env(
    *,
    port: int,
    grpc_port: int,
    database: str,
    extra: Mapping[str, str],
) -> dict[str, str]:
    return {
        "PHOENIX_PORT": str(port),
        "PHOENIX_GRPC_PORT": str(grpc_port),
        "PHOENIX_MASK_INTERNAL_SERVER_ERRORS": "false",
        "PHOENIX_SQL_DATABASE_URL": f"sqlite:///{database}",
        "PHOENIX_ENABLE_AUTH": "true",
        "PHOENIX_SECRET": token_hex(16),
        "PHOENIX_ADMIN_SECRET": token_hex(16),
        "PHOENIX_CSRF_TRUSTED_ORIGINS": f",http://localhost,http://127.0.0.1:{port},",
        **extra,
    }


def _origin(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"
