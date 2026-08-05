from collections.abc import Iterable
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect


async def advance_project_session_liveness(
    session: AsyncSession,
    project_session_rowids: Iterable[int],
    *,
    seen_at: datetime | None = None,
) -> None:
    """Advance each session's span-ingest watermark without allowing regression."""
    rowids = tuple(dict.fromkeys(project_session_rowids))
    if not rowids:
        return

    dialect = SupportedSQLDialect(session.bind.dialect.name)
    if seen_at is None:
        if dialect is SupportedSQLDialect.POSTGRESQL:
            seen_at = await session.scalar(
                select(func.statement_timestamp(type_=models.UtcTimeStamp()))
            )
            if seen_at is None:
                raise RuntimeError("Database statement timestamp is unavailable")
        elif dialect is SupportedSQLDialect.SQLITE:
            seen_at = datetime.now(timezone.utc)
        else:
            assert_never(dialect)

    if dialect is SupportedSQLDialect.POSTGRESQL:
        value = func.greatest(models.ProjectSession.last_span_seen_at, seen_at)
    elif dialect is SupportedSQLDialect.SQLITE:
        value = func.max(models.ProjectSession.last_span_seen_at, seen_at)
    else:
        assert_never(dialect)

    await session.execute(
        update(models.ProjectSession)
        .where(models.ProjectSession.id.in_(rowids))
        .values(last_span_seen_at=value)
    )
