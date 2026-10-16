"""Tests for the system-wide state store."""

from __future__ import annotations

from types import MappingProxyType

import pytest
from pydantic import BaseModel, ConfigDict

from phoenix.db import models
from phoenix.server.daemons.system_state import SystemState
from phoenix.server.types import DbSessionFactory


class _Marker(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    version: str


_KEY = "test.marker"
_REGISTRY = MappingProxyType({_KEY: _Marker})


@pytest.mark.asyncio
async def test_set_persists_and_increments_revision(
    db: DbSessionFactory,
) -> None:
    state = SystemState(db=db, registry=_REGISTRY)
    await state.bootstrap()

    await state._set(_KEY, _Marker(version="a"))
    await state._set(_KEY, _Marker(version="b"))
    assert state._cache.get(_KEY) == _Marker(version="b")
    assert state._cache.revision(_KEY) == 2

    async with db() as session:
        row = await session.get(models.SystemState, _KEY)
        assert row is not None
        assert row.value == {"version": "b"}
        assert row.revision == 2


@pytest.mark.asyncio
async def test_fetch_picks_up_writes_from_another_instance(
    db: DbSessionFactory,
) -> None:
    reader = SystemState(db=db, registry=_REGISTRY)
    writer = SystemState(db=db, registry=_REGISTRY)
    await reader.bootstrap()
    assert reader._cache.get(_KEY) is None

    await writer._set(_KEY, _Marker(version="a"))
    await reader._fetch()
    assert reader._cache.get(_KEY) == _Marker(version="a")
    assert reader._cache.revision(_KEY) == 1


@pytest.mark.asyncio
async def test_fetch_never_replaces_a_newer_cached_revision(
    db: DbSessionFactory,
) -> None:
    state = SystemState(db=db, registry=_REGISTRY)
    await state._set(_KEY, _Marker(version="a"))
    # Simulate a stale read: the cache already holds a newer revision than the DB.
    state._cache.put(_KEY, 5, _Marker(version="newer"))

    await state._fetch()
    assert state._cache.get(_KEY) == _Marker(version="newer")
    assert state._cache.revision(_KEY) == 5


@pytest.mark.asyncio
async def test_fetch_ignores_unknown_and_invalid_rows(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        session.add(models.SystemState(key="unknown.key", value={"x": 1}, revision=1))
        session.add(models.SystemState(key=_KEY, value={"wrong": 1}, revision=1))

    state = SystemState(db=db, registry=_REGISTRY)
    await state.bootstrap()
    assert state._cache.get("unknown.key") is None
    assert state._cache.get(_KEY) is None


@pytest.mark.asyncio
async def test_set_rejects_unknown_key(
    db: DbSessionFactory,
) -> None:
    state = SystemState(db=db, registry=_REGISTRY)
    with pytest.raises(ValueError):
        await state._set("unknown.key", _Marker(version="a"))
