from __future__ import annotations

import asyncio
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


def _current_binding_key() -> object:
    """Identifies the context a principal binding was made in.

    The enter and exit of one ``async with`` run in the same task, so the task is
    what pairs a release with the binding it belongs to. Outside a task there is
    only one context, and ``None`` keys it.
    """
    return asyncio.current_task()


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
        self._principal_bindings: dict[object, list[ExitStack]] = {}

    @override
    async def __aenter__(self) -> Self:
        # Bound here rather than per call, and before the session opens; see
        # `bind_principal` for why the placement is the only one that works.
        #
        # Every enter binds and keeps its own handle, keyed by the task that will
        # release it. A shared depth counter cannot serve: context variables are
        # per task, so resetting one in a task other than the one that set it
        # raises `ValueError`, and a counter cannot tell those tasks apart. One
        # instance is entered concurrently whenever a model response fans out two
        # `call_subagent` calls, because the subagent and its toolset are built
        # once per request and reused across every invocation.
        binding = ExitStack()
        binding.enter_context(bind_principal(self._principal))
        try:
            entered = await super().__aenter__()
        except BaseException:
            binding.close()
            raise
        self._principal_bindings.setdefault(_current_binding_key(), []).append(binding)
        return entered

    @override
    async def __aexit__(self, *args: Any) -> bool | None:
        try:
            return await super().__aexit__(*args)
        finally:
            # Released by the enter that bound it, in that enter's own task, so
            # the set and the reset always share a context. Nested enters unwind
            # last in, first out, and a token reset restores the enclosing
            # binding rather than clearing it.
            key = _current_binding_key()
            if bindings := self._principal_bindings.get(key):
                bindings.pop().close()
                if not bindings:
                    del self._principal_bindings[key]


@dataclass
class PhoenixMCPCapability(AbstractStaticCapability[AgentDepsT]):
    """Pairs the Phoenix MCP toolset with its cacheable, session-stable guidance."""

    mcp_server: MCPToolset[AgentDepsT]
    instructions: Template

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        return self.mcp_server

    def get_static_instructions(self) -> str:
        return self.instructions.render()
