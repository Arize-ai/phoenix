"""The unit conftest memoizes the pydantic TypeAdapters behind FastAPI's route fields."""

from contextlib import AsyncExitStack
from typing import Annotated, Any, AsyncIterator, Iterable, get_args, get_origin

import pytest
from fastapi import FastAPI
from fastapi._compat import v2 as fastapi_v2
from fastapi.routing import _IncludedRouter
from pydantic.fields import FieldInfo

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


def _embeds_field_info(annotation: Any) -> bool:
    """Whether an ``Annotated`` anywhere in the annotation carries a FieldInfo.

    FastAPI copies such a FieldInfo per app, and ``Annotated`` compares its
    metadata by identity, so the annotation never equals its counterpart from
    another app and its adapter cannot be shared. This is why the cache is
    bounded."""
    if get_origin(annotation) is Annotated:
        if any(isinstance(item, FieldInfo) for item in annotation.__metadata__):
            return True
    return any(_embeds_field_info(argument) for argument in get_args(annotation))


def _route_fields(app: FastAPI) -> dict[str, fastapi_v2.ModelField]:
    """Every route's response-model field and its path, query, header, and
    cookie parameter fields, keyed by route id and field.

    FastAPI keeps the state it builds per app for an included router's routes
    on the ``_IncludedRouter`` node it appends to the app's routes, so the walk
    descends those nodes rather than reading the original router's routes.
    Body parameters are left out: a route with several gets a synthetic model
    class per app, which no cache can match."""
    fields: dict[str, fastapi_v2.ModelField] = {}

    def walk(candidates: Iterable[Any]) -> None:
        for candidate in candidates:
            if isinstance(candidate, _IncludedRouter):
                walk(candidate.effective_candidates())
                continue
            response_field = getattr(candidate, "response_field", None)
            if response_field is not None:
                fields[f"{candidate.unique_id}:response"] = response_field
            dependant = getattr(candidate, "dependant", None)
            if dependant is None:
                continue
            for kind in ("path_params", "query_params", "header_params", "cookie_params"):
                for field in getattr(dependant, kind):
                    fields[f"{candidate.unique_id}:{kind}:{field.name}"] = field

    walk(app.router.routes)
    assert fields, "expected routes with response models or parameters"
    return fields


@pytest.mark.real_fastapi_dependants
def test_unit_test_apps_share_route_type_adapters(app: FastAPI, second_app: FastAPI) -> None:
    """The suite-wide fixture is in force: two apps built in one worker hand
    back the same adapter object for every route field except the ones whose
    annotation embeds a FieldInfo. The dependency analysis runs fresh here so
    the fields themselves are new objects and only the adapters can be shared."""
    first, second = _route_fields(app), _route_fields(second_app)
    assert first.keys() == second.keys()
    not_shared = sorted(
        field_id
        for field_id in first
        if first[field_id]._type_adapter is not second[field_id]._type_adapter
    )
    assert not_shared == sorted(
        field_id for field_id in first if _embeds_field_info(first[field_id].field_info.annotation)
    )
    assert len(not_shared) < len(first) // 10


def test_fields_with_different_default_factories_do_not_share_an_adapter() -> None:
    """Pydantic renders every factory as ``<lambda>`` in a FieldInfo's repr,
    so the key has to tell them apart by identity."""
    first = fastapi_v2.ModelField(
        field_info=FieldInfo(annotation=int, default_factory=lambda: 1), name="x"
    )
    second = fastapi_v2.ModelField(
        field_info=FieldInfo(annotation=int, default_factory=lambda: 2), name="x"
    )
    same_factory = fastapi_v2.ModelField(
        field_info=FieldInfo(annotation=int, default_factory=first.field_info.default_factory),
        name="x",
    )
    assert first._type_adapter is not second._type_adapter
    assert same_factory._type_adapter is first._type_adapter


@pytest.mark.real_fastapi_type_adapters
@pytest.mark.real_fastapi_dependants
def test_marker_restores_fresh_route_type_adapters(app: FastAPI, second_app: FastAPI) -> None:
    first, second = _route_fields(app), _route_fields(second_app)
    assert first.keys() == second.keys()
    assert all(
        first[field_id]._type_adapter is not second[field_id]._type_adapter for field_id in first
    )


@pytest.mark.real_fastapi_type_adapters
def test_model_field_init_sets_only_the_type_adapter() -> None:
    """The memoized ``__post_init__`` replaces FastAPI's whole method, so this
    pins what that method does: beyond the dataclass fields it sets exactly
    one attribute, the adapter. A FastAPI release that makes it do more fails
    here instead of having that work silently skipped on a cache hit."""
    field = fastapi_v2.ModelField(field_info=FieldInfo(annotation=int), name="x")
    assert set(vars(field)) == {"field_info", "name", "mode", "config", "_type_adapter"}
