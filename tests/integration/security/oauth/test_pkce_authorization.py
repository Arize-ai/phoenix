"""PKCE downgrade controls enforced before OAuth consent."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from tests.integration._helpers import _MEMBER, _AppInfo, _GetUser, _httpx_client
from tests.integration.auth.conftest import _active_grants, _OAuthPublicClient

pytestmark = [pytest.mark.authz]


@pytest.mark.parametrize(
    "missing_parameter,overrides",
    [
        pytest.param("code_challenge", {}, id="missing-challenge"),
        pytest.param("code_challenge_method", {}, id="missing-method"),
        pytest.param(None, {"code_challenge_method": "plain"}, id="plain-method"),
    ],
)
def test_pkce_downgrades_are_rejected_before_consent(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
    missing_parameter: str | None,
    overrides: dict[str, str],
) -> None:
    """A request without an explicit S256 challenge cannot reach consent."""
    user = _get_user(_app, _MEMBER).log_in(_app)
    grants_before = _active_grants(_app, user)
    authorization = _oauth_public_client.authorization_params()
    if missing_parameter is not None:
        authorization.pop(missing_parameter)
    authorization.update(overrides)

    response = _httpx_client(_app, user).get(
        "oauth2/authorize",
        params=authorization,
        follow_redirects=False,
    )

    assert response.status_code == 302
    redirect = urlparse(response.headers["location"])
    expected_redirect = urlparse(_oauth_public_client.redirect_uri)
    assert (redirect.scheme, redirect.netloc, redirect.path) == (
        expected_redirect.scheme,
        expected_redirect.netloc,
        expected_redirect.path,
    )
    assert not redirect.path.endswith("/oauth2/consent")
    query = parse_qs(redirect.query)
    assert query == {
        "error": ["invalid_request"],
        "state": [authorization["state"]],
    }
    assert "code" not in query
    assert _active_grants(_app, user) == grants_before
