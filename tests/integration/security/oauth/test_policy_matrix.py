"""OAuth scope, DCR metadata, and credential-boundary security controls."""

from __future__ import annotations

from secrets import token_hex
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest

from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from tests.integration._helpers import (
    _ADMIN,
    _MEMBER,
    _VIEWER,
    _AppInfo,
    _GetUser,
    _httpx_client,
)
from tests.integration.auth.conftest import _OAuthPublicClient
from tests.integration.auth.test_mcp import _register_public_client

pytestmark = [pytest.mark.authn, pytest.mark.authz, pytest.mark.input_validation]


def _oauth_tokens_with_requested_scope(
    app: _AppInfo,
    get_user: _GetUser,
    role: UserRoleInput,
) -> tuple[dict[str, Any], Any]:
    client = _register_public_client(app)
    user = get_user(app, role).log_in(app)
    params = client.authorize(user)
    params["scope"] = "admin root write delete_everything unknown"
    redirect_to = client.decide(user, params)
    return client.exchange_code(redirect_to), user


@pytest.mark.parametrize(
    "role,admin_status,write_status",
    [
        (_ADMIN, 200, 200),
        (_MEMBER, 403, 200),
        (_VIEWER, 403, 403),
    ],
    ids=["admin", "member", "viewer"],
)
def test_requested_scopes_cannot_override_role_permissions(
    _app: _AppInfo,
    _get_user: _GetUser,
    role: UserRoleInput,
    admin_status: int,
    write_status: int,
) -> None:
    token_response, user = _oauth_tokens_with_requested_scope(_app, _get_user, role)
    assert "scope" not in token_response
    headers = {"authorization": f"Bearer {token_response['access_token']}"}
    project_name = f"security-scope-project-{token_hex(8)}"

    common_read = _httpx_client(_app).get("v1/projects", headers=headers)
    admin_read = _httpx_client(_app).get("v1/users", headers=headers)
    member_write = _httpx_client(_app).post(
        "v1/projects",
        headers=headers,
        json={"name": project_name},
    )
    graphql_read = _httpx_client(_app).post(
        "graphql",
        headers=headers,
        json={"query": "query SecurityScopeMatrix { viewer { id } }"},
    )

    assert common_read.status_code == 200
    assert admin_read.status_code == admin_status
    assert member_write.status_code == write_status
    if write_status == 200:
        assert member_write.json()["data"]["name"] == project_name
    else:
        projects = _httpx_client(_app).get(
            "v1/projects",
            headers=headers,
            params={"name_contains": project_name},
        )
        assert projects.status_code == 200
        assert projects.json()["data"] == []
    assert graphql_read.status_code == 200
    assert "errors" not in graphql_read.json()

    grants, _ = user.gql(
        _app,
        "query SecurityScopeGrants { viewer { ... on User { oauth2Grants { scopes } } } }",
    )
    assert not grants.get("errors")
    assert grants["data"]["viewer"]["oauth2Grants"][-1]["scopes"] == []


@pytest.mark.parametrize(
    "metadata",
    [
        {"client_name": "x" * 201},
        {"client_name": "line1\nline2"},
        {"logo_uri": "x" * 2049},
        {"grant_types": ["implicit"]},
        {"response_types": ["token"]},
        {"redirect_uris": []},
    ],
    ids=[
        "oversized-name",
        "non-printable-name",
        "oversized-logo",
        "unsupported-grant",
        "unsupported-response",
        "missing-redirect",
    ],
)
def test_dcr_rejects_malformed_or_oversized_defined_metadata(
    _app: _AppInfo,
    metadata: dict[str, Any],
) -> None:
    payload: dict[str, Any] = {
        "client_name": "Security DCR client",
        "redirect_uris": ["http://127.0.0.1:8765/callback"],
        **metadata,
    }
    response = _httpx_client(_app).post("oauth2/register", json=payload)

    assert response.status_code == 400
    assert response.json()["error"] == "invalid_client_metadata"


def test_unknown_dcr_metadata_remains_inert_through_authorization(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    client_name = "Unverified security client"
    redirect_uri = "http://127.0.0.1:8765/callback"
    registration = _httpx_client(_app).post(
        "oauth2/register",
        json={
            "client_name": client_name,
            "redirect_uris": [redirect_uri],
            "is_first_party": True,
            "trusted_client_name": "Phoenix CLI",
            "authorization_override": "admin",
        },
    )
    registration.raise_for_status()
    registered = registration.json()
    assert "is_first_party" not in registered
    assert "trusted_client_name" not in registered
    assert "authorization_override" not in registered

    client = _OAuthPublicClient(
        client_id=registered["client_id"],
        name=client_name,
        redirect_uri=redirect_uri,
        app=_app,
    )
    user = _get_user(_app, _MEMBER).log_in(_app)
    params = client.authorization_params()
    params["client_name"] = "Phoenix CLI"
    params["is_first_party"] = "true"
    response = _httpx_client(_app, user).get(
        "oauth2/authorize",
        params=params,
        follow_redirects=False,
    )

    assert response.status_code == 302
    consent_query = parse_qs(urlparse(response.headers["location"]).query)
    assert consent_query["client_name"] == [client_name]
    assert consent_query["is_first_party"] == ["false"]


@pytest.mark.parametrize(
    "credential_kind,rest_status,graphql_status,agent_status",
    [
        ("oauth-access", 200, 200, 200),
        ("api-key", 200, 200, 200),
        ("refresh", 401, 401, 401),
        ("mcp-access", 401, 401, 401),
    ],
    ids=["oauth-access", "api-key", "refresh", "mcp-audience-access"],
)
def test_http_credential_type_and_audience_matrix(
    _app: _AppInfo,
    _get_user: _GetUser,
    credential_kind: str,
    rest_status: int,
    graphql_status: int,
    agent_status: int,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    if credential_kind == "api-key":
        credential = str(user.create_api_key(_app))
    else:
        resource = f"{_app.base_url.rstrip('/')}/mcp" if credential_kind == "mcp-access" else None
        client = _register_public_client(_app, resource=resource)
        tokens = client.complete_flow(user)
        credential = (
            tokens["refresh_token"] if credential_kind == "refresh" else tokens["access_token"]
        )
    headers = {"authorization": f"Bearer {credential}"}

    rest_response = _httpx_client(_app).get("v1/projects", headers=headers)
    graphql_response = _httpx_client(_app).post(
        "graphql",
        headers=headers,
        json={"query": "query SecurityCredentialMatrix { viewer { id } }"},
    )
    agent_response = _httpx_client(_app).post(
        "agents/assistant/sessions/security-matrix/chat",
        headers=headers,
        json={
            "trigger": "submit-message",
            "id": f"security-matrix-message-{token_hex(8)}",
            "messages": [
                {
                    "id": f"security-matrix-user-message-{token_hex(8)}",
                    "role": "user",
                    "parts": [{"type": "text", "text": "verify credential boundary"}],
                }
            ],
            "model": {
                "providerType": "builtin",
                "provider": "ANTHROPIC",
                "modelName": "claude-3-5-sonnet-20241022",
            },
        },
    )

    assert rest_response.status_code == rest_status
    assert graphql_response.status_code == graphql_status
    assert agent_response.status_code == agent_status
