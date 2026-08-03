"""OAuth token exchanges cannot upgrade role-based permissions through scope."""

from __future__ import annotations

from secrets import token_hex
from urllib.parse import parse_qs, urlparse

import pytest

from tests.integration._helpers import _VIEWER, _AppInfo, _GetUser, _httpx_client
from tests.integration.auth.conftest import _active_grants, _OAuthPublicClient

pytestmark = [pytest.mark.authz]


def _assert_viewer_cannot_create_project(app: _AppInfo, access_token: str) -> None:
    project_name = f"scope-upgrade-project-{token_hex(8)}"
    headers = {"authorization": f"Bearer {access_token}"}

    creation = _httpx_client(app).post(
        "v1/projects",
        headers=headers,
        json={"name": project_name},
    )
    assert creation.status_code == 403

    projects = _httpx_client(app).get(
        "v1/projects",
        headers=headers,
        params={"name_contains": project_name},
    )
    assert projects.status_code == 200
    assert projects.json()["data"] == []


def test_code_exchange_scope_cannot_upgrade_viewer_permissions(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    """Scope supplied only at code exchange cannot alter the consented grant."""
    user = _get_user(_app, _VIEWER).log_in(_app)
    grants_before = _active_grants(_app, user)
    authorization = _oauth_public_client.authorize(user)
    redirect_to = _oauth_public_client.decide(user, authorization)
    code = parse_qs(urlparse(redirect_to).query)["code"][0]

    response = _httpx_client(_app).post(
        "oauth2/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": _oauth_public_client.client_id,
            "redirect_uri": _oauth_public_client.redirect_uri,
            "code_verifier": _oauth_public_client.code_verifier,
            "scope": "admin write",
        },
    )

    response.raise_for_status()
    token_response = response.json()
    assert "scope" not in token_response
    grants_after = _active_grants(_app, user)
    grant_ids_before = {grant["id"] for grant in grants_before}
    new_grants = [grant for grant in grants_after if grant["id"] not in grant_ids_before]
    assert len(new_grants) == 1
    assert new_grants[0]["scopes"] == []
    _assert_viewer_cannot_create_project(_app, token_response["access_token"])


def test_refresh_exchange_scope_cannot_upgrade_viewer_permissions(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    """Scope supplied during rotation cannot expand an immutable OAuth grant."""
    user = _get_user(_app, _VIEWER).log_in(_app)
    initial_tokens = _oauth_public_client.complete_flow(user)
    grants_before_refresh = _active_grants(_app, user)
    assert grants_before_refresh[-1]["scopes"] == []

    response = _httpx_client(_app).post(
        "oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": initial_tokens["refresh_token"],
            "client_id": _oauth_public_client.client_id,
            "scope": "admin write",
        },
    )

    response.raise_for_status()
    rotated_tokens = response.json()
    assert "scope" not in rotated_tokens
    assert _active_grants(_app, user) == grants_before_refresh
    _assert_viewer_cannot_create_project(_app, rotated_tokens["access_token"])
