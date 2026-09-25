"""Passing MCP protocol and progressive-disclosure security controls."""

from __future__ import annotations

import pytest
from fastmcp import Client

from tests.integration._helpers import _MEMBER, _AppInfo, _GetUser
from tests.integration.auth.test_mcp import _mcp_token_for, _mcp_transport

pytestmark = [pytest.mark.disclosure]


async def test_hidden_group_tool_cannot_be_called_until_its_group_is_enabled(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """Tool visibility is a server-side session capability, not a UI convention."""
    token = _mcp_token_for(_app, _get_user, _MEMBER)
    async with Client(_mcp_transport(_app, token)) as client:
        initially_visible = {tool.name for tool in await client.list_tools()}
        hidden_result = await client.call_tool("getUsers", {}, raise_on_error=False)
        await client.call_tool("enable_tool_group", {"group": "users"})
        revealed = {tool.name for tool in await client.list_tools()}
    del token

    assert "getUsers" not in initially_visible
    assert hidden_result.is_error
    assert "getUsers" in revealed


async def test_tool_group_enablement_does_not_leak_to_another_mcp_session(
    _app: _AppInfo,
    _get_user: _GetUser,
) -> None:
    """A group enabled in one authenticated session stays hidden in a second session."""
    first_token = _mcp_token_for(_app, _get_user, _MEMBER)
    second_token = _mcp_token_for(_app, _get_user, _MEMBER)
    async with Client(_mcp_transport(_app, first_token)) as first_client:
        await first_client.call_tool("enable_tool_group", {"group": "users"})
        first_tools = {tool.name for tool in await first_client.list_tools()}
        async with Client(_mcp_transport(_app, second_token)) as second_client:
            second_tools = {tool.name for tool in await second_client.list_tools()}
    del first_token, second_token

    assert "getUsers" in first_tools
    assert "getUsers" not in second_tools
