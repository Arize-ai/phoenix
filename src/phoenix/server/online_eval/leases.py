"""Single-holder leases for the online-eval materializers, timed by the database clock.

A lease is one row carrying the id of whoever holds it and the time that holder last
heartbeated. It can be taken when unheld, when already held by the same holder, or once
the heartbeat has gone stale. Every timestamp is read from the database through the
session, so replicas whose wall clocks disagree still agree on when a lease lapsed and
on whether the holder about to commit still holds it.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable, Optional, Sequence

from sqlalchemy import ColumnElement, func, or_, select, type_coerce, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.types import DbSessionFactory


class LeaseLost(Exception):
    """The lease is no longer held, so its holder must not commit the work in hand."""


class DatabaseLease:
    """A single-holder lease on one database row.

    Args:
        entity: The mapped class the lease row belongs to.
        key: Predicate selecting the one row that carries this lease.
        holder_column: Column holding the id of the current holder, null when unheld.
        heartbeat_column: Column holding the time the holder last heartbeated.
        holder_id: Id this instance claims the lease under.
        ttl_seconds: How long a heartbeat keeps the lease before another holder may
            take it.
    """

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        entity: type[models.HasId],
        key: Sequence[ColumnElement[bool]],
        holder_column: InstrumentedAttribute[Optional[str]],
        heartbeat_column: InstrumentedAttribute[Optional[datetime]],
        holder_id: str,
        ttl_seconds: float,
    ) -> None:
        self._db = db
        self._entity = entity
        self._key = tuple(key)
        self._holder_column = holder_column
        self._heartbeat_column = heartbeat_column
        self._holder_id = holder_id
        self._ttl = timedelta(seconds=ttl_seconds)
        self._held = False

    @property
    def held(self) -> bool:
        """Whether the last lease operation left this holder holding the lease."""
        return self._held

    @property
    def held_by_me(self) -> tuple[ColumnElement[bool], ...]:
        """Predicate matching the lease row only while this holder still holds it.

        Fuse it into a statement whose effect must not outlive the lease: once another
        holder has taken over, the statement matches nothing.
        """
        return (*self._key, self._holder_column == self._holder_id)

    async def database_now(self, session: AsyncSession) -> datetime:
        """Read the database's current time through ``session``.

        PostgreSQL reads ``statement_timestamp()`` rather than ``now()``, which is the
        transaction's start time and would not advance as a transaction runs.
        """
        clock = (
            func.statement_timestamp()
            if self._db.dialect is SupportedSQLDialect.POSTGRESQL
            else func.now()
        )
        now = await session.scalar(select(type_coerce(clock, models.UtcTimeStamp())))
        if now is None:
            raise RuntimeError("Database did not return its current time")
        return now

    async def acquire(
        self,
        returning: Any,
        *,
        bootstrap: Optional[Callable[[AsyncSession], Awaitable[None]]] = None,
    ) -> Optional[Any]:
        """Take the lease, returning ``returning`` from its row, or None if another
        holder has it.

        ``bootstrap`` creates the lease row when it is absent; without one, a missing
        row means the lease cannot be taken.
        """
        for _ in range(2):
            async with self._db() as session:
                now = await self.database_now(session)
                taken = await session.scalar(
                    update(self._entity)
                    .where(
                        *self._key,
                        or_(
                            self._holder_column.is_(None),
                            self._holder_column == self._holder_id,
                            self._heartbeat_column < now - self._ttl,
                        ),
                    )
                    .values(
                        {
                            self._holder_column: self._holder_id,
                            self._heartbeat_column: now,
                        }
                    )
                    .returning(returning)
                )
            if taken is not None:
                self._held = True
                return taken
            async with self._db() as session:
                row_exists = await session.scalar(select(self._entity.id).where(*self._key))
                if row_exists is not None or bootstrap is None:
                    break
                await bootstrap(session)
        self._held = False
        return None

    async def renew(self) -> None:
        """Heartbeat the lease in a transaction of its own.

        Raises:
            LeaseLost: Another holder has taken the lease.
        """
        async with self._db() as session:
            await self.fence(session)

    async def fence(self, session: AsyncSession) -> None:
        """Heartbeat the lease inside the caller's transaction.

        Work staged in ``session`` may be committed only once this has returned: the
        heartbeat and that work then stand or fall together.

        Raises:
            LeaseLost: Another holder has taken the lease.
        """
        renewed = await session.scalar(
            update(self._entity)
            .where(*self.held_by_me)
            .values({self._heartbeat_column: await self.database_now(session)})
            .returning(self._entity.id)
        )
        if renewed is None:
            self.record_loss()
            raise LeaseLost

    def record_loss(self) -> None:
        """Note that the lease is gone, for callers that recover rather than abort."""
        self._held = False

    async def release(self) -> None:
        """Hand the lease back so the next holder need not wait out the TTL."""
        if not self._held:
            return
        self._held = False
        async with self._db() as session:
            await session.execute(
                update(self._entity)
                .where(*self.held_by_me)
                .values({self._holder_column: None, self._heartbeat_column: None})
            )

