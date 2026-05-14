from __future__ import annotations

from pydantic_ai import RunContext
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.messages import InstructionPart

from phoenix.server.agents.dependencies import ChatDependencies


class MintlifyDocsMCPToolset(MCPServerStreamableHTTP):
    """MCPServerStreamableHTTP that surfaces Phoenix's local docs-tool guidance
    as a cacheable (``dynamic=False``) instruction part."""

    URL = "https://arizeai-433a7140.mintlify.app/mcp"

    def __init__(self) -> None:
        super().__init__(url=self.URL)

    async def get_instructions(self, ctx: RunContext[ChatDependencies]) -> InstructionPart:
        return InstructionPart(content=ctx.deps.instructions.docs_tool, dynamic=False)
