from __future__ import annotations

from typing import Any
from unittest.mock import Mock

import httpx
import pytest
from pydantic import SecretStr
from pydantic_ai.exceptions import ModelRetry
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.toolsets import ApprovalRequiredToolset, FilteredToolset

from phoenix.server.agents.capabilities.github_mcp import (
    GITHUB_READ_TOOLS,
    GITHUB_TOOL_ALLOWLIST,
    GITHUB_WRITE_TOOLS,
    GitHubMCPToolset,
    _call_tool_with_sanitized_errors,
    build_github_mcp_capability,
)
from phoenix.server.agents.github import GitHubMCPConfig
from phoenix.server.agents.prompts import AgentPrompts

_TOKEN = "ghp_secret_token_value"  # noqa: S105


def _config() -> GitHubMCPConfig:
    return GitHubMCPConfig(
        token=SecretStr(_TOKEN),
        # A closed port: connect attempts fail fast without leaving the host.
        base_url="http://127.0.0.1:9/mcp/",
    )


def _tool_def(name: str) -> ToolDefinition:
    return ToolDefinition(name=name)


def _filter_allows(toolset: FilteredToolset[Any], name: str) -> bool:
    allowed = toolset.filter_func(Mock(), _tool_def(name))
    assert isinstance(allowed, bool)
    return allowed


class TestToolsetComposition:
    def test_writes_with_approval_gates_only_write_tools(self) -> None:
        capability = build_github_mcp_capability(
            _config(),
            instructions="instructions",
            allow_writes=True,
            require_write_approval=True,
        )
        toolset = capability.get_toolset()
        assert isinstance(toolset, ApprovalRequiredToolset)
        for name in GITHUB_WRITE_TOOLS:
            assert toolset.approval_required_func(Mock(), _tool_def(name), {})
        for name in GITHUB_READ_TOOLS:
            assert not toolset.approval_required_func(Mock(), _tool_def(name), {})
        filtered = toolset.wrapped
        assert isinstance(filtered, FilteredToolset)
        for name in GITHUB_TOOL_ALLOWLIST:
            assert _filter_allows(filtered, name)
        assert not _filter_allows(filtered, "create_repository")

    def test_writes_without_approval_skips_the_approval_wrapper(self) -> None:
        capability = build_github_mcp_capability(
            _config(),
            instructions="instructions",
            allow_writes=True,
            require_write_approval=False,
        )
        toolset = capability.get_toolset()
        assert isinstance(toolset, FilteredToolset)
        for name in GITHUB_TOOL_ALLOWLIST:
            assert _filter_allows(toolset, name)

    def test_no_writes_filters_write_tools_out_entirely(self) -> None:
        capability = build_github_mcp_capability(
            _config(),
            instructions="instructions",
            allow_writes=False,
            require_write_approval=False,
        )
        toolset = capability.get_toolset()
        assert isinstance(toolset, FilteredToolset)
        for name in GITHUB_READ_TOOLS:
            assert _filter_allows(toolset, name)
        for name in GITHUB_WRITE_TOOLS:
            assert not _filter_allows(toolset, name)

    def test_instructions_are_paired_with_the_toolset(self) -> None:
        capability = build_github_mcp_capability(
            _config(),
            instructions="github guidance",
            allow_writes=True,
            require_write_approval=True,
        )
        assert capability.get_instructions() == "github guidance"

    def test_no_writes_strips_write_tools_from_instructions(self) -> None:
        """A read-only run must not advertise issue_write to the model."""
        capability = build_github_mcp_capability(
            _config(),
            instructions=AgentPrompts().github_tools,
            allow_writes=False,
            require_write_approval=False,
        )
        instructions = capability.get_instructions()
        for name in GITHUB_WRITE_TOOLS:
            assert f'<tool name="{name}">' not in instructions
        for name in GITHUB_READ_TOOLS:
            assert f'<tool name="{name}">' in instructions
        assert "<github_writes_unavailable>" in instructions


class TestDegradeOnConnectFailure:
    async def test_unreachable_server_degrades_instead_of_raising(self) -> None:
        toolset: GitHubMCPToolset[Any] = GitHubMCPToolset(_config())
        async with toolset:
            assert await toolset.get_tools(Mock()) == {}
        # A second enter after failure stays degraded and still does not raise.
        async with toolset:
            assert await toolset.get_tools(Mock()) == {}


class TestErrorSanitization:
    async def test_http_status_error_reduces_to_status_code(self) -> None:
        async def call_tool(name: str, args: dict[str, Any], **_: Any) -> Any:
            request = httpx.Request(
                "POST", "https://example.com/mcp/", headers={"Authorization": f"Bearer {_TOKEN}"}
            )
            raise httpx.HTTPStatusError(
                f"401 for url with Authorization: Bearer {_TOKEN}",
                request=request,
                response=httpx.Response(401, request=request),
            )

        with pytest.raises(ModelRetry) as exc_info:
            await _call_tool_with_sanitized_errors(Mock(), call_tool, "issue_read", {})
        assert _TOKEN not in str(exc_info.value)
        assert "401" in str(exc_info.value)

    async def test_transport_error_reduces_to_class_name(self) -> None:
        async def call_tool(name: str, args: dict[str, Any], **_: Any) -> Any:
            raise httpx.ConnectError(f"connect failed, headers: Bearer {_TOKEN}")

        with pytest.raises(ModelRetry) as exc_info:
            await _call_tool_with_sanitized_errors(Mock(), call_tool, "issue_read", {})
        assert _TOKEN not in str(exc_info.value)
        assert "ConnectError" in str(exc_info.value)

    async def test_model_retry_passes_through_unchanged(self) -> None:
        async def call_tool(name: str, args: dict[str, Any], **_: Any) -> Any:
            raise ModelRetry("issue not found")

        with pytest.raises(ModelRetry, match="issue not found"):
            await _call_tool_with_sanitized_errors(Mock(), call_tool, "issue_read", {})

    async def test_successful_call_returns_result(self) -> None:
        async def call_tool(name: str, args: dict[str, Any], **_: Any) -> Any:
            return {"ok": True}

        result = await _call_tool_with_sanitized_errors(Mock(), call_tool, "issue_read", {})
        assert result == {"ok": True}
