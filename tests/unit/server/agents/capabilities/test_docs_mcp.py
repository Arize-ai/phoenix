from __future__ import annotations

from typing import Any

import pytest
from mcp import types as mcp_types
from pydantic_ai.mcp import MCPToolset

from phoenix.server.agents.capabilities import MintlifyDocsMCPServer


def _tool(name: str, description: str) -> mcp_types.Tool:
    return mcp_types.Tool(name=name, description=description, inputSchema={"type": "object"})


class TestPinnedToolList:
    """The docs tools are the only tool definitions in the request Phoenix does
    not author, and tool definitions sit ahead of everything else in the
    prompt. A ``tools/list_changed`` push from the docs server would otherwise
    rewrite the front of the prefix mid-conversation, with no Phoenix deploy
    involved."""

    async def test_first_response_is_reused_when_the_server_changes_its_tools(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        responses = [
            [_tool("search_phoenix", "original")],
            [_tool("search_phoenix", "rewritten upstream")],
        ]
        calls: list[None] = []

        async def fake_list_tools(self: Any) -> list[mcp_types.Tool]:
            calls.append(None)
            return responses[min(len(calls) - 1, len(responses) - 1)]

        monkeypatch.setattr(MCPToolset, "list_tools", fake_list_tools)
        server = MintlifyDocsMCPServer[None]()

        first = await server.list_tools()
        second = await server.list_tools()

        assert first == responses[0]
        assert second == responses[0]
        assert len(calls) == 1

    async def test_a_fresh_server_picks_up_the_current_tools(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Pinning is per process, not permanent: a restart re-reads the list."""
        current = [_tool("search_phoenix", "original")]

        async def fake_list_tools(self: Any) -> list[mcp_types.Tool]:
            return current

        monkeypatch.setattr(MCPToolset, "list_tools", fake_list_tools)
        assert await MintlifyDocsMCPServer[None]().list_tools() == current

        current = [_tool("search_phoenix", "rewritten upstream")]
        assert await MintlifyDocsMCPServer[None]().list_tools() == current
