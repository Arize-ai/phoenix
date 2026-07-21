"""Tests for /auth.md and /.well-known/oauth-protected-resource endpoints."""

from __future__ import annotations

import contextlib
from typing import AsyncIterator

import httpx
import pytest
from asgi_lifespan import LifespanManager
from fastapi import FastAPI
from pydantic import SecretStr
from starlette.types import ASGIApp

from phoenix.auth import (
    PHOENIX_ACCESS_TOKEN_COOKIE_NAME,
    PHOENIX_REFRESH_TOKEN_COOKIE_NAME,
)
from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import TestBulkInserter, patch_grpc_server


@pytest.fixture
async def app_with_auth(db: DbSessionFactory) -> AsyncIterator[FastAPI]:
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_grpc_server())
        yield create_app(
            db=db,
            authentication_enabled=True,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            secret=SecretStr("test-secret-at-least-32-chars-long!!"),
        )


@pytest.fixture
async def asgi_app_with_auth(app_with_auth: FastAPI) -> AsyncIterator[ASGIApp]:
    async with LifespanManager(app_with_auth) as manager:
        yield manager.app


@pytest.fixture
def client_with_auth(asgi_app_with_auth: ASGIApp) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=asgi_app_with_auth),
        base_url="http://test",
    )


class TestProtectedResourceMetadata:
    async def test_returns_json_with_resource_fields(self, httpx_client: httpx.AsyncClient) -> None:
        resp = await httpx_client.get("/.well-known/oauth-protected-resource")
        assert resp.status_code == 200
        assert "application/json" in resp.headers["content-type"]
        data = resp.json()
        assert data["resource"] == "http://test"
        assert data["resource_name"] == "Arize Phoenix"
        assert data["authorization_servers"] == []
        assert data["bearer_methods_supported"] == ["header"]
        assert "scopes_supported" not in data
        assert data["resource_documentation"] == "http://test/auth.md"


class TestGetAuthMd:
    async def test_no_auth_content(self, httpx_client: httpx.AsyncClient) -> None:
        resp = await httpx_client.get("/auth.md")
        assert resp.status_code == 200
        assert "text/markdown" in resp.headers["content-type"]
        body = resp.text
        assert "# auth.md" in body
        assert "without authentication" in body

    async def test_auth_enabled_content(self, client_with_auth: httpx.AsyncClient) -> None:
        resp = await client_with_auth.get("/auth.md")
        assert resp.status_code == 200
        assert "text/markdown" in resp.headers["content-type"]
        body = resp.text
        assert "# auth.md" in body
        assert "Authorization: Bearer" in body
        assert "http://test/.well-known/oauth-protected-resource" in body
        assert "http://test/auth/login" in body
        assert "https://workos.com/auth-md/docs/apps" in body
        assert PHOENIX_ACCESS_TOKEN_COOKIE_NAME in body
        assert PHOENIX_REFRESH_TOKEN_COOKIE_NAME in body


class TestWWWAuthenticateHeader:
    async def test_401_includes_www_authenticate_when_auth_enabled(
        self, client_with_auth: httpx.AsyncClient
    ) -> None:
        resp = await client_with_auth.get("/v1/projects")
        assert resp.status_code == 401
        www_auth = resp.headers.get("WWW-Authenticate", "")
        assert 'Bearer realm="Arize Phoenix"' in www_auth
        assert 'resource_metadata="http://test/.well-known/oauth-protected-resource"' in www_auth

    async def test_non_401_response_has_no_www_authenticate(
        self, client_with_auth: httpx.AsyncClient
    ) -> None:
        resp = await client_with_auth.get("/healthz")
        assert resp.status_code == 200
        assert "WWW-Authenticate" not in resp.headers

    @pytest.mark.parametrize(
        "env,expected_origin",
        [
            pytest.param(
                {"PHOENIX_ROOT_URL": "https://phoenix.example.com"},
                "https://phoenix.example.com",
                id="root-url",
            ),
            pytest.param(
                {
                    "PHOENIX_ROOT_URL": "https://phoenix.example.com/phoenix",
                    "PHOENIX_HOST_ROOT_PATH": "/phoenix",
                },
                "https://phoenix.example.com/phoenix",
                id="root-url-with-root-path",
            ),
            pytest.param(
                {"PHOENIX_HOST_ROOT_PATH": "/phoenix"},
                "http://test/phoenix",
                id="root-path-only",
            ),
        ],
    )
    async def test_401_challenge_names_the_configured_public_origin(
        self,
        env: dict[str, str],
        expected_origin: str,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """The challenge must agree with the discovery documents and the MCP
        guard, which derive their URLs from the configured public origin —
        request.base_url would leak the internal host behind a proxy that does
        not rewrite forwarded headers."""
        for key, value in env.items():
            monkeypatch.setenv(key, value)
        async with contextlib.AsyncExitStack() as stack:
            await stack.enter_async_context(patch_grpc_server())
            app = create_app(
                db=db,
                authentication_enabled=True,
                serve_ui=False,
                bulk_inserter_factory=TestBulkInserter,
                secret=SecretStr("test-secret-at-least-32-chars-long!!"),
            )
            manager = await stack.enter_async_context(LifespanManager(app))
            client = httpx.AsyncClient(
                transport=httpx.ASGITransport(app=manager.app),
                base_url="http://test",
            )
            resp = await client.get("/v1/projects")
        assert resp.status_code == 401
        www_auth = resp.headers.get("WWW-Authenticate", "")
        prm_url = f"{expected_origin}/.well-known/oauth-protected-resource"
        assert f'resource_metadata="{prm_url}"' in www_auth
