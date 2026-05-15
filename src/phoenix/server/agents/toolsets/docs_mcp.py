from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from pydantic_ai import RunContext
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.messages import InstructionPart
from pydantic_ai.toolsets import WrapperToolset

from phoenix.server.agents.dependencies import ChatDependencies


class MintlifyDocsMCPServer(MCPServerStreamableHTTP):
    """Long-lived MCP transport to Phoenix's Mintlify docs server."""

    URL = "https://arizeai-433a7140.mintlify.app/mcp"

    def __init__(self) -> None:
        super().__init__(url=self.URL)


@dataclass
class DocsToolInstructionsToolset(WrapperToolset[ChatDependencies]):
    """Wraps the docs MCP toolset to surface Phoenix's local docs-tool guidance
    as a cacheable (``dynamic=False``) instructions part.

    The instructions text is bound at agent build time, not pulled from the
    per-turn run context, since it does not vary across turns of a given
    agent."""

    instructions: str

    async def get_instructions(
        self,
        ctx: RunContext[ChatDependencies],
    ) -> str | InstructionPart | Sequence[str | InstructionPart] | None:
        return InstructionPart(content=self.instructions, dynamic=False)
