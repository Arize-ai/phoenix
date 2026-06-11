from sqlalchemy import delete, select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


async def delete_projects(
    db: DbSessionFactory,
    *project_names: str,
) -> list[int]:
    if not project_names:
        return []
    names = set(project_names)
    async with db() as session:
        ids = list(
            await session.scalars(select(models.Project.id).where(models.Project.name.in_(names)))
        )
        await session.execute(delete(models.Project).where(models.Project.name.in_(names)))
        return ids


async def delete_traces(
    db: DbSessionFactory,
    *trace_ids: str,
) -> list[int]:
    if not trace_ids:
        return []
    ids = set(trace_ids)
    async with db() as session:
        rowids = list(
            await session.scalars(select(models.Trace.id).where(models.Trace.trace_id.in_(ids)))
        )
        await session.execute(delete(models.Trace).where(models.Trace.trace_id.in_(ids)))
        return rowids
