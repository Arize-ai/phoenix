from __future__ import annotations

from typing import Any

from pydantic_ai import RunContext
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.messages import InstructionPart

from phoenix.server.agents.prompts import DOCS_TOOL_SYSTEM_PROMPT


class MintlifyDocsMCPToolset(MCPServerStreamableHTTP):
    """MCPServerStreamableHTTP that surfaces Phoenix's local docs-tool guidance
    as a cacheable (``dynamic=False``) instruction part."""

    URL = "https://arizeai-433a7140.mintlify.app/mcp"

    def __init__(self) -> None:
        super().__init__(url=self.URL)

    async def get_instructions(self, ctx: RunContext[Any]) -> InstructionPart:
        return InstructionPart(content=DOCS_TOOL_SYSTEM_PROMPT, dynamic=False)
