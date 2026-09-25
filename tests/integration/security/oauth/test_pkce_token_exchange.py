"""PKCE verifier binding at the OAuth token endpoint."""

from __future__ import annotations

import base64
import hashlib
from secrets import token_urlsafe
from urllib.parse import parse_qs, urlparse

import pytest

from tests.integration._helpers import (
    _MEMBER,
    _AppInfo,
    _GetUser,
    _httpx_client,
    _LoggedInUser,
)
from tests.integration.auth.conftest import _active_grants, _OAuthPublicClient

pytestmark = [pytest.mark.authz]


def _challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def _issue_code(
    app: _AppInfo,
    client: _OAuthPublicClient,
    user: _LoggedInUser,
    verifier: str,
) -> str:
    authorization = client.authorization_params()
    authorization["code_challenge"] = _challenge(verifier)
    response = _httpx_client(app, user).get(
        "oauth2/authorize",
        params=authorization,
        follow_redirects=False,
    )
    assert response.status_code == 302
    assert urlparse(response.headers["location"]).path.endswith("/oauth2/consent")
    redirect_to = client.decide(user, authorization)
    query = parse_qs(urlparse(redirect_to).query)
    assert query["state"] == [authorization["state"]]
    assert len(query["code"]) == 1
    return query["code"][0]


def _token_form(client: _OAuthPublicClient, code: str) -> dict[str, str]:
    return {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client.client_id,
        "redirect_uri": client.redirect_uri,
    }


def test_missing_verifier_does_not_consume_authorization_code(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    """Omitting the verifier is denied without destroying a legitimate code."""
    user = _get_user(_app, _MEMBER).log_in(_app)
    grants_before = _active_grants(_app, user)
    code = _issue_code(_app, _oauth_public_client, user, _oauth_public_client.code_verifier)
    form = _token_form(_oauth_public_client, code)

    rejected = _httpx_client(_app).post("oauth2/token", data=form)

    assert rejected.status_code == 400
    assert rejected.json() == {"error": "invalid_grant"}
    assert rejected.headers["cache-control"] == "no-store"
    assert rejected.headers["pragma"] == "no-cache"
    assert _active_grants(_app, user) == grants_before

    accepted = _httpx_client(_app).post(
        "oauth2/token",
        data={**form, "code_verifier": _oauth_public_client.code_verifier},
    )
    accepted.raise_for_status()
    assert accepted.json()["access_token"]
    assert len(_active_grants(_app, user)) == len(grants_before) + 1


def test_verifier_from_another_flow_cannot_redeem_code(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    """A verifier is bound to one authorization flow, even for the same client."""
    user = _get_user(_app, _MEMBER).log_in(_app)
    grants_before = _active_grants(_app, user)
    verifier_a = token_urlsafe(48)
    verifier_b = token_urlsafe(48)
    assert verifier_a != verifier_b
    code_a = _issue_code(_app, _oauth_public_client, user, verifier_a)
    code_b = _issue_code(_app, _oauth_public_client, user, verifier_b)
    form_b = _token_form(_oauth_public_client, code_b)

    rejected = _httpx_client(_app).post(
        "oauth2/token",
        data={**form_b, "code_verifier": verifier_a},
    )

    assert rejected.status_code == 400
    assert rejected.json() == {"error": "invalid_grant"}
    assert _active_grants(_app, user) == grants_before

    accepted_b = _httpx_client(_app).post(
        "oauth2/token",
        data={**form_b, "code_verifier": verifier_b},
    )
    accepted_b.raise_for_status()
    assert accepted_b.json()["access_token"]

    accepted_a = _httpx_client(_app).post(
        "oauth2/token",
        data={
            **_token_form(_oauth_public_client, code_a),
            "code_verifier": verifier_a,
        },
    )
    accepted_a.raise_for_status()
    assert accepted_a.json()["access_token"]
    assert len(_active_grants(_app, user)) == len(grants_before) + 2
