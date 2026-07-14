"""Integration tests for the MCP mount's OAuth2 wiring.

An MCP host discovers and authorizes against Phoenix in three steps, each covered
here against a real server process: (1) an unauthenticated request to /mcp gets an
HTTP 401 whose WWW-Authenticate header names the protected-resource metadata — the
signal MCP clients bootstrap their OAuth flow from; (2) the path-inserted RFC 9728
document describes /mcp as the resource and Phoenix as its authorization server;
(3) the authorization-code flow accepts the MCP endpoint as an RFC 8707 resource
indicator, and the minted token authorizes a real MCP session end to end. The
server advertises no tools yet, so the authenticated session is verified through
``initialize`` and an empty ``tools/list``.

These tests run against the package-scoped ``_app`` (which enables the MCP mount —
see the package ``_env`` fixture), so they execute on the same database backend as
the rest of the suite (SQLite or PostgreSQL per ``CI_TEST_DB_BACKEND``).
"""

from __future__ import annotations

from secrets import token_hex
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

from tests.integration._helpers import (
    _MEMBER,
    _AppInfo,
    _get_ssl_context,
    _GetUser,
    _httpx_client,
)

from .conftest import _OAuthPublicClient


def _base_url(app: _AppInfo) -> str:
    return app.base_url.rstrip("/")


def _register_public_client(app: _AppInfo, *, resource: str | None = None) -> _OAuthPublicClient:
    name = f"MCP test client {token_hex(4)}"
    redirect_uri = "http://127.0.0.1:8765/callback"
    response = _httpx_client(app).post(
        "oauth2/register",
        json={"client_name": name, "redirect_uris": [redirect_uri]},
    )
    response.raise_for_status()
    return _OAuthPublicClient(
        client_id=response.json()["client_id"],
        name=name,
        redirect_uri=redirect_uri,
        app=app,
        resource=resource,
    )


class TestMcpAuthChallenge:
    @pytest.mark.parametrize("token", [None, "not-a-valid-token"], ids=["missing", "invalid"])
    def test_unauthenticated_initialize_receives_oauth_challenge(
        self,
        token: str | None,
        _app: _AppInfo,
    ) -> None:
        headers = {"Accept": "application/json, text/event-stream"}
        if token is not None:
            headers["Authorization"] = f"Bearer {token}"

        response = _httpx_client(_app).post(
            "mcp",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "test", "version": "0"},
                },
            },
            headers=headers,
        )

        assert response.status_code == 401
        challenge = response.headers["www-authenticate"]
        assert challenge.startswith("Bearer ")
        prm_url = f"{_base_url(_app)}/.well-known/oauth-protected-resource/mcp"
        assert f'resource_metadata="{prm_url}"' in challenge


class TestMcpProtectedResourceMetadata:
    def test_path_inserted_document_describes_the_mcp_resource(
        self,
        _app: _AppInfo,
    ) -> None:
        response = _httpx_client(_app).get(".well-known/oauth-protected-resource/mcp")

        response.raise_for_status()
        metadata = response.json()
        assert metadata["resource"] == f"{_base_url(_app)}/mcp"
        assert metadata["authorization_servers"] == [_base_url(_app)]

    def test_absent_when_mcp_server_is_disabled(self, _app_dcr_disabled: _AppInfo) -> None:
        # _app_dcr_disabled sets PHOENIX_ENABLE_MCP_SERVER=false explicitly (its DCR
        # dial is otherwise unrelated).
        response = _httpx_client(_app_dcr_disabled).get(".well-known/oauth-protected-resource/mcp")

        assert response.status_code == 404


class TestMcpResourceIndicator:
    async def test_flow_with_mcp_resource_mints_token_that_authorizes_a_session(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        mcp_url = f"{_base_url(_app)}/mcp"
        oauth_client = _register_public_client(_app, resource=mcp_url)
        user = _get_user(_app, _MEMBER).log_in(_app)

        # `resource` is sent on both the authorize and token requests, the way a
        # spec-following MCP client would.
        token_response = oauth_client.complete_flow(user)

        transport = StreamableHttpTransport(
            mcp_url,
            headers={"Authorization": f"Bearer {token_response['access_token']}"},
            # The package app may serve TLS with a test-only certificate; trust it
            # the same way _httpx_client does.
            verify=_get_ssl_context(_app.env) or False,
        )
        async with Client(transport) as mcp_client:
            # Entering the client runs `initialize`, which the unauthenticated
            # tests above show is rejected without a token. The server advertises
            # no tools yet, so the authenticated session proves itself through an
            # empty tools/list rather than a tool call.
            assert await mcp_client.list_tools() == []

    def test_code_authorized_for_mcp_cannot_mint_tokens_for_another_resource(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """RFC 8707: the audience is fixed at authorization. Exchanging a code that
        was authorized for /mcp while naming a different (individually valid)
        resource must fail rather than mint tokens labeled for the other resource."""
        mcp_url = f"{_base_url(_app)}/mcp"
        oauth_client = _register_public_client(_app, resource=mcp_url)
        user = _get_user(_app, _MEMBER).log_in(_app)
        params = oauth_client.authorize(user)
        redirect_to = oauth_client.decide(user, params)
        code = parse_qs(urlparse(redirect_to).query)["code"][0]

        response = _httpx_client(_app).post(
            "oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": oauth_client.client_id,
                "redirect_uri": oauth_client.redirect_uri,
                "code_verifier": oauth_client.code_verifier,
                # The deployment origin is a valid resource on its own, but it is
                # not the resource this code was authorized for.
                "resource": _base_url(_app),
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_target"

    def test_code_authorized_without_resource_cannot_be_exchanged_for_mcp(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """The audience is fixed at authorization: a code authorized with no
        resource indicator must not be widened at exchange into an MCP-labeled
        grant by naming /mcp only on the token request."""
        oauth_client = _register_public_client(_app)
        user = _get_user(_app, _MEMBER).log_in(_app)
        params = oauth_client.authorize(user)
        redirect_to = oauth_client.decide(user, params)
        code = parse_qs(urlparse(redirect_to).query)["code"][0]

        response = _httpx_client(_app).post(
            "oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": oauth_client.client_id,
                "redirect_uri": oauth_client.redirect_uri,
                "code_verifier": oauth_client.code_verifier,
                # A valid resource on its own, but the authorization named none.
                "resource": f"{_base_url(_app)}/mcp",
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_target"

    def test_refresh_cannot_retarget_the_grant(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """The grant's audience is immutable: refreshing with a different resource
        is rejected, and the rejection must not consume the refresh token."""
        mcp_url = f"{_base_url(_app)}/mcp"
        oauth_client = _register_public_client(_app, resource=mcp_url)
        user = _get_user(_app, _MEMBER).log_in(_app)
        token_response = oauth_client.complete_flow(user)

        def _refresh(resource: str | None) -> Any:
            data = {
                "grant_type": "refresh_token",
                "refresh_token": token_response["refresh_token"],
                "client_id": oauth_client.client_id,
            }
            if resource is not None:
                data["resource"] = resource
            return _httpx_client(_app).post("oauth2/token", data=data)

        mismatched = _refresh(_base_url(_app))
        assert mismatched.status_code == 400
        assert mismatched.json()["error"] == "invalid_target"

        # The failed attempt did not consume the token; a matching refresh works.
        matched = _refresh(mcp_url)
        assert matched.status_code == 200
        assert matched.json()["access_token"]

    def test_refresh_cannot_widen_a_null_audience_grant(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        """A grant authorized with no resource indicator admits none at refresh:
        naming /mcp there must fail rather than return a token for a grant that
        was never authorized for the MCP resource."""
        oauth_client = _register_public_client(_app)
        user = _get_user(_app, _MEMBER).log_in(_app)
        token_response = oauth_client.complete_flow(user)

        def _refresh(resource: str | None) -> Any:
            data = {
                "grant_type": "refresh_token",
                "refresh_token": token_response["refresh_token"],
                "client_id": oauth_client.client_id,
            }
            if resource is not None:
                data["resource"] = resource
            return _httpx_client(_app).post("oauth2/token", data=data)

        widened = _refresh(f"{_base_url(_app)}/mcp")
        assert widened.status_code == 400
        assert widened.json()["error"] == "invalid_target"

        # The failed attempt did not consume the token; a plain refresh works.
        plain = _refresh(None)
        assert plain.status_code == 200
        assert plain.json()["access_token"]

    def test_foreign_resource_is_rejected_at_authorization(
        self,
        _app: _AppInfo,
        _get_user: _GetUser,
    ) -> None:
        oauth_client = _register_public_client(_app, resource=f"{_base_url(_app)}/graphql")
        user = _get_user(_app, _MEMBER).log_in(_app)

        response = _httpx_client(_app, user).get(
            "oauth2/authorize",
            params=oauth_client.authorization_params(),
            follow_redirects=False,
        )

        # A request-shape error is delivered to the redirect URI per RFC 6749
        # §4.1.2.1 so the client can correct and retry.
        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(oauth_client.redirect_uri)
        assert parse_qs(urlparse(location).query)["error"] == ["invalid_target"]
