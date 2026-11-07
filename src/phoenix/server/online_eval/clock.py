"""Database time, and the time windows several online-eval modules share."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import func, select, type_coerce
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect

VISIBILITY_LAG_SECONDS = 60.0
"""How long a span id or activity time is given to become visible before a producer relies
on it: the span producer scans up to a high water once it is this old, and the sweeping
producers re-read this far behind their sweep positions."""

TERMINAL_METRICS_WINDOW_SECONDS = 86_400.0
"""Metrics over finished work read only rows that finished within this window; trace and
session work is never deleted, so all-time totals would grow without bound."""


async def current_database_time(session: AsyncSession, dialect: SupportedSQLDialect) -> datetime:
    if dialect is SupportedSQLDialect.POSTGRESQL:
        clock = func.statement_timestamp()
    else:
        clock = func.strftime("%Y-%m-%d %H:%M:%f", "now")
    now: Optional[datetime] = await session.scalar(
        select(type_coerce(clock, models.UtcTimeStamp()))
    )
    if now is None:
        raise RuntimeError("Database did not return its current time")
    return now
