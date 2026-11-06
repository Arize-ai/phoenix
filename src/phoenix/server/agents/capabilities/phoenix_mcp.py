from __future__ import annotations

import asyncio
from contextlib import ExitStack
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.mcp import MCPToolset
from pydantic_ai.tools import AgentDepsT
from pydantic_ai.toolsets import AgentToolset
from typing_extensions import Self, override

from phoenix.server.bearer_auth import PhoenixUser, bind_principal

if TYPE_CHECKING:
    from fastmcp import FastMCP


def _current_binding_key() -> object:
    """Pairs a release with the binding it belongs to.

    The enter and exit of one ``async with`` run in the same task, so task
    identity is the pairing. Outside a task there is one context, keyed ``None``.
    """
    return asyncio.current_task()


class PhoenixMCPToolset(MCPToolset[AgentDepsT]):
    """Phoenix's REST API as a toolset, reached over an in-memory transport.

    Tools derive from the same OpenAPI spec as the mounted MCP server, so a new
    ``/v1`` endpoint needs no hand-written tool.

    Scoped to a single agent run: the principal binding ends with the run.
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
        # Bound before the session opens; see `bind_principal` for why that
        # placement holds across transports.
        # Per enter rather than per instance: one instance is entered from
        # several tasks at once when a model response fans out two
        # `call_subagent` calls onto the subagent's single toolset, and a
        # context variable can only be reset in the task that set it.
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
            # Each exit closes what its own enter opened, so a binding is reset
            # in the task that set it. Nested enters unwind last in, first out:
            # the inner reset restores the enclosing binding.
            key = _current_binding_key()
            if bindings := self._principal_bindings.get(key):
                bindings.pop().close()
                if not bindings:
                    del self._principal_bindings[key]


@dataclass
class PhoenixMCPCapability(AbstractCapability[AgentDepsT]):
    """Pairs the Phoenix MCP toolset with its guidance text and the server's
    own ``initialize`` instructions."""

    mcp_server: MCPToolset[AgentDepsT]
    instructions: str
    initialize_instructions: Optional[str] = None

    def get_toolset(self) -> AgentToolset[AgentDepsT] | None:
        return self.mcp_server

    def get_instructions(self) -> str:
        if not self.initialize_instructions:
            return self.instructions
        return f"{self.instructions}\n{self.initialize_instructions}"
