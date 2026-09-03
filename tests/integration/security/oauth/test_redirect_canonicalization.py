"""HC-02 redirect-URI canonicalization controls at the authorize boundary."""

from __future__ import annotations

import pytest

from tests.integration._helpers import _MEMBER, _AppInfo, _GetUser, _httpx_client
from tests.integration.auth.conftest import _OAuthPublicClient

pytestmark = [pytest.mark.input_validation]


@pytest.mark.parametrize(
    "redirect_uri",
    [
        "http://127.0.0.1:8765/callback/../callback",
        "http://127.0.0.1:8765/callback%2Fother",
        "http://attacker@127.0.0.1:8765/callback",
        "http://127.0.0.1:8765/callback#fragment",
        "http://127.0.0.1.:8765/callback",
        "http://[::1]:8765/callback",
        "http://localhost:8765/callback",
        "http://127.0.0.1:8765/callback?next=https%3A%2F%2Fattacker.invalid",
    ],
    ids=[
        "dot-segment",
        "encoded-slash",
        "userinfo",
        "fragment",
        "trailing-dot-loopback",
        "ipv6-loopback",
        "localhost-alias",
        "unregistered-query",
    ],
)
def test_equivalent_looking_unregistered_redirects_are_rejected(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
    redirect_uri: str,
) -> None:
    """Only the registered loopback host/path/query policy may authorize."""
    user = _get_user(_app, _MEMBER).log_in(_app)
    authorization = _oauth_public_client.authorization_params()
    authorization["redirect_uri"] = redirect_uri

    response = _httpx_client(_app, user).get(
        "oauth2/authorize",
        params=authorization,
        follow_redirects=False,
    )

    assert response.status_code == 400
    assert "Invalid redirect URI" in response.text
