"""Tests for the in-process MCP server mounted at ``/mcp``.

The MCP server advertises no tools and is mounted only when
``PHOENIX_ENABLE_MCP_SERVER`` is enabled. Its session-manager lifespan must
start during app startup, and the mounted endpoint must speak the MCP protocol.
"""

from __future__ import annotations

from contextlib import AsyncExitStack
from typing import TYPE_CHECKING, AsyncIterator

import httpx
import pytest
from asgi_lifespan import LifespanManager
from pydantic import SecretStr

from phoenix.server.app import create_app
from phoenix.server.mcp_server import MCP_MOUNT_PATH, MountPathNormalizer
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import (
    TestBulkInserter,
    patch_batched_caller,
    patch_grpc_server,
)

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send


async def test_mcp_server_not_mounted_by_default(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Without the env flag, no MCP app is built or mounted."""
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: False)
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        assert app.state.mcp_http_app is None
        assert not any(getattr(r, "path", None) == MCP_MOUNT_PATH for r in app.routes)


async def test_mcp_server_mounts_and_lifespan_starts(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With the flag on, the MCP app is mounted, its lifespan starts, and the
    endpoint speaks the MCP protocol (initialize succeeds; the tool list is
    empty by design)."""
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: True)
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        assert app.state.mcp_http_app is not None
        assert any(getattr(r, "path", None) == MCP_MOUNT_PATH for r in app.routes)

        # Startup must enter the MCP session-manager lifespan without error.
        await stack.enter_async_context(LifespanManager(app))

        # Drive the mounted endpoint in-process over the real protocol via an
        # ASGITransport-backed client.
        import httpx
        from fastmcp import Client
        from fastmcp.client.transports import StreamableHttpTransport

        def _factory(
            headers: dict[str, str] | None = None,
            timeout: httpx.Timeout | None = None,
            auth: httpx.Auth | None = None,
            # fastmcp passes this beyond the McpHttpClientFactory protocol.
            follow_redirects: bool = True,
        ) -> httpx.AsyncClient:
            return httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://testserver",
                headers=headers,
                auth=auth,
                follow_redirects=follow_redirects,
            )

        transport = StreamableHttpTransport(
            url=f"http://testserver{MCP_MOUNT_PATH}",
            httpx_client_factory=_factory,
        )
        async with Client(transport) as client:
            assert await client.list_tools() == []


class TestMountPathNormalizer:
    """The bare mount path must be rewritten to the mount root, including when
    the deployment runs under a root path (PHOENIX_HOST_ROOT_PATH): the scope
    path is then ``/<root>/mcp``, and comparing against the literal ``/mcp``
    would let the request fall through to the SPA catch-all (405 for POST)."""

    @staticmethod
    async def _receive() -> Message:
        return {"type": "http.request"}

    @staticmethod
    async def _send(message: Message) -> None:
        return None

    @pytest.mark.parametrize("root_path", ["", "/phoenix"], ids=["no-root-path", "root-path"])
    async def test_bare_mount_path_is_rewritten_to_the_mount_root(self, root_path: str) -> None:
        seen: dict[str, object] = {}

        async def inner(scope: Scope, receive: Receive, send: Send) -> None:
            seen.update(scope)

        bare = f"{root_path}{MCP_MOUNT_PATH}"
        scope: Scope = {
            "type": "http",
            "method": "POST",
            "path": bare,
            "raw_path": bare.encode(),
            "root_path": root_path,
            "headers": [],
        }
        await MountPathNormalizer(inner)(scope, self._receive, self._send)

        assert seen["path"] == f"{bare}/"
        assert seen["raw_path"] == f"{bare}/".encode()
        # The rewrite must copy the scope, not mutate the caller's.
        assert scope["path"] == bare

    @pytest.mark.parametrize(
        "path,root_path",
        [
            ("/mcp/tools", ""),
            ("/phoenix/mcp/tools", "/phoenix"),
            ("/mcpx", ""),
            ("/mcp", "/phoenix"),  # bare /mcp is not the mount when a root path is set
        ],
    )
    async def test_other_paths_pass_through_unchanged(self, path: str, root_path: str) -> None:
        seen: dict[str, object] = {}

        async def inner(scope: Scope, receive: Receive, send: Send) -> None:
            seen.update(scope)

        scope: Scope = {
            "type": "http",
            "method": "POST",
            "path": path,
            "raw_path": path.encode(),
            "root_path": root_path,
            "headers": [],
        }
        await MountPathNormalizer(inner)(scope, self._receive, self._send)

        assert seen["path"] == path


class TestMcpCors:
    """Browser-based MCP clients call /mcp directly, cross-origin, with a bearer
    token — which is not an ambient credential — so the endpoint answers any
    origin and exposes the headers the client must read: the session id and the
    401 challenge that bootstraps its OAuth flow."""

    @pytest.fixture
    async def app_with_auth(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
    ) -> AsyncIterator[ASGIApp]:
        monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: True)
        async with AsyncExitStack() as stack:
            await stack.enter_async_context(patch_batched_caller())
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

    async def test_preflight_allows_any_origin(self, app_with_auth: ASGIApp) -> None:
        client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app_with_auth), base_url="http://test"
        )
        resp = await client.options(
            MCP_MOUNT_PATH,
            headers={
                "Origin": "http://localhost:54321",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization, content-type, mcp-session-id",
            },
        )
        assert resp.status_code == 200
        assert resp.headers["access-control-allow-origin"] == "*"
        assert (
            resp.headers["access-control-allow-headers"]
            == "authorization, content-type, mcp-session-id"
        )
        assert "access-control-allow-credentials" not in resp.headers

    async def test_unauthenticated_challenge_is_readable_cross_origin(
        self, app_with_auth: ASGIApp
    ) -> None:
        client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app_with_auth), base_url="http://test"
        )
        resp = await client.post(
            f"{MCP_MOUNT_PATH}/",
            headers={
                "Origin": "http://localhost:54321",
                "Accept": "application/json, text/event-stream",
            },
            json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
        )
        assert resp.status_code == 401
        assert resp.headers["access-control-allow-origin"] == "*"
        exposed = resp.headers["access-control-expose-headers"]
        assert "WWW-Authenticate" in exposed
        assert "Mcp-Session-Id" in exposed
