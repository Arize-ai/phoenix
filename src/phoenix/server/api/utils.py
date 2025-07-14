from datetime import datetime, timedelta
from typing import Iterator, Literal

from sqlalchemy import delete
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


async def delete_projects(
    db: DbSessionFactory,
    *project_names: str,
) -> list[int]:
    if not project_names:
        return []
    stmt = (
        delete(models.Project)
        .where(models.Project.name.in_(set(project_names)))
        .returning(models.Project.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


async def delete_traces(
    db: DbSessionFactory,
    *trace_ids: str,
) -> list[int]:
    if not trace_ids:
        return []
    stmt = (
        delete(models.Trace)
        .where(models.Trace.trace_id.in_(set(trace_ids)))
        .returning(models.Trace.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))


def get_timestamp_range(
    start_time: datetime,
    end_time: datetime,
    stride: Literal["minute", "hour", "day", "week", "month", "year"] = "minute",
    utc_offset_minutes: int = 0,
) -> Iterator[datetime]:
    # round down start_time to the nearest stride
    if stride == "minute":
        t = start_time.replace(second=0, microsecond=0)
    elif stride == "hour":
        t = start_time.replace(minute=0, second=0, microsecond=0)
    elif stride == "day":
        t = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
    elif stride == "week":
        raise NotImplementedError("Week stride is not implemented yet.")
    elif stride == "month":
        t = start_time.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif stride == "year":
        t = start_time.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        assert_never(stride)

    while t < end_time:
        yield t
        if stride == "minute":
            t += timedelta(minutes=1)
        elif stride == "hour":
            t += timedelta(hours=1)
        elif stride == "day":
            t += timedelta(days=1)
        elif stride == "week":
            t += timedelta(weeks=1)
        elif stride == "month":
            next_month = t.month % 12 + 1
            next_year = t.year + (t.month // 12)
            t = t.replace(
                year=next_year, month=next_month, day=1, hour=0, minute=0, second=0, microsecond=0
            )
        elif stride == "year":
            t = t.replace(
                year=t.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0
            )
        else:
            assert_never(stride)
