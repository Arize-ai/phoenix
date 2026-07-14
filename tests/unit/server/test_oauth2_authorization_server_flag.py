"""Tests for PHOENIX_ENABLE_OAUTH2_AUTHORIZATION_SERVER.

The flag (default on) lets an operator run an auth-enabled deployment without
serving the built-in OAuth2 authorization server. Disabling it must do three
things at once: every authorization-server endpoint answers 404 (a real 404,
not the SPA fallback — the CLI maps that 404 to "use an API key"), the
protected-resource metadata stops advertising an authorization server, and
auth.md stops describing the OAuth2 flow. API-key and password login stay up.
"""

from __future__ import annotations

import contextlib
from typing import AsyncIterator

import httpx
import pytest
from asgi_lifespan import LifespanManager
from pydantic import SecretStr
from starlette.types import ASGIApp

from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import TestBulkInserter, patch_grpc_server


@contextlib.asynccontextmanager
async def _auth_app(db: DbSessionFactory, *, authorization_server: bool) -> AsyncIterator[ASGIApp]:
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=True,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            secret=SecretStr("test-secret-at-least-32-chars-long!!"),
        )
        app.state.oauth2_authorization_server_enabled = authorization_server
        manager = await stack.enter_async_context(LifespanManager(app))
        yield manager.app


def _client(app: ASGIApp) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    )


class TestAuthorizationServerDisabled:
    @pytest.mark.parametrize(
        "method,path",
        [
            ("GET", "/.well-known/oauth-authorization-server"),
            ("GET", "/.well-known/openid-configuration"),
            ("GET", "/oauth2/authorize"),
            ("POST", "/oauth2/authorize/decision"),
            ("POST", "/oauth2/token"),
            ("POST", "/oauth2/revoke"),
            ("POST", "/oauth2/register"),
        ],
    )
    async def test_endpoints_answer_404(
        self,
        method: str,
        path: str,
        db: DbSessionFactory,
    ) -> None:
        async with _auth_app(db, authorization_server=False) as app:
            resp = await _client(app).request(method, path)
        assert resp.status_code == 404

    async def test_protected_resource_metadata_advertises_no_authorization_server(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with _auth_app(db, authorization_server=False) as app:
            resp = await _client(app).get("/.well-known/oauth-protected-resource")
        assert resp.status_code == 200
        assert resp.json()["authorization_servers"] == []

    async def test_auth_md_omits_the_oauth2_flow_but_keeps_other_credentials(
        self,
        db: DbSessionFactory,
    ) -> None:
        async with _auth_app(db, authorization_server=False) as app:
            resp = await _client(app).get("/auth.md")
        assert resp.status_code == 200
        body = resp.text
        # The document may say that OAuth2 login is disabled, but it must not
        # point at any authorization-server endpoint.
        assert "/oauth2/" not in body
        assert "oauth-authorization-server" not in body
        assert "API key" in body
        assert "/auth/login" in body


async def test_env_var_disables_the_flag(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PHOENIX_ENABLE_OAUTH2_AUTHORIZATION_SERVER", "false")
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=True,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            secret=SecretStr("test-secret-at-least-32-chars-long!!"),
        )
        assert app.state.oauth2_authorization_server_enabled is False


class TestAuthorizationServerEnabledByDefault:
    async def test_flag_defaults_on_and_endpoints_answer(
        self,
        db: DbSessionFactory,
    ) -> None:
        # No override: create_app reads the (unset) env var, which defaults to on.
        async with contextlib.AsyncExitStack() as stack:
            await stack.enter_async_context(patch_grpc_server())
            app = create_app(
                db=db,
                authentication_enabled=True,
                serve_ui=False,
                bulk_inserter_factory=TestBulkInserter,
                secret=SecretStr("test-secret-at-least-32-chars-long!!"),
            )
            assert app.state.oauth2_authorization_server_enabled is True
            manager = await stack.enter_async_context(LifespanManager(app))
            client = _client(manager.app)
            discovery = await client.get("/.well-known/oauth-authorization-server")
            oidc = await client.get("/.well-known/openid-configuration")
            prm = await client.get("/.well-known/oauth-protected-resource")
        assert discovery.status_code == 200
        assert discovery.json()["issuer"] == "http://test"
        assert prm.json()["authorization_servers"] == ["http://test"]
        # The OIDC discovery location is an alias: under a root path it is the
        # only metadata URL in the MCP client discovery order that reaches
        # Phoenix without reverse-proxy configuration.
        assert oidc.status_code == 200
        assert oidc.json() == discovery.json()
