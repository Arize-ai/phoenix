"""The unit conftest memoizes FastAPI's dependency analysis of each route per worker."""

from contextlib import AsyncExitStack
from dataclasses import fields
from typing import Any, AsyncIterator, Iterable

import pytest
from fastapi import FastAPI
from fastapi.dependencies.models import Dependant
from fastapi.routing import _IncludedRouter

from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit import conftest
from tests.unit.conftest import (
    _DEPENDANT_LIST_FIELDS,
    TestBulkInserter,
    patch_batched_caller,
    patch_grpc_server,
)


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


def _route_dependants(app: FastAPI) -> dict[str, Dependant]:
    """Every route's dependant, keyed by route id, forcing the per-app route
    state FastAPI otherwise builds on the first request."""
    dependants: dict[str, Dependant] = {}

    def walk(candidates: Iterable[Any]) -> None:
        for candidate in candidates:
            if isinstance(candidate, _IncludedRouter):
                walk(candidate.effective_candidates())
                continue
            dependant = getattr(candidate, "dependant", None)
            if dependant is not None:
                dependants[candidate.unique_id] = dependant

    walk(app.router.routes)
    assert dependants, "expected routes with dependants"
    return dependants


def test_unit_test_apps_share_route_dependency_analysis(app: FastAPI, second_app: FastAPI) -> None:
    """The suite-wide fixture is in force: two apps built in one worker get
    distinct dependants for a route, so router-level dependencies inserted
    into one cannot leak into the other, but the fields inside are the same
    objects."""
    first, second = _route_dependants(app), _route_dependants(second_app)
    assert first.keys() == second.keys()
    shared_fields = 0
    for route_id, dependant in first.items():
        other = second[route_id]
        assert dependant is not other
        for list_field in _DEPENDANT_LIST_FIELDS:
            assert getattr(dependant, list_field) is not getattr(other, list_field)
        assert len(dependant.dependencies) == len(other.dependencies)
        for kind in ("path_params", "query_params", "header_params", "cookie_params"):
            mine, theirs = getattr(dependant, kind), getattr(other, kind)
            assert len(mine) == len(theirs)
            assert all(a is b for a, b in zip(mine, theirs))
            shared_fields += len(mine)
    assert shared_fields > 0


@pytest.mark.real_fastapi_dependants
def test_marker_restores_fresh_route_dependency_analysis(app: FastAPI, second_app: FastAPI) -> None:
    first, second = _route_dependants(app), _route_dependants(second_app)
    assert first.keys() == second.keys()
    compared = [
        (a, b)
        for route_id in first
        for a, b in zip(first[route_id].query_params, second[route_id].query_params)
    ]
    assert compared
    assert not any(a is b for a, b in compared)


async def _module_level_endpoint(limit: int = 0) -> None:
    return None


def test_only_recurring_endpoints_are_memoized() -> None:
    """A handler created per app, such as the ones a GraphQL router builds
    for each instance, is analyzed fresh and not retained; a module-level
    endpoint is analyzed once and handed out as copies. Endpoints on a shared
    router recur too, which the sharing test above covers through the legacy
    agent chat route."""
    memoized: Any = vars(conftest)["_memoized_fastapi_dependant"]
    cache: dict[Any, Any] = vars(conftest)["_MEMOIZED_FASTAPI_DEPENDANTS"]

    def per_app_handler() -> Any:
        async def endpoint(limit: int = 0) -> None:
            return None

        return endpoint

    size_before = len(cache)
    first = memoized(path="/per-app", call=per_app_handler(), scope="function")
    second = memoized(path="/per-app", call=per_app_handler(), scope="function")
    assert len(cache) == size_before
    assert first.query_params[0] is not second.query_params[0]

    first = memoized(path="/shared", call=_module_level_endpoint, scope="function")
    second = memoized(path="/shared", call=_module_level_endpoint, scope="function")
    assert len(cache) == size_before + 1
    assert first is not second
    assert first.query_params is not second.query_params
    assert first.query_params[0] is second.query_params[0]


def test_every_list_on_a_dependant_is_copied() -> None:
    """The memoized dependant is copied list by list. This pins that the set
    of lists is derived from the dataclass, so a FastAPI release that adds one
    is copied too rather than shared and mutated across apps."""
    list_fields = {field.name for field in fields(Dependant) if field.default_factory is list}
    assert set(_DEPENDANT_LIST_FIELDS) == list_fields
    assert {"dependencies", "path_params", "query_params", "body_params"} <= list_fields
