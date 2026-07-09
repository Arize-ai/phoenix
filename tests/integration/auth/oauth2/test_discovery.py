from __future__ import annotations

from tests.integration._helpers import _AppInfo, _httpx_client


def test_authorization_server_metadata(_app: _AppInfo) -> None:
    response = _httpx_client(_app).get(".well-known/oauth-authorization-server")

    response.raise_for_status()
    metadata = response.json()
    assert metadata["issuer"] == _app.base_url.rstrip("/")
    assert metadata["authorization_endpoint"].endswith("/oauth2/authorize")
    assert metadata["token_endpoint"].endswith("/oauth2/token")
    assert metadata["revocation_endpoint"].endswith("/oauth2/revoke")
    assert metadata["registration_endpoint"].endswith("/oauth2/register")
    assert metadata["scopes_supported"] == ["read_only"]


def test_protected_resource_metadata(_app: _AppInfo) -> None:
    response = _httpx_client(_app).get(".well-known/oauth-protected-resource")

    response.raise_for_status()
    metadata = response.json()
    assert metadata["resource"] == _app.base_url.rstrip("/")
    assert metadata["authorization_servers"] == [_app.base_url.rstrip("/")]
    assert metadata["scopes_supported"] == ["read_only"]


def test_auth_md_documents_oauth2_authorization_server(_app: _AppInfo) -> None:
    response = _httpx_client(_app).get("auth.md")

    response.raise_for_status()
    text = response.text
    assert "/oauth2/authorize" in text
    assert "/oauth2/token" in text
    assert "/oauth2/revoke" in text
    assert "read_only" in text
    assert "keys are still recommended" in text
