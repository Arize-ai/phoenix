"""Database leases for agent-session turns and transcript mutations."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.dialects.sqlite import insert as insert_sqlite
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect


@dataclass(frozen=True)
class SessionRun:
    agent_session_id: int
    turn_id: str
    state: str
    assistant_message_id: str | None
    origin_client_id: str | None
    instance_id: str
    stop_requested_at: datetime | None
    started_at: datetime
    heartbeat_at: datetime


def _to_session_run(row: models.AgentSessionRun) -> SessionRun:
    return SessionRun(
        agent_session_id=row.agent_session_id,
        turn_id=row.turn_id,
        state=row.state,
        assistant_message_id=row.assistant_message_id,
        origin_client_id=row.origin_client_id,
        instance_id=row.instance_id,
        stop_requested_at=row.stop_requested_at,
        started_at=row.started_at,
        heartbeat_at=row.heartbeat_at,
    )


async def claim_run(
    session: AsyncSession,
    *,
    agent_session_id: int,
    turn_id: str,
    state: str,
    assistant_message_id: str | None,
    origin_client_id: str | None,
    instance_id: str,
    allow_awaiting_continuation: bool = False,
    now: datetime | None = None,
    stale_after: timedelta = timedelta(seconds=30),
) -> SessionRun | None:
    """Atomically create a lease or replace a stale/continuable lease."""
    claimed_at = now or datetime.now(timezone.utc)
    values = {
        "agent_session_id": agent_session_id,
        "turn_id": turn_id,
        "state": state,
        "assistant_message_id": assistant_message_id,
        "origin_client_id": origin_client_id,
        "instance_id": instance_id,
        "stop_requested_at": None,
        "started_at": claimed_at,
        "heartbeat_at": claimed_at,
    }
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    statement: Any
    if dialect is SupportedSQLDialect.POSTGRESQL:
        statement = insert_postgresql(models.AgentSessionRun).values(**values)
    else:
        statement = insert_sqlite(models.AgentSessionRun).values(**values)
    can_take_over = models.AgentSessionRun.heartbeat_at < claimed_at - stale_after
    if allow_awaiting_continuation and assistant_message_id is not None:
        can_take_over |= (models.AgentSessionRun.state == "awaiting_client_tool") & (
            models.AgentSessionRun.assistant_message_id == assistant_message_id
        )
    statement = statement.on_conflict_do_update(
        index_elements=(models.AgentSessionRun.agent_session_id,),
        set_={key: getattr(statement.excluded, key) for key in values if key != "agent_session_id"},
        where=can_take_over,
    ).returning(models.AgentSessionRun)
    row = await session.scalar(statement)
    return _to_session_run(row) if row is not None else None


async def get_run(session: AsyncSession, *, agent_session_id: int) -> SessionRun | None:
    row = await session.scalar(
        select(models.AgentSessionRun).where(
            models.AgentSessionRun.agent_session_id == agent_session_id
        )
    )
    return _to_session_run(row) if row is not None else None


async def transition_run(
    session: AsyncSession,
    *,
    agent_session_id: int,
    instance_id: str,
    turn_id: str,
    state: str,
    assistant_message_id: str | None = None,
    now: datetime | None = None,
) -> SessionRun | None:
    values: dict[str, object] = {
        "state": state,
        "heartbeat_at": now or datetime.now(timezone.utc),
    }
    if assistant_message_id is not None:
        values["assistant_message_id"] = assistant_message_id
    row = await session.scalar(
        update(models.AgentSessionRun)
        .where(
            models.AgentSessionRun.agent_session_id == agent_session_id,
            models.AgentSessionRun.instance_id == instance_id,
            models.AgentSessionRun.turn_id == turn_id,
        )
        .values(**values)
        .returning(models.AgentSessionRun)
    )
    return _to_session_run(row) if row is not None else None


async def release_run(
    session: AsyncSession,
    *,
    agent_session_id: int,
    instance_id: str,
    turn_id: str,
) -> bool:
    released_id = await session.scalar(
        delete(models.AgentSessionRun)
        .where(
            models.AgentSessionRun.agent_session_id == agent_session_id,
            models.AgentSessionRun.instance_id == instance_id,
            models.AgentSessionRun.turn_id == turn_id,
        )
        .returning(models.AgentSessionRun.agent_session_id)
    )
    return released_id is not None


async def heartbeat_runs(
    session: AsyncSession,
    *,
    instance_id: str,
    now: datetime | None = None,
) -> list[SessionRun]:
    rows = await session.scalars(
        update(models.AgentSessionRun)
        .where(models.AgentSessionRun.instance_id == instance_id)
        .values(heartbeat_at=now or datetime.now(timezone.utc))
        .returning(models.AgentSessionRun)
    )
    return [_to_session_run(row) for row in rows]


async def request_stop(
    session: AsyncSession,
    *,
    agent_session_id: int,
    turn_id: str | None,
    now: datetime | None = None,
) -> SessionRun | None:
    statement = update(models.AgentSessionRun).where(
        models.AgentSessionRun.agent_session_id == agent_session_id
    )
    if turn_id is not None:
        statement = statement.where(models.AgentSessionRun.turn_id == turn_id)
    row = await session.scalar(
        statement.values(stop_requested_at=now or datetime.now(timezone.utc)).returning(
            models.AgentSessionRun
        )
    )
    return _to_session_run(row) if row is not None else None


async def delete_stale_runs(
    session: AsyncSession,
    *,
    instance_id: str,
    now: datetime | None = None,
    stale_after: timedelta = timedelta(seconds=30),
) -> list[int]:
    stale_before = (now or datetime.now(timezone.utc)) - stale_after
    return list(
        await session.scalars(
            delete(models.AgentSessionRun)
            .where(
                models.AgentSessionRun.instance_id != instance_id,
                models.AgentSessionRun.heartbeat_at < stale_before,
            )
            .returning(models.AgentSessionRun.agent_session_id)
        )
    )
