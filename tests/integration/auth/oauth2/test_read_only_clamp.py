from __future__ import annotations

from tests.integration._helpers import _MEMBER, _AppInfo, _GetUser, _httpx_client

from .conftest import _OAuthPublicClient


def test_grant_token_can_read_rest_resources(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    token_response = _oauth_public_client.complete_flow(user)

    response = _httpx_client(
        _app,
        headers={"authorization": f"Bearer {token_response['access_token']}"},
    ).get("v1/projects")

    assert response.status_code == 200


def test_grant_token_cannot_write_rest_resources(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    token_response = _oauth_public_client.complete_flow(user)

    response = _httpx_client(
        _app,
        headers={"authorization": f"Bearer {token_response['access_token']}"},
    ).post("v1/projects", json={"name": "blocked"})

    assert response.status_code == 403


def test_grant_token_cannot_run_graphql_mutations(
    _app: _AppInfo,
    _get_user: _GetUser,
    _oauth_public_client: _OAuthPublicClient,
) -> None:
    user = _get_user(_app, _MEMBER).log_in(_app)
    token_response = _oauth_public_client.complete_flow(user)

    response = _httpx_client(
        _app,
        headers={"authorization": f"Bearer {token_response['access_token']}"},
    ).post(
        "graphql",
        json={"query": 'mutation { createProject(input: { name: "blocked" }) { project { id } } }'},
    )

    assert response.status_code == 200
    assert response.json()["errors"][0]["message"] == (
        "OAuth2 grant-linked tokens cannot perform GraphQL mutations"
    )
