"""Tests for the in-process MCP server mounted at ``/mcp``.

The MCP server is generated from the ``/v1`` REST API and mounted only when
``PHOENIX_ENABLE_MCP_SERVER`` is enabled. Its session-manager lifespan must start
during app startup, and its tool surface must mirror the ``/v1`` routes.
"""

from __future__ import annotations

from contextlib import AsyncExitStack
from typing import TYPE_CHECKING, Any, AsyncIterator

import httpx
import pytest
from asgi_lifespan import LifespanManager
from pydantic import SecretStr

from phoenix.server.app import create_app
from phoenix.server.bearer_auth import INTERNAL_PRINCIPAL_SCOPE_KEY, PhoenixUser
from phoenix.server.mcp_server import MCP_MOUNT_PATH, MountPathNormalizer
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    DbSessionFactory,
    RefreshTokenId,
    UserId,
)
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


async def test_mcp_code_mode_replaces_tool_surface(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With PHOENIX_ENABLE_MCP_CODE_MODE on, clients see only the discovery meta-tools and
    ``execute``; the generated /v1 tools are reachable through the sandbox's
    ``call_tool`` rather than tools/list, and group gating is not installed."""
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: True)
    monkeypatch.setattr("phoenix.server.mcp_server.get_env_mcp_code_mode", lambda: True)
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        await stack.enter_async_context(LifespanManager(app))

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
                follow_redirects=follow_redirects,
            )

        transport = StreamableHttpTransport(
            url=f"http://testserver{MCP_MOUNT_PATH}",
            httpx_client_factory=_factory,
        )
        async with Client(transport) as client:
            tools = {t.name: t for t in await client.list_tools()}
            assert set(tools) == {"search", "get_schema", "tags", "list_tools", "execute"}

            # Discovery tools are reads and say so; execute can invoke mutating
            # tools, so it stays unannotated (treated as possibly destructive).
            for name in ("search", "get_schema", "tags", "list_tools"):
                assert tools[name].annotations is not None, f"{name} is missing annotations"
                assert tools[name].annotations.readOnlyHint is True
            assert tools["execute"].annotations is None

            # Discovery browses the same REST router tags the gated surface uses.
            tags_result = await client.call_tool("tags", {})
            assert "projects" in tags_result.content[0].text

            # The sandbox reaches the generated /v1 tools via call_tool.
            result = await client.call_tool(
                "execute",
                {"code": 'return await call_tool("getProjects", {})'},
            )
            assert "data" in result.content[0].text


async def test_mcp_server_mounts_and_lifespan_starts(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With the flag on, the MCP app is mounted, its lifespan starts, and its
    tools are generated from the /v1 REST routes."""
    monkeypatch.setattr("phoenix.server.app.get_env_enable_mcp_server", lambda: True)
    # This test asserts the group-gated progressive-disclosure surface, which is
    # not the default (code mode is); pin it off so the assertions hold.
    monkeypatch.setattr("phoenix.server.mcp_server.get_env_mcp_code_mode", lambda: False)
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

        # Tools are generated from the /v1 schema. Drive the mounted endpoint
        # in-process over the real protocol via an ASGITransport-backed client.
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
                follow_redirects=follow_redirects,
            )

        transport = StreamableHttpTransport(
            url=f"http://testserver{MCP_MOUNT_PATH}",
            httpx_client_factory=_factory,
        )
        async with Client(transport) as client:
            visible = {t.name for t in await client.list_tools()}
            assert visible, "expected MCP tools generated from the /v1 REST API"

            # Progressive disclosure: only the default group + meta tools show up;
            # gated groups (e.g. spans) are hidden until revealed.
            assert "enable_tool_group" in visible
            assert "list_tool_groups" in visible
            assert not any("span" in name.lower() for name in visible), (
                "gated groups must be hidden by default"
            )

            # Every tool advertises its read/write nature so a client can gate calls.
            tools = {t.name: t for t in await client.list_tools()}
            for name, tool in tools.items():
                assert tool.annotations is not None, f"{name} is missing tool annotations"
                assert tool.annotations.readOnlyHint is not None, (
                    f"{name} does not declare whether it is read-only"
                )
            # The meta tools never touch Phoenix data, so they are read-only.
            assert tools["list_tool_groups"].annotations.readOnlyHint is True
            assert tools["enable_tool_group"].annotations.readOnlyHint is True

            # Revealing a group exposes its tools for this session only.
            await client.call_tool("enable_tool_group", {"group": "spans"})
            after_tools = {t.name: t for t in await client.list_tools()}
            assert set(after_tools) > visible, "enabling a group must reveal additional tools"
            # Read endpoints (GET) are marked read-only; mutating ones are not.
            span_reads = [
                t
                for n, t in after_tools.items()
                if "span" in n.lower() and t.annotations and t.annotations.readOnlyHint
            ]
            assert span_reads, "expected at least one read-only span tool after revealing the group"


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


class TestInternalIdentityDispatch:
    """The MCP→/v1 hop authenticates by principal passing, not token replay."""

    @staticmethod
    def _phoenix_user() -> PhoenixUser:
        user_id = UserId(1)
        claims = AccessTokenClaims(
            subject=user_id,
            token_id=AccessTokenId(1),
            attributes=AccessTokenAttributes(
                user_role="MEMBER",
                refresh_token_id=RefreshTokenId(1),
            ),
        )
        return PhoenixUser(user_id, claims)

    @staticmethod
    async def _receive() -> dict[str, Any]:
        return {}

    @staticmethod
    async def _send(message: Any) -> None:
        return None

    async def test_stamps_the_mcp_callers_principal_onto_the_internal_scope(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from starlette.requests import Request

        from phoenix.server import mcp_server
        from phoenix.server.mcp_server import _InternalIdentityDispatch

        principal = self._phoenix_user()
        mcp_request = Request({"type": "http", "headers": [], "user": principal})
        monkeypatch.setattr(mcp_server, "get_http_request", lambda: mcp_request)

        seen: list[dict[str, object]] = []

        async def inner(scope: Any, receive: Any, send: Any) -> None:
            seen.append(scope)

        original_scope: dict[str, object] = {"type": "http", "headers": []}
        await _InternalIdentityDispatch(inner)(original_scope, self._receive, self._send)

        assert seen[0][INTERNAL_PRINCIPAL_SCOPE_KEY] is principal
        # The caller's scope object is never mutated — the stamp is a copy.
        assert INTERNAL_PRINCIPAL_SCOPE_KEY not in original_scope

    async def test_no_live_mcp_request_means_no_principal_is_stamped(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        from phoenix.server import mcp_server
        from phoenix.server.mcp_server import _InternalIdentityDispatch

        def raise_no_request() -> None:
            raise RuntimeError("No active HTTP request found.")

        monkeypatch.setattr(mcp_server, "get_http_request", raise_no_request)

        seen: list[dict[str, object]] = []

        async def inner(scope: Any, receive: Any, send: Any) -> None:
            seen.append(scope)

        await _InternalIdentityDispatch(inner)(
            {"type": "http", "headers": []}, self._receive, self._send
        )

        assert INTERNAL_PRINCIPAL_SCOPE_KEY not in seen[0]
