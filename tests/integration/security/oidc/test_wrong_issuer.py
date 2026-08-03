"""HC-07 regression: a signed token from a wrong issuer cannot create a session."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from phoenix.auth import PHOENIX_ACCESS_TOKEN_COOKIE_NAME
from tests.integration._helpers import _AppInfo, _httpx_client, _OIDCServer

pytestmark = [pytest.mark.authn]


def test_wrong_issuer_signed_id_token_is_rejected_before_session_creation(
    _app: _AppInfo,
    _oidc_server: _OIDCServer,
) -> None:
    """An IdP signature is insufficient when its issuer claim is wrong."""
    login = _httpx_client(_app).post(f"oauth2/{_oidc_server}/login")
    assert login.status_code == 302
    callback = _httpx_client(_app).get(login.headers["location"])
    assert callback.status_code == 302

    _oidc_server.set_id_token_claim_overrides(iss="https://wrong-issuer.invalid")
    try:
        response = _httpx_client(_app, cookies=dict(login.cookies)).get(
            callback.headers["location"]
        )
    finally:
        _oidc_server.set_id_token_claim_overrides()

    assert response.status_code == 307
    redirect = urlparse(response.headers["location"])
    assert redirect.path == "/login"
    assert parse_qs(redirect.query)["error"] == ["auth_failed"]
    assert PHOENIX_ACCESS_TOKEN_COOKIE_NAME not in response.cookies
