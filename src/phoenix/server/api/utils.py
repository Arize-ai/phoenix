from sqlalchemy import delete, select

from phoenix.db import models
from phoenix.db.helpers import delete_projects_and_evaluator_trace_projects
from phoenix.server.types import DbSessionFactory


async def delete_projects(
    db: DbSessionFactory,
    *project_names: str,
) -> list[int]:
    if not project_names:
        return []
    async with db() as session:
        project_ids = (
            await session.scalars(
                select(models.Project.id).where(models.Project.name.in_(set(project_names)))
            )
        ).all()
        await delete_projects_and_evaluator_trace_projects(session, project_ids)
        return list(project_ids)


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
