from __future__ import annotations

import logging
from asyncio import sleep
from typing import Mapping, Optional

import sqlalchemy as sa
from pydantic import BaseModel, ValidationError

from phoenix.db import models
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.settings.registry import STATE_REGISTRY
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)


class _StateCache:
    """In-memory store for system_state, keeping each key's value with its revision."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[int, BaseModel]] = {}

    def get(self, key: str) -> Optional[BaseModel]:
        entry = self._data.get(key)
        return entry[1] if entry is not None else None

    def revision(self, key: str) -> Optional[int]:
        entry = self._data.get(key)
        return entry[0] if entry is not None else None

    def put(self, key: str, revision: int, value: BaseModel) -> None:
        """Store the value unless the cache already holds this revision or a newer one."""
        current = self.revision(key)
        if current is not None and current >= revision:
            return
        self._data[key] = (revision, value)


class SystemState(DaemonTask):
    """In-memory cache of system_state — kept fresh by polling and write-through."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        registry: Mapping[str, type[BaseModel]] = STATE_REGISTRY,
        refresh_interval_seconds: int = 30,
    ) -> None:
        super().__init__()
        self._db = db
        self._registry = registry
        self._cache = _StateCache()
        self._refresh_interval_seconds = refresh_interval_seconds

    async def _set(self, key: str, value: BaseModel) -> BaseModel:
        model_cls = self._registry.get(key)
        if model_cls is None:
            raise ValueError(f"Unknown state key: {key}")
        parsed = model_cls.model_validate(value)
        payload = parsed.model_dump(mode="json")
        stmt = insert_on_conflict(
            {"key": key, "value": payload, "revision": 1},
            table=models.SystemState,
            dialect=self._db.dialect,
            unique_by=("key",),
            constraint_name="pk_system_state",
            set_={
                "value": payload,
                "revision": models.SystemState.revision + 1,
            },
        ).returning(models.SystemState.revision)
        async with self._db() as session:
            revision = (await session.execute(stmt)).scalar_one()
        self._cache.put(key, revision, parsed)
        return parsed

    async def bootstrap(self) -> None:
        await self._fetch()

    async def _run(self) -> None:
        while self._running:
            try:
                await self._fetch()
            except Exception:
                logger.exception("Failed to refresh system_state")
            await sleep(self._refresh_interval_seconds)

    async def _fetch(self) -> None:
        # The table has no timestamp to filter on, so every poll reads all rows and
        # the cache keeps only revisions newer than the ones it holds.
        async with self._db() as session:
            rows = (await session.scalars(sa.select(models.SystemState))).all()

        for row in rows:
            current = self._cache.revision(row.key)
            if current is not None and current >= row.revision:
                continue
            model_cls = self._registry.get(row.key)
            if model_cls is None:
                logger.debug("Unknown state key in DB: %s — ignoring", row.key)
                continue
            try:
                self._cache.put(row.key, row.revision, model_cls.model_validate(row.value))
            except ValidationError as e:
                logger.error(
                    "Invalid value for state %s: %s — keeping last-known-good",
                    row.key,
                    e,
                )
