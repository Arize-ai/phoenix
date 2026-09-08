"""GitHub issue tools for PXI, backed by GitHub's remote MCP server.

The toolset is scoped to a single agent run: it carries the turn's resolved
token (the requesting user's PAT when one was supplied, otherwise the
workspace token) as transport auth, so the token never appears in a tool
argument, tool result, or span. Only a small allowlist of issue tools is
exposed, and issue writes require explicit user approval unless the turn runs
with edit permission ``bypass``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.exceptions import ModelRetry
from pydantic_ai.mcp import CallToolFunc, MCPToolset, ToolResult
from pydantic_ai.tools import AgentDepsT, RunContext
from pydantic_ai.toolsets import (
    AbstractToolset,
    AgentToolset,
    ApprovalRequiredToolset,
    FilteredToolset,
)
from typing_extensions import Self, override

from phoenix.server.agents.github import GitHubMCPConfig

logger = logging.getLogger(__name__)

# Tool names on GitHub's remote MCP server (github/github-mcp-server) `issues`
# toolset. `issue_read` and `issue_write` are the consolidated read/create
# entry points; writes are approval-gated below.
GITHUB_READ_TOOLS = frozenset({"issue_read", "list_issues", "search_issues"})
GITHUB_WRITE_TOOLS = frozenset({"issue_write"})
GITHUB_TOOL_ALLOWLIST = GITHUB_READ_TOOLS | GITHUB_WRITE_TOOLS

# Appended when the write tools are filtered out, so the model knows the
# absence is deliberate for this run. Context-neutral on purpose: the same
# note serves headless turns and subagents, whose remedies differ.
_WRITES_UNAVAILABLE_NOTE = (
    "<github_writes_unavailable>Creating GitHub issues is not available in this "
    "run; only the read and search tools are exposed.</github_writes_unavailable>"
)

_INIT_TIMEOUT_SECONDS = 10.0
_READ_TIMEOUT_SECONDS = 60.0


class GitHubMCPToolset(MCPToolset[AgentDepsT]):
    """Per-run MCP transport to a GitHub MCP server, authenticated as one principal.

    A connect failure degrades the run instead of failing it: the toolset
    reports no tools and the turn proceeds without GitHub.
    """

    def __init__(self, config: GitHubMCPConfig, **kwargs: Any) -> None:
        super().__init__(
            config.base_url,
            id="github",
            auth=config.token.get_secret_value(),
            # Server-side trim of the remote tool surface; the local allowlist
            # in `build_github_mcp_capability` is the actual guarantee.
            headers={"X-MCP-Toolsets": "issues"},
            init_timeout=_INIT_TIMEOUT_SECONDS,
            read_timeout=_READ_TIMEOUT_SECONDS,
            process_tool_call=_call_tool_with_sanitized_errors,
            **kwargs,
        )
        self._unavailable = False

    @override
    async def __aenter__(self) -> Self:
        if self._unavailable:
            return self
        try:
            await super().__aenter__()
        except Exception as exc:
            # The message names only the failure class: transport errors can
            # echo request headers, including the auth header.
            logger.warning(
                "GitHub MCP server connection failed (%s); "
                "continuing the turn without GitHub tools",
                type(exc).__name__,
            )
            self._unavailable = True
        return self

    @override
    async def __aexit__(self, *args: Any) -> bool | None:
        if self._unavailable:
            return None
        return await super().__aexit__(*args)

    @override
    async def get_tools(self, ctx: RunContext[AgentDepsT]) -> dict[str, Any]:
        if self._unavailable:
            return {}
        return await super().get_tools(ctx)


async def _call_tool_with_sanitized_errors(
    ctx: RunContext[Any],
    call_tool: CallToolFunc,
    name: str,
    args: dict[str, Any],
) -> ToolResult:
    """Invoke the remote tool, reducing transport failures to their class name.

    Raw httpx/MCP transport exception text can embed request headers — and so
    the bearer token — which must never reach the model or a tool span.
    """
    try:
        return await call_tool(name, args)
    except ModelRetry:
        raise
    except httpx.HTTPStatusError as exc:
        raise ModelRetry(
            f"GitHub MCP request failed with HTTP {exc.response.status_code}"
        ) from None
    except httpx.HTTPError as exc:
        raise ModelRetry(f"GitHub MCP request failed: {type(exc).__name__}") from None


@dataclass
class GitHubMCPCapability(AbstractCapability[AgentDepsT]):
    """Pairs the GitHub MCP toolset with its guidance text."""

    toolset: AgentToolset[AgentDepsT]
    instructions: str

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        return self.toolset

    def get_instructions(self) -> str:
        return self.instructions


def build_github_mcp_capability(
    config: GitHubMCPConfig,
    *,
    instructions: str,
    allow_writes: bool,
    require_write_approval: bool,
) -> GitHubMCPCapability[AgentDepsT]:
    """Assemble the GitHub capability for one agent run.

    Args:
        config: The turn's resolved token and MCP endpoint.
        instructions: Guidance text paired with the toolset.
        allow_writes: Whether issue writes are possible at all this run. When
            False (a headless run without edit-permission bypass, where nobody
            can answer an approval request), write tools are filtered out so
            the model never sees a tool guaranteed to dead-end.
        require_write_approval: Whether issue writes must be approved by the
            user before executing.
    """
    allowed_tools = GITHUB_TOOL_ALLOWLIST if allow_writes else GITHUB_READ_TOOLS
    if not allow_writes:
        instructions = f"{instructions.rstrip()}\n{_WRITES_UNAVAILABLE_NOTE}"
    toolset: AbstractToolset[AgentDepsT] = FilteredToolset(
        wrapped=GitHubMCPToolset[AgentDepsT](config),
        filter_func=lambda _ctx, tool_def: tool_def.name in allowed_tools,
    )
    if allow_writes and require_write_approval:
        toolset = ApprovalRequiredToolset(
            wrapped=toolset,
            approval_required_func=lambda _ctx, tool_def, _args: (
                tool_def.name in GITHUB_WRITE_TOOLS
            ),
        )
    return GitHubMCPCapability(toolset=toolset, instructions=instructions)
