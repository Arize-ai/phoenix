"""MCP client for Phoenix documentation search.

Connects to the Mintlify-hosted MCP server to provide documentation search
capabilities for the PXI chat agent.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from starlette.requests import Request

from phoenix.config import get_env_allow_external_resources

if TYPE_CHECKING:
    from mcp import ClientSession
    from pydantic_ai.tools import ToolDefinition

logger = logging.getLogger(__name__)

_MCP_URL = "https://arizeai-433a7140.mintlify.app/mcp"
_MCP_CALL_TIMEOUT = timedelta(seconds=10)

# Tool names served by the Mintlify MCP endpoint. Used by the module-level
# ``is_backend_tool`` helper so callers can check tool ownership without
# instantiating a client.
_KNOWN_BACKEND_TOOLS: set[str] = set()


def is_backend_tool(name: str) -> bool:
    """Check if a tool name is a known backend tool."""
    return name in _KNOWN_BACKEND_TOOLS


class MintlifyDocsClient:
    """Async MCP client that provides Mintlify documentation search tools.

    The client lazily connects to the MCP server on first use and keeps the
    connection alive for reuse across requests. It is safe to call from
    multiple concurrent tasks — an ``asyncio.Lock`` serialises all session
    I/O (connection, tool listing, and tool invocations).

    Usage::

        async with MintlifyDocsClient() as client:
            tools = await client.get_tool_definitions()
            result = await client.call_tool("search", {"query": "embeddings"})
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._session: ClientSession | None = None
        self._exit_stack: Any | None = None  # contextlib.AsyncExitStack
        self._tool_definitions: list[ToolDefinition] | None = None

    async def __aenter__(self) -> MintlifyDocsClient:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        await self.close()

    async def connect(self) -> None:
        """Establish the MCP connection if not already connected.

        Safe to call multiple times — only the first call (or the first call
        after a disconnect) actually opens the connection.
        """
        async with self._lock:
            if self._session is not None:
                return
            await self._connect_locked()

    async def _connect_locked(self) -> None:
        """Open the MCP transport and session. Caller must hold ``_lock``."""
        import contextlib

        from mcp import ClientSession
        from mcp.client.streamable_http import streamable_http_client

        stack = contextlib.AsyncExitStack()
        try:
            read_stream, write_stream, _ = await stack.enter_async_context(
                streamable_http_client(_MCP_URL)
            )
            session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
            await session.initialize()
            self._session = session
            self._exit_stack = stack
            # Invalidate cached tool definitions so they are re-fetched from
            # the new session.
            self._tool_definitions = None
            logger.info("Connected to Mintlify MCP server at %s", _MCP_URL)
        except Exception:
            logger.exception("Failed to connect to Mintlify MCP server at %s", _MCP_URL)
            await stack.aclose()
            raise

    async def _ensure_session_locked(self) -> ClientSession:
        """Return the active session, connecting first if needed.

        Caller **must** already hold ``self._lock``.
        """
        if self._session is None:
            await self._connect_locked()
        assert self._session is not None  # noqa: S101
        return self._session

    async def get_tool_definitions(self) -> list["ToolDefinition"]:
        """Return tool definitions suitable for ``pydantic_ai``.

        Results are cached after the first successful fetch.
        """
        if self._tool_definitions is not None:
            return self._tool_definitions

        async with self._lock:
            # Double-check after acquiring the lock — another task may have
            # populated the cache while we were waiting.
            if self._tool_definitions is not None:
                return self._tool_definitions

            session = await self._ensure_session_locked()
            result = await session.list_tools()

            from pydantic_ai.tools import ToolDefinition

            definitions: list[ToolDefinition] = []
            for tool in result.tools:
                definitions.append(
                    ToolDefinition(
                        name=tool.name,
                        description=tool.description,
                        parameters_json_schema=tool.inputSchema,
                    )
                )
                _KNOWN_BACKEND_TOOLS.add(tool.name)

            self._tool_definitions = definitions
            logger.debug(
                "Discovered %d tool(s) from Mintlify MCP: %s",
                len(definitions),
                [d.name for d in definitions],
            )
            return definitions

    async def call_tool(self, name: str, args: dict[str, Any]) -> str:
        """Invoke a tool on the MCP server and return the text result."""
        async with self._lock:
            session = await self._ensure_session_locked()
            try:
                result = await session.call_tool(
                    name, arguments=args, read_timeout_seconds=_MCP_CALL_TIMEOUT
                )
            except Exception:
                logger.exception("MCP call_tool(%s) failed", name)
                raise

        texts = [block.text for block in result.content if hasattr(block, "text")]
        return "\n".join(texts) if texts else "No results found"

    def is_backend_tool(self, name: str) -> bool:
        """Check whether *name* belongs to this client's tool set."""
        return name in _KNOWN_BACKEND_TOOLS

    async def close(self) -> None:
        """Tear down the MCP session and transport."""
        async with self._lock:
            self._session = None
            self._tool_definitions = None
            stack = self._exit_stack
            self._exit_stack = None
        if stack is not None:
            try:
                await stack.aclose()
            except Exception:
                logger.exception("Error closing MCP connection")


def get_mcp_client(request: Request) -> MintlifyDocsClient | None:
    """Return the shared MCP client from app state, creating it on first use.

    Returns ``None`` when external networking is disabled
    (``PHOENIX_ALLOW_EXTERNAL_RESOURCES=false``) or if the client fails to
    initialise, so the chat endpoint degrades gracefully (backend tools
    simply won't be available).
    """
    state = request.app.state
    if not hasattr(state, "_mcp_client"):
        if not get_env_allow_external_resources():
            state._mcp_client = None
        else:
            try:
                client = MintlifyDocsClient()
                state._mcp_client = client

                # Register cleanup so the HTTP transport and MCP session are
                # closed on server shutdown rather than abandoned.
                async def _close_mcp_client() -> None:
                    try:
                        await client.close()
                    except Exception:
                        logger.exception("Error closing MCP client during shutdown")

                request.app.router.on_shutdown.append(_close_mcp_client)
            except Exception:
                logger.exception("Failed to create MCP client")
                state._mcp_client = None
    result: MintlifyDocsClient | None = state._mcp_client
    return result
