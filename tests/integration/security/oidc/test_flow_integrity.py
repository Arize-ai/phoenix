"""OIDC browser-flow correlation values are unique and correctly bound."""

from __future__ import annotations

import base64
import hashlib
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from phoenix.auth import (
    PHOENIX_OAUTH2_CODE_VERIFIER_COOKIE_NAME,
    PHOENIX_OAUTH2_NONCE_COOKIE_NAME,
    PHOENIX_OAUTH2_STATE_COOKIE_NAME,
)
from tests.integration._helpers import _AppInfo, _httpx_client, _OIDCServer

pytestmark = [pytest.mark.session_management]


def _authorization_values(response: httpx.Response) -> tuple[str, str, str, str]:
    assert response.status_code == 302
    query = parse_qs(urlparse(response.headers["location"]).query)
    state = response.cookies[PHOENIX_OAUTH2_STATE_COOKIE_NAME]
    nonce = response.cookies[PHOENIX_OAUTH2_NONCE_COOKIE_NAME]
    verifier = response.cookies[PHOENIX_OAUTH2_CODE_VERIFIER_COOKIE_NAME]
    assert query["state"] == [state]
    assert query["nonce"] == [nonce]
    assert query["code_challenge_method"] == ["S256"]
    expected_challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    )
    assert query["code_challenge"] == [expected_challenge]
    return state, nonce, verifier, expected_challenge


def test_parallel_oidc_flows_use_distinct_correlation_secrets(
    _app: _AppInfo,
    _oidc_server_pkce_public: _OIDCServer,
) -> None:
    """Two bounded flow starts cannot share state, nonce, or PKCE material."""
    first_login = _httpx_client(_app).post(f"oauth2/{_oidc_server_pkce_public}/login")
    second_login = _httpx_client(_app).post(f"oauth2/{_oidc_server_pkce_public}/login")

    first_values = _authorization_values(first_login)
    second_values = _authorization_values(second_login)

    assert all(first != second for first, second in zip(first_values, second_values))
