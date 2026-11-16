"""The project that collects playground traces, shared by chat and decision runs."""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.cleanup_tasks import live_row_predicate
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict

PLAYGROUND_PROJECT_DESCRIPTION = "Traces from prompt playground"


async def get_or_create_playground_project_id(session: AsyncSession) -> int:
    """Row id of the playground project, inserting it when missing.

    The insert ignores a name conflict, so concurrent first runs cannot race
    each other into a unique-constraint failure.

    Args:
        session: An open database session; the insert joins its transaction.

    Returns:
        The playground project's primary key.
    """
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    await session.execute(
        insert_on_conflict(
            {
                "name": PLAYGROUND_PROJECT_NAME,
                "description": PLAYGROUND_PROJECT_DESCRIPTION,
                "kind": "PLAYGROUND",
            },
            table=models.Project,
            dialect=dialect,
            unique_by=("name",),
            on_conflict=OnConflict.DO_NOTHING,
            index_where=text(live_row_predicate()),
        )
    )
    project_id = await session.scalar(
        select(models.Project.id).where(
            models.Project.name == PLAYGROUND_PROJECT_NAME,
            models.Project.deleted_at.is_(None),
        )
    )
    assert project_id is not None
    return project_id
