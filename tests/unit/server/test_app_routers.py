"""The unit conftest memoizes the app's router builders per worker."""

from contextlib import AsyncExitStack
from typing import AsyncIterator

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.routing import _IncludedRouter

from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import TestBulkInserter, patch_batched_caller, patch_grpc_server


@pytest.fixture
async def second_app(db: DbSessionFactory) -> AsyncIterator[FastAPI]:
    """A second app built the way the ``app`` fixture builds its own."""
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        yield create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )


def _included_routers(app: FastAPI) -> list[APIRouter]:
    """The router objects the app included, in inclusion order."""
    return [
        route.original_router for route in app.router.routes if isinstance(route, _IncludedRouter)
    ]


def _unshared_routers(app: FastAPI, second_app: FastAPI) -> list[APIRouter]:
    first, second = _included_routers(app), _included_routers(second_app)
    assert len(first) == len(second) >= 3
    return [a for a, b in zip(first, second) if a is not b]


def test_unit_test_apps_share_routers(app: FastAPI, second_app: FastAPI) -> None:
    """The suite-wide fixture is in force: two apps built in one worker with
    the same flags include the same router objects, except the GraphQL
    router, which ``create_app`` builds around each app's own database."""
    unshared = _unshared_routers(app, second_app)
    assert [type(router).__name__ for router in unshared] == ["GraphQLRouter"]


@pytest.mark.real_app_routers
def test_marker_restores_fresh_routers(app: FastAPI, second_app: FastAPI) -> None:
    """Opting out builds the routers again, so the v1 router differs too."""
    unshared = _unshared_routers(app, second_app)
    assert "/v1" in [router.prefix for router in unshared]
