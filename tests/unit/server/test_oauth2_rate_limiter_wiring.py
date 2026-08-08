"""End-to-end wiring check for the OAuth2 rate limiters.

The unit tests in test_rate_limiters.py exercise the limiter dependency in
isolation; these tests send a real request through the app to verify that the
dependency is attached to the OAuth2 authorization-server routes and that its
path gate matches both at the domain root and under a root path.

ServerRateLimiter.make_request is patched to signal exhaustion rather than
consuming real tokens: the module-level token buckets in
oauth2_authorization_server.py live for the whole test session, so draining
them here could starve unrelated tests in the same worker.
"""

from __future__ import annotations

import contextlib
from typing import AsyncIterator
from unittest import mock

import httpx
import pytest
from asgi_lifespan import LifespanManager
from pydantic import SecretStr
from starlette.types import ASGIApp

from phoenix.server.app import create_app
from phoenix.server.rate_limiters import ServerRateLimiter, UnavailableTokensError
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import TestBulkInserter, patch_grpc_server


@contextlib.asynccontextmanager
async def _auth_app(db: DbSessionFactory) -> AsyncIterator[ASGIApp]:
    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=True,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            secret=SecretStr("test-secret-at-least-32-chars-long!!"),
        )
        manager = await stack.enter_async_context(LifespanManager(app))
        yield manager.app


@pytest.mark.parametrize(
    "root_path",
    [
        pytest.param("", id="at-domain-root"),
        pytest.param("/phoenix", id="under-root-path"),
    ],
)
async def test_oauth2_register_consults_rate_limiter(
    root_path: str,
    db: DbSessionFactory,
) -> None:
    async with _auth_app(db) as app:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, root_path=root_path),
            base_url="http://test",
        ) as client:
            with mock.patch.object(
                ServerRateLimiter, "make_request", side_effect=UnavailableTokensError
            ):
                response = await client.post(f"{root_path}/oauth2/register", json={})
    assert response.status_code == 429
