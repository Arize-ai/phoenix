from __future__ import annotations

from contextlib import ExitStack
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional

from jinja2 import Template
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import AgentToolset
from typing_extensions import Self, override

from phoenix.server.agents.capabilities.base import AbstractStaticCapability
from phoenix.server.bearer_auth import PhoenixUser, bind_principal

if TYPE_CHECKING:
    from fastmcp import FastMCP


class PhoenixMCPToolset(MCPToolset[AgentDepsT]):
    """Phoenix's REST API as a toolset, reached over an in-memory transport.

    Tools derive from the same OpenAPI spec as the mounted MCP server, so a new
    ``/v1`` endpoint needs no hand-written tool.

    Scoped to a single agent run: the principal binding and the session's
    tool-group reveals both end with the run.
    """

    def __init__(
        self,
        server: "FastMCP",
        *,
        principal: Optional[PhoenixUser] = None,
        **kwargs: Any,
    ) -> None:
        # A `FastMCP` instance resolves to an in-memory transport, which bypasses
        # the mount's bearer guard; `principal` is the caller's identity instead.
        super().__init__(server, **kwargs)
        self._principal = principal
        self._principal_binding: Optional[ExitStack] = None
        self._principal_depth = 0

    @override
    async def __aenter__(self) -> Self:
        # Bound here rather than per call, and before the session opens; see
        # `bind_principal` for why the placement is the only one that works.
        binding: Optional[ExitStack] = None
        if self._principal_depth == 0:
            binding = ExitStack()
            binding.enter_context(bind_principal(self._principal))
        try:
            entered = await super().__aenter__()
        except BaseException:
            if binding is not None:
                binding.close()
            raise
        if binding is not None:
            self._principal_binding = binding
        self._principal_depth += 1
        return entered

    @override
    async def __aexit__(self, *args: Any) -> bool | None:
        try:
            return await super().__aexit__(*args)
        finally:
            # Released by the enter that bound it; the parent is reference counted,
            # so nested enters must neither rebind nor unbind early.
            self._principal_depth -= 1
            if self._principal_depth == 0 and self._principal_binding is not None:
                self._principal_binding.close()
                self._principal_binding = None


@dataclass
class PhoenixMCPCapability(AbstractStaticCapability[AgentDepsT]):
    """Pairs the Phoenix MCP toolset with its cacheable, session-stable guidance."""

    mcp_server: MCPToolset[AgentDepsT]
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        return self.mcp_server

    def get_static_instructions(self) -> str:
        return self.instructions.render()
