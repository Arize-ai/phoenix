from __future__ import annotations

from tests.integration._helpers import _MEMBER, _AppInfo, _GetUser, _httpx_client

from .conftest import _active_grants, _OAuthPublicClient


def test_refresh_token_rotates_pair(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    token_response = _oauth_public_client.complete_flow(user)

    refresh_response = _httpx_client(_app).post(
        "oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": token_response["refresh_token"],
            "client_id": _oauth_public_client.client_id,
        },
    )
    refresh_response.raise_for_status()
    rotated = refresh_response.json()

    assert rotated["access_token"] != token_response["access_token"]
    assert rotated["refresh_token"] != token_response["refresh_token"]
    assert rotated["scope"] == "read_only"


def test_rotated_refresh_token_reuse_is_invalid_grant(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    before = {grant["id"] for grant in _active_grants(_app, user)}
    token_response = _oauth_public_client.complete_flow(user)
    response = _httpx_client(_app).post(
        "oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": token_response["refresh_token"],
            "client_id": _oauth_public_client.client_id,
        },
    )
    response.raise_for_status()

    reuse_response = _httpx_client(_app).post(
        "oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": token_response["refresh_token"],
            "client_id": _oauth_public_client.client_id,
        },
    )

    assert reuse_response.status_code == 400
    assert reuse_response.json()["error"] == "invalid_grant"
    new_grants = [grant for grant in _active_grants(_app, user) if grant["id"] not in before]
    assert len(new_grants) == 1


def test_revoke_soft_revokes_grant(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    before = {grant["id"] for grant in _active_grants(_app, user)}
    token_response = _oauth_public_client.complete_flow(user)

    revoke_response = _httpx_client(_app).post(
        "oauth2/revoke",
        data={"token": token_response["access_token"]},
    )

    assert revoke_response.status_code == 200
    after = {grant["id"] for grant in _active_grants(_app, user)}
    assert after == before
    refresh_response = _httpx_client(_app).post(
        "oauth2/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": token_response["refresh_token"],
            "client_id": _oauth_public_client.client_id,
        },
    )
    assert refresh_response.status_code == 400
    assert refresh_response.json()["error"] == "invalid_grant"


def test_revoke_oauth2_grant_mutation_evicts_cached_tokens(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    token_response = _oauth_public_client.complete_flow(user)
    access_token = token_response["access_token"]

    read_response = _httpx_client(
        _app,
        headers={"authorization": f"Bearer {access_token}"},
    ).post("graphql", json={"query": "query { viewer { id } }"})
    assert read_response.status_code == 200
    assert not read_response.json().get("errors")

    sessions_response, _ = user.gql(
        _app,
        "query { viewer { ... on User { oauth2Grants { id } } } }",
    )
    assert not sessions_response.get("errors")
    grant_id = sessions_response["data"]["viewer"]["oauth2Grants"][-1]["id"]

    revoke_response, _ = user.gql(
        _app,
        """
        mutation RevokeOAuth2Grant($id: ID!) {
          revokeOAuth2Grant(input: { id: $id }) {
            grantId
          }
        }
        """,
        variables={"id": grant_id},
    )

    assert not revoke_response.get("errors")
    assert revoke_response["data"]["revokeOAuth2Grant"]["grantId"] == grant_id
    revoked_read_response = _httpx_client(
        _app,
        headers={"authorization": f"Bearer {access_token}"},
    ).post("graphql", json={"query": "query { viewer { id } }"})
    assert revoked_read_response.status_code == 401
