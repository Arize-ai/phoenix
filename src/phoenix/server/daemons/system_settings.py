from __future__ import annotations

import logging
from asyncio import sleep
from datetime import datetime, timedelta, timezone
from typing import Literal, Mapping, Optional, overload

import sqlalchemy as sa
from pydantic import BaseModel, ValidationError

from phoenix.db import models
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.db.models import SystemSettingKey
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.settings.registry import (
    SETTINGS_REGISTRY,
    AgentAssistantEnabledSetting,
    AgentSessionRetentionSetting,
    AgentTraceRecordingSetting,
)
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)


class _SettingsCache:
    """Typed in-memory store for system_settings.

    Each ``SystemSettingKey`` is bound to a concrete model class by
    ``SETTINGS_REGISTRY``; the ``get`` overloads encode that mapping so
    callers don't need ``cast``.
    """

    def __init__(self) -> None:
        self._data: dict[SystemSettingKey, BaseModel] = {}

    @overload
    def get(
        self, key: Literal["agent.assistant.trace_recording"]
    ) -> Optional[AgentTraceRecordingSetting]: ...
    @overload
    def get(
        self, key: Literal["agent.assistant.enabled"]
    ) -> Optional[AgentAssistantEnabledSetting]: ...
    @overload
    def get(
        self, key: Literal["agent.assistant.session_retention"]
    ) -> Optional[AgentSessionRetentionSetting]: ...
    def get(self, key: SystemSettingKey) -> Optional[BaseModel]:
        return self._data.get(key)

    def __setitem__(self, key: SystemSettingKey, value: BaseModel) -> None:
        self._data[key] = value


class SystemSettings(DaemonTask):
    """In-memory cache of system_settings — kept fresh by polling and write-through."""

    _DEFAULT_OVERLAP = timedelta(seconds=10)

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        registry: Mapping[SystemSettingKey, type[BaseModel]] = SETTINGS_REGISTRY,
        refresh_interval_seconds: int = 30,
        overlap_window: timedelta = _DEFAULT_OVERLAP,
    ) -> None:
        super().__init__()
        self._db = db
        self._registry = registry
        self._cache = _SettingsCache()
        self._last_poll_at: Optional[datetime] = None
        self._refresh_interval_seconds = refresh_interval_seconds
        self._overlap_window = overlap_window

    @property
    def agent_trace_recording(self) -> AgentTraceRecordingSetting:
        return self._cache.get("agent.assistant.trace_recording") or AgentTraceRecordingSetting()

    async def update_agent_trace_recording(
        self,
        value: AgentTraceRecordingSetting,
        *,
        user_id: Optional[int] = None,
    ) -> None:
        await self._set("agent.assistant.trace_recording", value, user_id=user_id)

    @property
    def agent_assistant_enabled(self) -> AgentAssistantEnabledSetting:
        return self._cache.get("agent.assistant.enabled") or AgentAssistantEnabledSetting()

    async def update_agent_assistant_enabled(
        self,
        value: AgentAssistantEnabledSetting,
        *,
        user_id: Optional[int] = None,
    ) -> None:
        await self._set("agent.assistant.enabled", value, user_id=user_id)

    @property
    def agent_session_retention(self) -> AgentSessionRetentionSetting:
        return self._cache.get("agent.assistant.session_retention") or (
            AgentSessionRetentionSetting()
        )

    async def update_agent_session_retention(
        self,
        value: AgentSessionRetentionSetting,
        *,
        user_id: Optional[int] = None,
    ) -> None:
        await self._set("agent.assistant.session_retention", value, user_id=user_id)

    async def _set(
        self,
        key: SystemSettingKey,
        value: BaseModel,
        *,
        user_id: Optional[int] = None,
    ) -> BaseModel:
        model_cls = self._registry.get(key)
        if model_cls is None:
            raise BadRequest(f"Unknown setting: {key}")
        try:
            parsed = model_cls.model_validate(value)
        except ValidationError as e:
            raise BadRequest(str(e)) from e
        payload = parsed.model_dump(mode="json")
        stmt = insert_on_conflict(
            {"key": key, "value": payload, "updated_by": user_id},
            table=models.SystemSetting,
            dialect=self._db.dialect,
            unique_by=("key",),
            constraint_name="pk_system_settings",
            set_={
                "value": payload,
                "updated_by": user_id,
                "updated_at": sa.func.now(),
            },
        )
        async with self._db() as session:
            await session.execute(stmt)
        self._cache[key] = parsed
        return parsed

    async def bootstrap(self) -> None:
        await self._fetch()

    async def _run(self) -> None:
        while self._running:
            try:
                await self._fetch()
            except Exception:
                logger.exception("Failed to refresh system_settings")
            await sleep(self._refresh_interval_seconds)

    async def _fetch(self) -> None:
        now = datetime.now(timezone.utc)
        cursor: Optional[datetime] = None
        if self._last_poll_at is not None:
            cursor = self._last_poll_at - self._overlap_window

        stmt = sa.select(models.SystemSetting)
        if cursor is not None:
            stmt = stmt.where(models.SystemSetting.updated_at >= cursor)
        async with self._db() as session:
            rows = (await session.scalars(stmt)).all()

        for row in rows:
            model_cls = self._registry.get(row.key)
            if model_cls is None:
                logger.warning("Unknown setting key in DB: %s — ignoring", row.key)
                continue
            try:
                self._cache[row.key] = model_cls.model_validate(row.value)
            except ValidationError as e:
                logger.error(
                    "Invalid value for setting %s: %s — keeping last-known-good",
                    row.key,
                    e,
                )
        self._last_poll_at = now
