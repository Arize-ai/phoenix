from __future__ import annotations

from typing import Any
from unittest.mock import Mock

import httpx
import pytest
from pydantic import SecretStr
from pydantic_ai.exceptions import ModelRetry, ToolFailed
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

    def test_no_writes_appends_the_unavailable_note(self) -> None:
        """A read-only run tells the model the write tools are deliberately absent."""
        capability = build_github_mcp_capability(
            _config(),
            instructions=AgentPrompts().github_tools,
            allow_writes=False,
            require_write_approval=False,
        )
        instructions = capability.get_instructions()
        assert instructions.startswith(AgentPrompts().github_tools.rstrip())
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
    @staticmethod
    def _failing_call(status_code: int) -> Any:
        async def call_tool(name: str, args: dict[str, Any], **_: Any) -> Any:
            request = httpx.Request(
                "POST", "https://example.com/mcp/", headers={"Authorization": f"Bearer {_TOKEN}"}
            )
            raise httpx.HTTPStatusError(
                f"{status_code} for url with Authorization: Bearer {_TOKEN}",
                request=request,
                response=httpx.Response(status_code, request=request),
            )

        return call_tool

    @pytest.mark.parametrize("status_code", [500, 502, 429])
    async def test_retryable_http_status_error_reduces_to_status_code(
        self, status_code: int
    ) -> None:
        with pytest.raises(ModelRetry) as exc_info:
            await _call_tool_with_sanitized_errors(
                Mock(), self._failing_call(status_code), "issue_read", {}
            )
        assert _TOKEN not in str(exc_info.value)
        assert str(status_code) in str(exc_info.value)

    @pytest.mark.parametrize("status_code", [401, 403])
    async def test_authorization_failure_is_terminal_not_retryable(self, status_code: int) -> None:
        """An auth failure must not come back as a retry prompt.

        The turn's token is bound when the toolset is built, so retrying re-sends
        the same credential; the assistant previously reissued identical
        `issue_write` calls after a 403 instead of telling the user to fix the token.
        """
        with pytest.raises(ToolFailed) as exc_info:
            await _call_tool_with_sanitized_errors(
                Mock(), self._failing_call(status_code), "issue_write", {}
            )
        message = str(exc_info.value)
        assert _TOKEN not in message
        assert str(status_code) in message
        assert "not authorized" in message
        # ToolFailed is not a ModelRetry, so the retry budget is untouched.
        assert not isinstance(exc_info.value, ModelRetry)

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
