"""Tests for the agent's in-process MCP toolset.

The in-memory path carries no HTTP request, so the toolset establishes the
caller's identity and the session's tool visibility itself.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastmcp import FastMCP

from phoenix.server.agents.capabilities import PhoenixMCPToolset
from phoenix.server.bearer_auth import (
    INTERNAL_PRINCIPAL_SCOPE_KEY,
    PhoenixUser,
    bind_principal,
)
from phoenix.server.mcp_server import _v1_group_sizes, build_phoenix_mcp_server
from phoenix.server.monty_runtime import MontyRuntime
from phoenix.server.types import (
    AccessTokenAttributes,
    AccessTokenClaims,
    AccessTokenId,
    DbSessionFactory,
    RefreshTokenId,
    UserId,
)


def _unused_db() -> DbSessionFactory:
    """A session factory for tests that must never reach the database.

    These tests exercise the derived REST surface, which dispatches through the
    stand-in app rather than a session. The analytics SQL tools registered
    alongside it are covered by their own suite.
    """

    def _never(*_: object, **__: object) -> Any:
        raise AssertionError("this test must not open a database session")

    return DbSessionFactory(db=_never, dialect="sqlite")


def _phoenix_user(user_id: int = 1) -> PhoenixUser:
    uid = UserId(user_id)
    return PhoenixUser(
        uid,
        AccessTokenClaims(
            subject=uid,
            token_id=AccessTokenId(user_id),
            attributes=AccessTokenAttributes(
                user_role="MEMBER",
                refresh_token_id=RefreshTokenId(user_id),
            ),
        ),
    )


def _rest_app(seen: list[Any]) -> FastAPI:
    """A stand-in for Phoenix's REST API that records who each call ran as.

    Routes are tagged ``projects`` because that is the one group progressive
    disclosure leaves visible, so a tool here is reachable without a reveal.
    """
    app = FastAPI()

    @app.get("/v1/whoami", tags=["projects"], summary="Report the calling principal.")
    async def whoami(request: Request) -> dict[str, Any]:
        principal = request.scope.get(INTERNAL_PRINCIPAL_SCOPE_KEY)
        seen.append(principal)
        return {"user_id": str(principal.identity) if principal is not None else None}

    @app.post("/v1/mutate", tags=["projects"], summary="Change something.")
    async def mutate() -> dict[str, bool]:
        return {"ok": True}

    return app


class TestPrincipalPropagation:
    """The whole feature: a call made in-process runs as a stated principal."""

    async def test_bound_principal_reaches_the_v1_dispatch(self) -> None:
        seen: list[Any] = []
        mcp, _ = build_phoenix_mcp_server(
            _rest_app(seen), code_mode=False, read_only=True, db=_unused_db()
        )
        principal = _phoenix_user()

        async with PhoenixMCPToolset[None](mcp, principal=principal) as toolset:
            result = await toolset.direct_call_tool("whoami_v1_whoami_get", {})

        assert seen == [principal]
        assert result["user_id"] == str(principal.identity)

    async def test_without_a_principal_the_dispatch_carries_none(self) -> None:
        """Matches the HTTP path with authentication disabled; what an
        unauthenticated call permits is the REST layer's decision."""
        seen: list[Any] = []
        mcp, _ = build_phoenix_mcp_server(
            _rest_app(seen), code_mode=False, read_only=True, db=_unused_db()
        )

        async with PhoenixMCPToolset[None](mcp, principal=None) as toolset:
            await toolset.direct_call_tool("whoami_v1_whoami_get", {})

        assert seen == [None]

    async def test_concurrent_toolsets_do_not_share_a_principal(self) -> None:
        """Two agent runs against one server instance stay distinct callers."""
        seen: list[Any] = []
        mcp, _ = build_phoenix_mcp_server(
            _rest_app(seen), code_mode=False, read_only=True, db=_unused_db()
        )
        first, second = _phoenix_user(1), _phoenix_user(2)

        async with PhoenixMCPToolset[None](mcp, principal=first) as one:
            async with PhoenixMCPToolset[None](mcp, principal=second) as two:
                await two.direct_call_tool("whoami_v1_whoami_get", {})
                await one.direct_call_tool("whoami_v1_whoami_get", {})

        assert seen == [second, first]

    async def test_binding_is_released_when_the_session_closes(self) -> None:
        from phoenix.server.bearer_auth import get_bound_principal

        seen: list[Any] = []
        mcp, _ = build_phoenix_mcp_server(
            _rest_app(seen), code_mode=False, read_only=True, db=_unused_db()
        )

        async with PhoenixMCPToolset[None](mcp, principal=_phoenix_user()):
            pass
        assert get_bound_principal() is None


class TestInMemoryTransportContract:
    """The transport behavior that fixes where the binding can live.

    Context variables are captured at task creation, and the in-memory transport
    serves calls from a task spawned at connect time. This is a property of the
    pinned FastMCP range, not of Phoenix code.
    """

    @staticmethod
    def _probe_server() -> FastMCP:
        mcp: FastMCP = FastMCP("probe")

        @mcp.tool
        def whoami() -> str:
            from phoenix.server.bearer_auth import get_bound_principal

            principal = get_bound_principal()
            return "<none>" if principal is None else str(principal.identity)

        return mcp

    async def test_binding_before_the_session_opens_is_visible_to_tools(self) -> None:
        from fastmcp.client import Client

        principal = _phoenix_user()
        with bind_principal(principal):
            async with Client(self._probe_server()) as client:
                result = await client.call_tool("whoami", {})

        assert result.content[0].text == str(principal.identity)

    async def test_binding_after_the_session_opens_is_not_visible_to_tools(self) -> None:
        """A binding entered after connect reaches nothing, and raises nothing.
        Should this stop holding, per-call binding becomes viable."""
        from fastmcp.client import Client

        async with Client(self._probe_server()) as client:
            with bind_principal(_phoenix_user()):
                result = await client.call_tool("whoami", {})

        assert result.content[0].text == "<none>"


class TestReadOnlySurface:
    """Mutations belong to the agent's editing tools, which route approval
    through the user; this surface cannot express one."""

    async def test_only_get_routes_become_tools(self) -> None:
        mcp, _ = build_phoenix_mcp_server(
            _rest_app([]), code_mode=False, read_only=True, db=_unused_db()
        )

        async with PhoenixMCPToolset[None](mcp) as toolset:
            names = {tool.name for tool in await toolset.list_tools()}

        assert any("whoami" in name for name in names)
        assert not any("mutate" in name for name in names)

    async def test_mutating_routes_are_tools_when_not_read_only(self) -> None:
        mcp, _ = build_phoenix_mcp_server(
            _rest_app([]), code_mode=False, read_only=False, db=_unused_db()
        )

        async with PhoenixMCPToolset[None](mcp) as toolset:
            names = {tool.name for tool in await toolset.list_tools()}

        assert any("mutate" in name for name in names)

    def test_group_sizes_count_only_the_operations_that_became_tools(self) -> None:
        spec = _rest_app([]).openapi()

        assert _v1_group_sizes(spec) == {"projects": 2}
        assert _v1_group_sizes(spec, read_only=True) == {"projects": 1}


class TestCodeMode:
    """The agent's configured surface: a sandboxed ``execute`` over the catalog."""

    @staticmethod
    def _code_mode_server(seen: list[Any]) -> tuple[Any, MontyRuntime]:
        runtime = MontyRuntime()
        mcp, _ = build_phoenix_mcp_server(
            _rest_app(seen),
            monty_runtime=runtime,
            code_mode=True,
            monty_consumer="agent",
            read_only=True,
            db=_unused_db(),
        )
        return mcp, runtime

    async def test_surface_is_execute_plus_discovery(self) -> None:
        mcp, runtime = self._code_mode_server([])
        try:
            async with PhoenixMCPToolset[None](mcp) as toolset:
                names = {tool.name for tool in await toolset.list_tools()}
        finally:
            await runtime.aclose()

        assert names == {"execute", "search", "get_schema", "tags", "list_tools"}

    async def test_principal_reaches_v1_through_guest_code(self) -> None:
        """Guest code calls back into the host to reach a tool, so the binding has
        to survive a hop the direct path never takes."""
        seen: list[Any] = []
        mcp, runtime = self._code_mode_server(seen)
        principal = _phoenix_user()
        try:
            async with PhoenixMCPToolset[None](mcp, principal=principal) as toolset:
                result = await toolset.direct_call_tool(
                    "execute", {"code": "return await call_tool('whoami_v1_whoami_get', {})"}
                )
        finally:
            await runtime.aclose()

        assert seen == [principal]
        assert result["user_id"] == str(principal.identity)

    async def test_call_tool_is_a_coroutine(self) -> None:
        """Unawaited, it returns a coroutine rather than raising, so the mistake
        surfaces as a nonsense result. The instructions say to await it."""
        mcp, runtime = self._code_mode_server([])
        try:
            async with PhoenixMCPToolset[None](mcp) as toolset:
                result = await toolset.direct_call_tool(
                    "execute", {"code": "return call_tool('whoami_v1_whoami_get', {})"}
                )
        finally:
            await runtime.aclose()

        assert "coroutine" in str(result)

    async def test_the_catalog_excludes_mutating_endpoints(self) -> None:
        """Read-only is enforced by the route maps, so no mutating tool exists for
        ``call_tool`` to name."""
        mcp, runtime = self._code_mode_server([])
        try:
            async with PhoenixMCPToolset[None](mcp) as toolset:
                catalog = str(await toolset.direct_call_tool("list_tools", {}))
        finally:
            await runtime.aclose()

        assert "whoami" in catalog
        assert "mutate" not in catalog


class TestToolGroupVisibility:
    """Reveals are session state, and a session is one agent run."""

    @staticmethod
    def _two_group_app() -> FastAPI:
        app = FastAPI()

        @app.get("/v1/projects", tags=["projects"], summary="List projects.")
        async def projects() -> list[str]:
            return []

        @app.get("/v1/spans", tags=["spans"], summary="List spans.")
        async def spans() -> list[str]:
            return []

        return app

    async def test_gated_groups_are_hidden_until_revealed(self) -> None:
        mcp, _ = build_phoenix_mcp_server(
            self._two_group_app(), code_mode=False, read_only=True, db=_unused_db()
        )

        async with PhoenixMCPToolset[None](mcp) as toolset:
            before = {tool.name for tool in await toolset.list_tools()}
            await toolset.direct_call_tool("enable_tool_group", {"group": "spans"})
            after = {tool.name for tool in await toolset.list_tools()}

        assert not any("spans" in name for name in before)
        assert any("spans" in name for name in after)

    async def test_a_reveal_does_not_leak_into_another_session(self) -> None:
        """A reveal is confined to its session, so it widens no one else's
        surface and does not carry into the next turn."""
        mcp, _ = build_phoenix_mcp_server(
            self._two_group_app(), code_mode=False, read_only=True, db=_unused_db()
        )

        async with PhoenixMCPToolset[None](mcp) as first:
            await first.direct_call_tool("enable_tool_group", {"group": "spans"})

        async with PhoenixMCPToolset[None](mcp) as second:
            names = {tool.name for tool in await second.list_tools()}

        assert not any("spans" in name for name in names)


def test_the_instructions_name_the_tools_the_surface_actually_exposes() -> None:
    """Instructions that name a tool the surface lacks cost a failed call to
    discover, so they are pinned against the code-mode tool names."""
    from phoenix.server.agents.prompts import AgentPrompts

    rendered = AgentPrompts().phoenix_mcp_tools.render()

    for tool in ("execute", "call_tool", "search", "get_schema", "tags"):
        assert tool in rendered
    assert "enable_tool_group" not in rendered
    assert "read-only" in rendered.lower()
