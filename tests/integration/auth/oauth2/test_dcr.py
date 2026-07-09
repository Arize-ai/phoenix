from __future__ import annotations

import re

import httpx
import pytest

from tests.integration._helpers import _MEMBER, _AppInfo, _GetUser, _httpx_client

from .conftest import _OAuthPublicClient


def test_register_local_only_client_completes_authorization_code_flow(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    redirect_uri = "http://127.0.0.1:8765/callback/test-client"
    client = _register_client(_app, redirect_uri=redirect_uri)
    user = _get_user(_app, _MEMBER).log_in(_app)

    token_response = client.complete_flow(user)

    assert token_response["token_type"] == "Bearer"
    assert token_response["access_token"]
    assert token_response["refresh_token"]


@pytest.mark.parametrize(
    "redirect_uri",
    [
        "http://127.0.0.1:8765/callback/test-client",
        "http://127.0.0.1",
        "cursor://anysphere.cursor-mcp/oauth/callback",
    ],
)
def test_register_local_only_redirect_classes_complete_flow(
    _app: _AppInfo,
    _get_user: _GetUser,
    redirect_uri: str,
) -> None:
    client = _register_client(_app, redirect_uri=redirect_uri)
    user = _get_user(_app, _MEMBER).log_in(_app)

    token_response = client.complete_flow(user)

    assert token_response["access_token"]


@pytest.mark.parametrize(
    "redirect_uri",
    [
        "https://vscode.dev/redirect",
        "https://insiders.vscode.dev/redirect",
    ],
)
def test_register_local_only_rejects_https_redirects(
    _app: _AppInfo,
    redirect_uri: str,
) -> None:
    response = _register_response(_app, redirect_uri=redirect_uri)

    assert response.status_code == 400
    assert response.json()["error"] == "invalid_redirect_uri"


def test_register_overrides_client_secret_post_to_none(_app: _AppInfo) -> None:
    response = _register_response(
        _app,
        redirect_uri="http://127.0.0.1:8765/callback",
        token_endpoint_auth_method="client_secret_post",
    )

    response.raise_for_status()
    data = response.json()
    assert data["token_endpoint_auth_method"] == "none"
    assert "client_secret" not in data


def test_register_rate_limit_trips_at_low_threshold(_app_dcr_rate_limited: _AppInfo) -> None:
    first_response = _register_response(
        _app_dcr_rate_limited,
        redirect_uri="http://127.0.0.1:8765/callback/one",
    )
    second_response = _register_response(
        _app_dcr_rate_limited,
        redirect_uri="http://127.0.0.1:8765/callback/two",
    )

    first_response.raise_for_status()
    assert second_response.status_code == 429


def test_register_enabled_with_allowed_host_accepts_https_end_to_end(
    _app_dcr_enabled: _AppInfo,
    _get_user: _GetUser,
) -> None:
    redirect_uri = "https://vscode.dev/redirect"
    client = _register_client(_app_dcr_enabled, redirect_uri=redirect_uri)
    user = _get_user(_app_dcr_enabled, _MEMBER).log_in(_app_dcr_enabled)

    token_response = client.complete_flow(user)

    assert token_response["access_token"]


def test_register_disabled_omits_metadata_and_rejects_registration(
    _app_dcr_disabled: _AppInfo,
) -> None:
    metadata_response = _httpx_client(_app_dcr_disabled).get(
        ".well-known/oauth-authorization-server"
    )
    register_response = _register_response(
        _app_dcr_disabled,
        redirect_uri="http://127.0.0.1:8765/callback",
    )

    metadata_response.raise_for_status()
    assert "registration_endpoint" not in metadata_response.json()
    assert register_response.status_code == 403


def _register_client(
    app: _AppInfo,
    *,
    redirect_uri: str,
) -> _OAuthPublicClient:
    response = _register_response(app, redirect_uri=redirect_uri)
    response.raise_for_status()
    data = response.json()
    client_id = data["client_id"]
    assert isinstance(client_id, str)
    assert re.fullmatch(r"px_dcr_[A-Za-z0-9]{22}", client_id)
    return _OAuthPublicClient(
        client_id=client_id,
        name="Dynamic test client",
        redirect_uri=redirect_uri,
        app=app,
    )


def _register_response(
    app: _AppInfo,
    *,
    redirect_uri: str,
    token_endpoint_auth_method: str = "none",
) -> httpx.Response:
    return _httpx_client(app).post(
        "oauth2/register",
        json={
            "client_name": "Dynamic test client",
            "redirect_uris": [redirect_uri],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": token_endpoint_auth_method,
            "logo_uri": "https://example.com/logo.png",
            "software_id": "integration-test",
        },
    )
