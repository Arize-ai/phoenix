"""Passing MCP authentication and internal-principal boundary controls."""

from __future__ import annotations

import pytest

from tests.integration._helpers import _MEMBER, _AppInfo, _GetUser, _httpx_client
from tests.integration.auth.test_mcp import _mcp_token_for, _register_public_client

pytestmark = [pytest.mark.authn, pytest.mark.authz]


def _initialize_request() -> dict[str, object]:
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "security-mcp-boundary", "version": "0"},
        },
    }


@pytest.mark.parametrize("path", ["mcp", "mcp/", "mcp//"], ids=["bare", "slash", "double-slash"])
def test_mcp_path_forms_cannot_bypass_bearer_authentication(
    _app: _AppInfo,
    path: str,
) -> None:
    """Every supported-looking mount-path form must challenge invalid credentials."""
    response = _httpx_client(_app).post(
        path,
        headers={
            "accept": "application/json, text/event-stream",
            "authorization": "Bearer security-invalid-token",
        },
        json=_initialize_request(),
    )

    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Bearer ")


def test_wire_header_cannot_forge_the_internal_mcp_principal(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """Only an in-process ASGI scope can carry the MCP-to-REST principal."""
    mcp_token = _mcp_token_for(_app, _get_user, _MEMBER)
    response = _httpx_client(_app).get(
        "v1/projects",
        headers={
            "authorization": f"Bearer {mcp_token}",
            "phoenix.internal.principal": "synthetic-forgery",
        },
    )
    del mcp_token

    assert response.status_code == 401


def test_revoked_oauth_access_token_is_denied_at_mcp(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """MCP must re-check token status instead of trusting an old session credential."""
    oauth_client = _register_public_client(_app)
    user = _get_user(_app, _MEMBER).log_in(_app)
    access_token = oauth_client.complete_flow(user)["access_token"]
    client = _httpx_client(_app)
    before_revoke = client.post(
        "mcp",
        headers={
            "accept": "application/json, text/event-stream",
            "authorization": f"Bearer {access_token}",
        },
        json=_initialize_request(),
    )
    revoke_response = client.post("oauth2/revoke", data={"token": access_token})
    after_revoke = client.post(
        "mcp",
        headers={
            "accept": "application/json, text/event-stream",
            "authorization": f"Bearer {access_token}",
        },
        json=_initialize_request(),
    )
    del access_token

    assert before_revoke.status_code == 200
    assert revoke_response.status_code == 200
    assert after_revoke.status_code == 401
