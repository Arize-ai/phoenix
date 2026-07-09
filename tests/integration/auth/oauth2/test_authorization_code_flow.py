from __future__ import annotations

from urllib.parse import parse_qs, urlparse

from phoenix.server.types import GRANT_SCOPE_READ_ONLY
from tests.integration._helpers import _MEMBER, _AppInfo, _GetUser

from .conftest import _active_grants, _OAuthPublicClient


def test_authorization_code_flow_creates_grant(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    before = {grant["id"] for grant in _active_grants(_app, user)}

    token_response = _oauth_public_client.complete_flow(user)

    assert token_response["token_type"] == "Bearer"
    assert token_response["scope"] == GRANT_SCOPE_READ_ONLY
    assert token_response["access_token"]
    assert token_response["refresh_token"]
    new_grants = [grant for grant in _active_grants(_app, user) if grant["id"] not in before]
    assert len(new_grants) == 1
    assert new_grants[0]["clientId"] == _oauth_public_client.client_id
    assert new_grants[0]["scopes"] == [GRANT_SCOPE_READ_ONLY]


def test_authorization_code_flow_grant_is_visible_to_viewer_graphql(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)

    _oauth_public_client.complete_flow(user)
    response, _ = user.gql(
        _app,
        """
        query {
          viewer {
            ... on User {
              oauth2Grants {
                id
                clientName
                isFirstParty
                clientId
                scopes
                createdAt
                expiresAt
                lastUsedAt
              }
            }
          }
        }
        """,
    )

    assert not response.get("errors")
    grants = response["data"]["viewer"]["oauth2Grants"]
    assert grants[-1]["id"]
    assert grants[-1]["clientName"] == _oauth_public_client.name
    assert grants[-1]["isFirstParty"] is False
    assert grants[-1]["clientId"] == _oauth_public_client.client_id
    assert grants[-1]["scopes"] == [GRANT_SCOPE_READ_ONLY]
    assert grants[-1]["createdAt"]
    assert grants[-1]["expiresAt"]
    assert grants[-1]["lastUsedAt"]


def test_authorization_decision_denial_returns_access_denied(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    params = _oauth_public_client.authorize(user)

    redirect_to = _oauth_public_client.decide(user, params, approved=False)

    query = parse_qs(urlparse(redirect_to).query)
    assert query["error"] == ["access_denied"]
    assert query["state"] == [params["state"]]


def test_token_exchange_rejects_wrong_code_verifier(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    params = _oauth_public_client.authorize(user)
    redirect_to = _oauth_public_client.decide(user, params)
    code = parse_qs(urlparse(redirect_to).query)["code"][0]

    from tests.integration._helpers import _httpx_client

    token_response = _httpx_client(_app).post(
        "oauth2/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": _oauth_public_client.client_id,
            "redirect_uri": _oauth_public_client.redirect_uri,
            "code_verifier": "b" + "a" * 42,
        },
    )

    assert token_response.status_code == 400
    assert token_response.json()["error"] == "invalid_grant"
