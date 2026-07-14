"""CORS behavior of the anonymous OAuth surfaces.

Browser-based OAuth public clients (e.g. MCP hosts) fetch discovery documents,
register, and exchange codes from the page itself, from origins that cannot be
known in advance. Those endpoints must answer any origin with non-credentialed
wildcard CORS, while cookie-honoring endpoints stay origin-restricted.
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

_ORIGIN = "http://localhost:54321"  # arbitrary: the point is it is not allowlisted


@pytest.fixture
async def app_with_auth(db: DbSessionFactory) -> AsyncIterator[ASGIApp]:
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
        yield manager.app


@pytest.fixture
def client(app_with_auth: ASGIApp) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app_with_auth),
        base_url="http://test",
    )


class TestAnonymousSurfacesAnswerAnyOrigin:
    @pytest.mark.parametrize(
        "path",
        [
            "/.well-known/oauth-authorization-server",
            "/.well-known/openid-configuration",
            "/.well-known/oauth-protected-resource",
        ],
    )
    async def test_discovery_documents_allow_any_origin(
        self, path: str, client: httpx.AsyncClient
    ) -> None:
        resp = await client.get(path, headers={"Origin": _ORIGIN})
        assert resp.status_code == 200
        assert resp.headers["access-control-allow-origin"] == "*"
        assert "access-control-allow-credentials" not in resp.headers

    @pytest.mark.parametrize("path", ["/oauth2/token", "/oauth2/register", "/oauth2/revoke"])
    async def test_preflight_allows_post_with_requested_headers(
        self, path: str, client: httpx.AsyncClient
    ) -> None:
        resp = await client.options(
            path,
            headers={
                "Origin": _ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type, authorization",
            },
        )
        assert resp.status_code == 200
        assert resp.headers["access-control-allow-origin"] == "*"
        assert "POST" in resp.headers["access-control-allow-methods"]
        # Echoed, because the Fetch spec exempts Authorization from a `*` grant.
        assert resp.headers["access-control-allow-headers"] == "content-type, authorization"
        assert "access-control-allow-credentials" not in resp.headers

    async def test_error_responses_carry_the_header_too(self, client: httpx.AsyncClient) -> None:
        """The browser can only read the OAuth error JSON if the failure
        response is itself CORS-approved."""
        resp = await client.post(
            "/oauth2/token",
            headers={"Origin": _ORIGIN},
            data={"grant_type": "authorization_code"},
        )
        assert resp.status_code == 400
        assert resp.headers["access-control-allow-origin"] == "*"

    async def test_no_origin_means_no_cors_headers(self, client: httpx.AsyncClient) -> None:
        resp = await client.get("/.well-known/oauth-authorization-server")
        assert resp.status_code == 200
        assert "access-control-allow-origin" not in resp.headers


class TestCookieHonoringSurfacesStayOriginRestricted:
    @pytest.mark.parametrize("path", ["/oauth2/authorize", "/oauth2/authorize/decision"])
    async def test_no_wildcard_on_cookie_endpoints(
        self, path: str, client: httpx.AsyncClient
    ) -> None:
        resp = await client.request(
            "GET" if path == "/oauth2/authorize" else "POST",
            path,
            headers={"Origin": _ORIGIN},
        )
        assert "access-control-allow-origin" not in resp.headers
