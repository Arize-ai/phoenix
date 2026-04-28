from types import SimpleNamespace

import pytest

from phoenix.server.agents import mcp


class TestMintlifyDocsClient:
    async def test_get_tool_definitions_caches_results(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        mcp._KNOWN_BACKEND_TOOLS.clear()
        client = mcp.MintlifyDocsClient()
        call_count = 0

        class DummySession:
            async def list_tools(self) -> SimpleNamespace:
                nonlocal call_count
                call_count += 1
                return SimpleNamespace(
                    tools=[
                        SimpleNamespace(
                            name="search_docs",
                            description="Search docs",
                            inputSchema={"type": "object"},
                        )
                    ]
                )

        async def _ensure_session_locked(_: mcp.MintlifyDocsClient) -> DummySession:
            return DummySession()

        monkeypatch.setattr(mcp.MintlifyDocsClient, "_ensure_session_locked", _ensure_session_locked)

        first = await client.get_tool_definitions()
        second = await client.get_tool_definitions()

        assert call_count == 1
        assert [tool.name for tool in first] == ["search_docs"]
        assert second == first
        assert mcp.is_backend_tool("search_docs")


class TestGetMcpClient:
    def test_returns_none_when_external_resources_disabled(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        request = _make_request()
        monkeypatch.setattr(mcp, "get_env_allow_external_resources", lambda: False)

        client = mcp.get_mcp_client(request)

        assert client is None
        assert request.app.router.on_shutdown == []

    async def test_creates_and_reuses_shared_client(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        request = _make_request()
        monkeypatch.setattr(mcp, "get_env_allow_external_resources", lambda: True)

        class FakeClient:
            def __init__(self) -> None:
                self.close_calls = 0

            async def close(self) -> None:
                self.close_calls += 1

        monkeypatch.setattr(mcp, "MintlifyDocsClient", FakeClient)

        client = mcp.get_mcp_client(request)
        same_client = mcp.get_mcp_client(request)

        assert isinstance(client, FakeClient)
        assert same_client is client
        assert len(request.app.router.on_shutdown) == 1

        await request.app.router.on_shutdown[0]()
        assert client.close_calls == 1

    def test_gracefully_returns_none_when_client_init_fails(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        request = _make_request()
        monkeypatch.setattr(mcp, "get_env_allow_external_resources", lambda: True)

        class BrokenClient:
            def __init__(self) -> None:
                raise RuntimeError("boom")

        monkeypatch.setattr(mcp, "MintlifyDocsClient", BrokenClient)

        client = mcp.get_mcp_client(request)

        assert client is None
        assert hasattr(request.app.state, "_mcp_client")
        assert request.app.state._mcp_client is None


def _make_request() -> SimpleNamespace:
    return SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(),
            router=SimpleNamespace(on_shutdown=[]),
        )
    )
