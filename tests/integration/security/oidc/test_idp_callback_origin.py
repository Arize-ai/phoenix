"""IdP callback-origin controls at the complete HTTP middleware boundary."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from phoenix.auth import (
    PHOENIX_OAUTH2_CODE_VERIFIER_COOKIE_NAME,
    PHOENIX_OAUTH2_NONCE_COOKIE_NAME,
    PHOENIX_OAUTH2_STATE_COOKIE_NAME,
)
from tests.integration._helpers import _AppInfo, _httpx_client, _OIDCServer

pytestmark = [pytest.mark.input_validation]


def _callback_origin(response_location: str) -> tuple[str, str]:
    authorization_query = parse_qs(urlparse(response_location).query)
    callback = urlparse(authorization_query["redirect_uri"][0])
    return callback.scheme, callback.netloc


@pytest.mark.parametrize("headers", [{}, {"referer": "APP_ORIGIN/oauth-client"}])
def test_missing_or_same_origin_referer_uses_phoenix_callback_origin(
    _app: _AppInfo,
    _oidc_server: _OIDCServer,
    headers: dict[str, str],
) -> None:
    phoenix = urlparse(_app.base_url)
    resolved_headers = {
        key: value.replace("APP_ORIGIN", f"{phoenix.scheme}://{phoenix.netloc}")
        for key, value in headers.items()
    }
    response = _httpx_client(_app, headers=resolved_headers).post(f"oauth2/{_oidc_server}/login")

    assert response.status_code == 302
    assert _callback_origin(response.headers["location"]) == (phoenix.scheme, phoenix.netloc)


def test_foreign_referer_is_rejected_before_idp_flow_creation(
    _app: _AppInfo,
    _oidc_server: _OIDCServer,
) -> None:
    response = _httpx_client(
        _app,
        headers={"referer": "https://attacker.invalid/oauth-client"},
    ).post(f"oauth2/{_oidc_server}/login")

    assert response.status_code == 401
    assert response.text == "untrusted referer"
    assert "location" not in response.headers
    assert PHOENIX_OAUTH2_STATE_COOKIE_NAME not in response.cookies
    assert PHOENIX_OAUTH2_NONCE_COOKIE_NAME not in response.cookies
    assert PHOENIX_OAUTH2_CODE_VERIFIER_COOKIE_NAME not in response.cookies
