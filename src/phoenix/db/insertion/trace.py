from collections.abc import Iterable
from datetime import datetime, timezone

from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect


async def advance_trace_liveness(
    session: AsyncSession,
    trace_rowids: Iterable[int],
) -> None:
    """Advance each trace's span-ingest watermark without allowing regression."""
    rowids = tuple(dict.fromkeys(trace_rowids))
    if not rowids:
        return

    dialect = SupportedSQLDialect(session.bind.dialect.name)
    if dialect is SupportedSQLDialect.POSTGRESQL:
        value = func.greatest(
            models.Trace.last_span_ingested_at,
            func.statement_timestamp(type_=models.UtcTimeStamp()),
        )
    elif dialect is SupportedSQLDialect.SQLITE:
        ingested_at = datetime.now(timezone.utc)
        value = func.max(
            func.coalesce(models.Trace.last_span_ingested_at, ingested_at),
            ingested_at,
        )
    else:
        assert_never(dialect)

    await session.execute(
        update(models.Trace).where(models.Trace.id.in_(rowids)).values(last_span_ingested_at=value)
    )
