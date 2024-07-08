from typing import AsyncContextManager, Callable

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models


async def delete_projects(
    db: Callable[[], AsyncContextManager[AsyncSession]],
    *project_names: str,
) -> None:
    if not project_names:
        return
    stmt = delete(models.Project).where(models.Project.name.in_(set(project_names)))
    try:
        async with db() as session:
            await session.execute(stmt)
    except BaseException:
        pass


async def delete_traces(
    db: Callable[[], AsyncContextManager[AsyncSession]],
    *trace_ids: str,
) -> None:
    if not trace_ids:
        return
    stmt = delete(models.Trace).where(models.Trace.trace_id.in_(set(trace_ids)))
    try:
        async with db() as session:
            await session.execute(stmt)
    except BaseException:
        pass
