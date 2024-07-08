from typing import AsyncContextManager, Callable, List

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models


async def delete_projects(
    db: Callable[[], AsyncContextManager[AsyncSession]],
    *project_names: str,
) -> List[int]:
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
    db: Callable[[], AsyncContextManager[AsyncSession]],
    *trace_ids: str,
) -> List[int]:
    if not trace_ids:
        return []
    stmt = (
        delete(models.Trace)
        .where(models.Trace.trace_id.in_(set(trace_ids)))
        .returning(models.Trace.id)
    )
    async with db() as session:
        return list(await session.scalars(stmt))
