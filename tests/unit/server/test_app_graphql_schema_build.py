"""The unit conftest memoizes the app's GraphQL schema build per worker."""

from contextlib import AsyncExitStack
from typing import Any, Callable

import pytest
import strawberry
from fastapi import FastAPI
from strawberry.extensions import SchemaExtension

from phoenix.server import app as app_module
from phoenix.server.api.schema import build_graphql_schema
from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from tests.unit import conftest
from tests.unit.conftest import TestBulkInserter, patch_batched_caller, patch_grpc_server


class _Extension(SchemaExtension):
    pass


class _CapturingExtension(SchemaExtension):
    def __init__(self, limit: int, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.limit = limit


def _extension_factory() -> SchemaExtension:
    return _Extension()


async def _build_app(db: DbSessionFactory) -> FastAPI:
    """Build an app the way the ``app`` fixture does."""
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        return create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )


def _builder_the_app_calls() -> Callable[..., strawberry.Schema]:
    """The name ``create_app`` resolves at call time, patched or not."""
    builder: Callable[..., strawberry.Schema] = vars(app_module)["build_graphql_schema"]
    return builder


def test_unit_test_apps_share_one_schema_per_extension_list() -> None:
    """The suite-wide fixture is in force: the builder the app calls hands
    back the same schema for an equivalent extension list and a different
    one for a different list. The app's own factories are lambdas on fixed
    lines, so their code objects repeat across apps the way this one does."""
    builder = _builder_the_app_calls()
    assert builder is not build_graphql_schema
    extensions: list[Any] = [_extension_factory]
    first = builder(extensions)
    again = builder(list(extensions))
    other = builder([_Extension])
    assert first is again
    assert other is not first


async def test_a_second_app_in_the_worker_skips_the_schema_build(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Through ``create_app`` and the extension lambdas it builds per call:
    once one app has been built in the worker, building another calls the
    real builder zero times."""
    real_builds: list[Any] = []
    # The name the memoized builder resolves at call time.
    real_builder: Callable[..., strawberry.Schema] = vars(conftest)["build_graphql_schema"]

    def counting_builder(extensions: Any = None) -> strawberry.Schema:
        real_builds.append(extensions)
        return real_builder(extensions)

    monkeypatch.setattr(conftest, "build_graphql_schema", counting_builder)
    await _build_app(db)
    builds_after_first = len(real_builds)
    await _build_app(db)
    assert len(real_builds) == builds_after_first


def _capturing_factory(limit: int) -> Callable[[], SchemaExtension]:
    return lambda: _CapturingExtension(limit)


def test_extension_lambdas_with_different_captures_get_different_schemas() -> None:
    """Two lambdas from one source line that capture different values are not
    the same extension, so they must not share a schema."""
    builder = _builder_the_app_calls()
    one, two = _capturing_factory(1), _capturing_factory(2)
    assert builder([one]) is not builder([two])
    assert builder([one]) is builder([_capturing_factory(1)])


@pytest.mark.real_graphql_schema_build
def test_marker_restores_a_fresh_schema_per_app() -> None:
    builder = _builder_the_app_calls()
    assert builder is build_graphql_schema
    first = builder([_Extension])
    again = builder([_Extension])
    assert first is not again
