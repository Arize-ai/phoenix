"""Passing authorization controls for the direct PXI server-agent route."""

from __future__ import annotations

from typing import Any

import pytest

from tests.integration._helpers import _MEMBER, _VIEWER, _AppInfo, _GetUser, _httpx_client
from tests.integration.auth.test_mcp import _register_public_client

pytestmark = [pytest.mark.authn, pytest.mark.authz]


def _chat_request(*, contexts: list[dict[str, object]] | None = None) -> dict[str, Any]:
    return {
        "trigger": "submit-message",
        "id": "security-pxi-direct-route-message",
        "messages": [
            {
                "id": "security-pxi-direct-route-user-message",
                "role": "user",
                "parts": [{"type": "text", "text": "security authorization probe"}],
            }
        ],
        "model": {
            "providerType": "builtin",
            "provider": "ANTHROPIC",
            "modelName": "claude-3-5-sonnet-20241022",
        },
        "contexts": contexts or [],
    }


@pytest.mark.parametrize("credential_kind", ["refresh", "mcp-audience"], ids=["refresh", "mcp"])
def test_direct_pxi_route_rejects_non_resource_access_credentials(
    _app: _AppInfo,
    _get_user: _GetUser,
    credential_kind: str,
) -> None:
    """A refresh or MCP-resource token cannot initiate the origin-scoped PXI route."""
    user = _get_user(_app, _MEMBER).log_in(_app)
    resource = f"{_app.base_url.rstrip('/')}/mcp" if credential_kind == "mcp-audience" else None
    tokens = _register_public_client(_app, resource=resource).complete_flow(user)
    credential = tokens["refresh_token"] if credential_kind == "refresh" else tokens["access_token"]

    response = _httpx_client(_app).post(
        "agents/server/sessions/security-untrusted-session/chat",
        headers={"authorization": f"Bearer {credential}"},
        json=_chat_request(),
    )

    assert response.status_code == 401


@pytest.mark.parametrize("credential_kind", ["oauth-access", "api-key"], ids=["oauth", "api-key"])
def test_direct_pxi_route_accepts_intended_member_credentials(
    _app: _AppInfo,
    _get_user: _GetUser,
    credential_kind: str,
) -> None:
    """The direct route accepts ordinary member credentials, regardless of client session text."""
    user = _get_user(_app, _MEMBER).log_in(_app)
    credential = (
        _register_public_client(_app).complete_flow(user)["access_token"]
        if credential_kind == "oauth-access"
        else str(user.create_api_key(_app))
    )

    response = _httpx_client(_app).post(
        "agents/server/sessions/attacker-chosen-but-unprivileged-id/chat",
        headers={"authorization": f"Bearer {credential}"},
        json=_chat_request(),
    )

    assert response.status_code == 200


def test_viewer_cannot_enable_direct_pxi_graphql_mutations(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """The server, not the client UI, rejects a viewer's mutation capability request."""
    viewer = _get_user(_app, _VIEWER).log_in(_app)
    response = _httpx_client(_app, viewer.tokens).post(
        "agents/server/sessions/security-viewer-session/chat",
        json=_chat_request(contexts=[{"type": "graphql", "mutationsEnabled": True}]),
    )

    assert response.status_code == 403
    assert response.text == "Viewer users cannot enable mutations"


def test_direct_pxi_route_rejects_unauthenticated_caller(
    _app: _AppInfo,
) -> None:
    response = _httpx_client(_app).post(
        "agents/server/sessions/security-no-credential/chat",
        json=_chat_request(),
    )

    assert response.status_code == 401
