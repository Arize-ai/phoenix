"""Tests for /auth.md and /.well-known/oauth-protected-resource endpoints."""

from __future__ import annotations

import contextlib
from typing import AsyncIterator

import httpx
import pytest
from asgi_lifespan import LifespanManager
from fastapi import FastAPI
from starlette.types import ASGIApp

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
            secret=__import__("pydantic").SecretStr("test-secret-at-least-32-chars-long!!"),
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
        data = resp.json()
        assert data["resource"] == "http://test"
        assert data["resource_name"] == "Arize Phoenix"
        assert data["bearer_methods_supported"] == ["header"]
        assert data["scopes_supported"] == []
        assert data["resource_documentation"] == "http://test/auth.md"

    async def test_no_authentication_required_when_auth_disabled(
        self, httpx_client: httpx.AsyncClient
    ) -> None:
        resp = await httpx_client.get("/.well-known/oauth-protected-resource")
        assert resp.status_code == 200
        data = resp.json()
        assert "authentication_required" not in data

    async def test_authentication_required_when_auth_enabled(
        self, client_with_auth: httpx.AsyncClient
    ) -> None:
        resp = await client_with_auth.get("/.well-known/oauth-protected-resource")
        assert resp.status_code == 200
        data = resp.json()
        assert data["authentication_required"] is True

    async def test_content_type_is_json(self, httpx_client: httpx.AsyncClient) -> None:
        resp = await httpx_client.get("/.well-known/oauth-protected-resource")
        assert "application/json" in resp.headers["content-type"]


class TestGetAuthMd:
    async def test_returns_markdown(self, httpx_client: httpx.AsyncClient) -> None:
        resp = await httpx_client.get("/auth.md")
        assert resp.status_code == 200
        assert "text/markdown" in resp.headers["content-type"]

    async def test_no_auth_content(self, httpx_client: httpx.AsyncClient) -> None:
        resp = await httpx_client.get("/auth.md")
        assert resp.status_code == 200
        body = resp.text
        assert "# auth.md" in body
        assert "without authentication" in body

    async def test_auth_enabled_content(self, client_with_auth: httpx.AsyncClient) -> None:
        resp = await client_with_auth.get("/auth.md")
        assert resp.status_code == 200
        body = resp.text
        assert "# auth.md" in body
        assert "Authorization: Bearer" in body
        assert "/.well-known/oauth-protected-resource" in body
        assert "/auth/login" in body

    async def test_base_url_appears_in_content(self, client_with_auth: httpx.AsyncClient) -> None:
        resp = await client_with_auth.get("/auth.md")
        assert resp.status_code == 200
        assert "http://test" in resp.text


class TestWWWAuthenticateHeader:
    async def test_401_includes_www_authenticate_when_auth_enabled(
        self, client_with_auth: httpx.AsyncClient
    ) -> None:
        resp = await client_with_auth.get("/v1/projects")
        assert resp.status_code == 401
        www_auth = resp.headers.get("WWW-Authenticate", "")
        assert 'Bearer realm="Arize Phoenix"' in www_auth
        assert "resource_metadata=" in www_auth
        assert "/.well-known/oauth-protected-resource" in www_auth

    async def test_non_401_response_has_no_www_authenticate(
        self, client_with_auth: httpx.AsyncClient
    ) -> None:
        resp = await client_with_auth.get("/healthz")
        assert resp.status_code == 200
        assert "WWW-Authenticate" not in resp.headers
