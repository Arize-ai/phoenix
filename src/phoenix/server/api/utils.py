from sqlalchemy import select

from phoenix.db import models
from phoenix.db.helpers import delete_projects as delete_project_rows
from phoenix.db.helpers import delete_traces as delete_traces_and_stand_down
from phoenix.server.types import DbSessionFactory


async def delete_projects(
    db: DbSessionFactory,
    *project_names: str,
) -> list[int]:
    if not project_names:
        return []
    async with db() as session:
        return await delete_project_rows(
            session,
            models.Project.name.in_(set(project_names)),
        )


async def delete_traces(
    db: DbSessionFactory,
    *trace_ids: str,
) -> list[int]:
    if not trace_ids:
        return []
    trace_filter = models.Trace.trace_id.in_(set(trace_ids))
    async with db() as session:
        deleted = list(await session.scalars(select(models.Trace.id).where(trace_filter)))
        await delete_traces_and_stand_down(session, trace_filter)
        return deleted
