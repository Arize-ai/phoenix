from __future__ import annotations

import re
from secrets import token_hex
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from tests.integration._helpers import _MEMBER, _AppInfo, _GetUser, _httpx_client

from .conftest import _active_grants, _OAuthPublicClient


class TestDiscovery:
    def test_authorization_server_metadata(self, _app: _AppInfo) -> None:
        response = _httpx_client(_app).get(".well-known/oauth-authorization-server")

        response.raise_for_status()
        metadata = response.json()
        assert metadata["issuer"] == _app.base_url.rstrip("/")
        assert metadata["authorization_endpoint"].endswith("/oauth2/authorize")
        assert metadata["token_endpoint"].endswith("/oauth2/token")
        assert metadata["revocation_endpoint"].endswith("/oauth2/revoke")
        assert metadata["registration_endpoint"].endswith("/oauth2/register")
        assert "scopes_supported" not in metadata

    def test_protected_resource_metadata(self, _app: _AppInfo) -> None:
        response = _httpx_client(_app).get(".well-known/oauth-protected-resource")

        response.raise_for_status()
        metadata = response.json()
        assert metadata["resource"] == _app.base_url.rstrip("/")
        assert metadata["authorization_servers"] == [_app.base_url.rstrip("/")]
        assert "scopes_supported" not in metadata

    def test_auth_md_documents_oauth2_authorization_server(self, _app: _AppInfo) -> None:
        response = _httpx_client(_app).get("auth.md")

        response.raise_for_status()
        text = response.text
        assert "/oauth2/authorize" in text
        assert "/oauth2/token" in text
        assert "/oauth2/revoke" in text
        assert "permissions of the user who approved" in text


class TestAuthorizationCodeFlow:
    def test_authorization_code_flow_creates_grant(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
        _oauth_public_client: _OAuthPublicClient,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        before = {grant["id"] for grant in _active_grants(_app, user)}

        token_response = _oauth_public_client.complete_flow(user)

        assert token_response["token_type"] == "Bearer"
        assert "scope" not in token_response
        assert token_response["access_token"]
        assert token_response["refresh_token"]
        new_grants = [grant for grant in _active_grants(_app, user) if grant["id"] not in before]
        assert len(new_grants) == 1
        assert new_grants[0]["clientId"] == _oauth_public_client.client_id
        assert new_grants[0]["scopes"] == []

    def test_authorization_code_flow_grant_is_visible_to_viewer_graphql(
        self,
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
        assert grants[-1]["scopes"] == []
        assert grants[-1]["createdAt"]
        assert grants[-1]["expiresAt"]
        assert grants[-1]["lastUsedAt"]

    def test_authorization_decision_denial_returns_access_denied(
        self,
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
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
        _oauth_public_client: _OAuthPublicClient,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        params = _oauth_public_client.authorize(user)
        redirect_to = _oauth_public_client.decide(user, params)
        code = parse_qs(urlparse(redirect_to).query)["code"][0]

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


class TestTokenLifecycle:
    def test_refresh_token_rotates_pair(
        self,
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
        assert "scope" not in rotated

    def test_rotated_refresh_token_reuse_is_invalid_grant(
        self,
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
        self,
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
        self,
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


class TestDynamicClientRegistration:
    def test_register_local_only_client_completes_authorization_code_flow(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        redirect_uri = "http://127.0.0.1:8765/callback/test-client"
        client = _register_client(_app, redirect_uri=redirect_uri)
        user = _get_user(_app, _MEMBER).log_in(_app)

        token_response = client.complete_flow(user)

        assert token_response["token_type"] == "Bearer"
        assert token_response["access_token"]
        assert token_response["refresh_token"]

    @pytest.mark.parametrize(
        "redirect_uri",
        [
            "http://127.0.0.1:8765/callback/test-client",
            "http://127.0.0.1",
            "cursor://anysphere.cursor-mcp/oauth/callback",
        ],
    )
    def test_register_local_only_redirect_classes_complete_flow(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
        redirect_uri: str,
    ) -> None:
        client = _register_client(_app, redirect_uri=redirect_uri)
        user = _get_user(_app, _MEMBER).log_in(_app)

        token_response = client.complete_flow(user)

        assert token_response["access_token"]

    @pytest.mark.parametrize(
        "redirect_uri",
        [
            "https://vscode.dev/redirect",
            "https://insiders.vscode.dev/redirect",
        ],
    )
    def test_register_local_only_rejects_https_redirects(
        self,
        _app: _AppInfo,
        redirect_uri: str,
    ) -> None:
        response = _register_response(_app, redirect_uri=redirect_uri)

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_redirect_uri"

    def test_register_overrides_client_secret_post_to_none(self, _app: _AppInfo) -> None:
        response = _register_response(
            _app,
            redirect_uri="http://127.0.0.1:8765/callback",
            token_endpoint_auth_method="client_secret_post",
        )

        response.raise_for_status()
        data = response.json()
        assert data["token_endpoint_auth_method"] == "none"
        assert "client_secret" not in data

    def test_register_rate_limit_trips_at_low_threshold(
        self,
        _app_dcr_rate_limited: _AppInfo,
    ) -> None:
        first_response = _register_response(
            _app_dcr_rate_limited,
            redirect_uri="http://127.0.0.1:8765/callback/one",
        )
        second_response = _register_response(
            _app_dcr_rate_limited,
            redirect_uri="http://127.0.0.1:8765/callback/two",
        )

        first_response.raise_for_status()
        assert second_response.status_code == 429

    def test_register_enabled_with_allowed_host_accepts_https_end_to_end(
        self,
        _app_dcr_enabled: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        redirect_uri = "https://vscode.dev/redirect"
        client = _register_client(_app_dcr_enabled, redirect_uri=redirect_uri)
        user = _get_user(_app_dcr_enabled, _MEMBER).log_in(_app_dcr_enabled)

        token_response = client.complete_flow(user)

        assert token_response["access_token"]

    def test_register_disabled_omits_metadata_and_rejects_registration(
        self,
        _app_dcr_disabled: _AppInfo,
    ) -> None:
        metadata_response = _httpx_client(_app_dcr_disabled).get(
            ".well-known/oauth-authorization-server"
        )
        register_response = _register_response(
            _app_dcr_disabled,
            redirect_uri="http://127.0.0.1:8765/callback",
        )

        metadata_response.raise_for_status()
        assert "registration_endpoint" not in metadata_response.json()
        assert register_response.status_code == 403


class TestGrantTokenAccess:
    def test_grant_token_can_read_rest_resources(
        self,
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

    def test_grant_token_can_write_rest_resources(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
        _oauth_public_client: _OAuthPublicClient,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        token_response = _oauth_public_client.complete_flow(user)

        response = _httpx_client(
            _app,
            headers={"authorization": f"Bearer {token_response['access_token']}"},
        ).post("v1/projects", json={"name": f"grant-rest-write-{token_hex(8)}"})

        assert response.status_code == 200

    def test_grant_token_can_run_graphql_mutations(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
        _oauth_public_client: _OAuthPublicClient,
    ) -> None:
        user = _get_user(_app, _MEMBER).log_in(_app)
        token_response = _oauth_public_client.complete_flow(user)
        project_name = f"grant-gql-write-{token_hex(8)}"

        response = _httpx_client(
            _app,
            headers={"authorization": f"Bearer {token_response['access_token']}"},
        ).post(
            "graphql",
            json={
                "query": (
                    "mutation ($name: String!) {"
                    " createProject(input: { name: $name }) { project { id } }"
                    " }"
                ),
                "variables": {"name": project_name},
            },
        )

        assert response.status_code == 200
        body = response.json()
        assert not body.get("errors")
        assert body["data"]["createProject"]["project"]["id"]


def _register_client(
    app: _AppInfo,
    *,
    redirect_uri: str,
) -> _OAuthPublicClient:
    response = _register_response(app, redirect_uri=redirect_uri)
    response.raise_for_status()
    data = response.json()
    client_id = data["client_id"]
    assert isinstance(client_id, str)
    assert re.fullmatch(r"px_dcr_[A-Za-z0-9]{22}", client_id)
    return _OAuthPublicClient(
        client_id=client_id,
        name="Dynamic test client",
        redirect_uri=redirect_uri,
        app=app,
    )


def _register_response(
    app: _AppInfo,
    *,
    redirect_uri: str,
    token_endpoint_auth_method: str = "none",
) -> httpx.Response:
    return _httpx_client(app).post(
        "oauth2/register",
        json={
            "client_name": "Dynamic test client",
            "redirect_uris": [redirect_uri],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": token_endpoint_auth_method,
            "logo_uri": "https://example.com/logo.png",
            "software_id": "integration-test",
        },
    )
