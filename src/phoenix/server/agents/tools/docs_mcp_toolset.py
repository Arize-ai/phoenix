from __future__ import annotations

from pydantic_ai.mcp import MCPServerStreamableHTTP

_MINTLIFY_DOCS_MCP_URL = "https://arizeai-433a7140.mintlify.app/mcp"


def build_docs_mcp_toolset() -> MCPServerStreamableHTTP:
    """Return the Phoenix docs MCP toolset (Mintlify-hosted).

    The toolset's tool names and schemas are determined by the MCP server at
    runtime via ``tools/list``.
    """
    return MCPServerStreamableHTTP(url=_MINTLIFY_DOCS_MCP_URL)
