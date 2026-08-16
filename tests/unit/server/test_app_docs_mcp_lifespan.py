"""Regression test for the docs MCP server's effect on application startup.

The docs MCP capability (``MintlifyDocsMCPServer``) connects to an external
Mintlify host during the FastAPI lifespan. When that host is unreachable -- e.g.
a pod whose egress policy blocks the connection -- the MCP ``initialize()``
handshake hangs until its deadline and raises. That failure must NOT abort
startup: the docs capability is best-effort, so the app must boot and degrade
(assistant without docs tools) rather than crash-loop.
"""

from __future__ import annotations

from contextlib import AsyncExitStack

import pytest
from asgi_lifespan import LifespanManager

from phoenix.server.agents.capabilities import MintlifyDocsMCPServer
from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import (
    TestBulkInserter,
    patch_batched_caller,
    patch_grpc_server,
)


class _ExplodingDocsMCPServer(MintlifyDocsMCPServer):
    """Docs MCP server whose handshake fails like a blocked/timed-out egress."""

    async def __aenter__(self) -> "_ExplodingDocsMCPServer":
        raise TimeoutError("deadline exceeded")


async def test_app_starts_up_when_docs_mcp_server_init_fails(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A docs MCP server whose handshake fails must not abort startup."""
    # Force the gate open so ``create_app`` constructs the docs MCP server
    # regardless of the ambient test environment.
    monkeypatch.setattr("phoenix.server.app.get_env_disable_agent_assistant", lambda: False)
    monkeypatch.setattr("phoenix.server.app.get_env_allow_external_resources", lambda: True)
    monkeypatch.setattr("phoenix.server.app.MintlifyDocsMCPServer", _ExplodingDocsMCPServer)

    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        # The path under test is actually exercised: the gate built our
        # exploding server, not ``None``.
        assert isinstance(app.state.docs_mcp_server, _ExplodingDocsMCPServer)
        # Lifespan startup must not raise even though docs MCP init fails.
        await stack.enter_async_context(LifespanManager(app))
