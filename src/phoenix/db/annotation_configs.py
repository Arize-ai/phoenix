"""Database helpers for app-owned annotation configurations."""

from collections.abc import Collection

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict

USER_FEEDBACK_ANNOTATION_NAME = "user_feedback"
USER_FEEDBACK_ANNOTATION_CONFIG_IMMUTABLE_MESSAGE = (
    "The built-in user_feedback annotation config cannot be updated or deleted."
)


async def ensure_user_feedback_config_is_assigned_to_projects(
    session: AsyncSession,
    project_ids: Collection[int],
) -> None:
    """Assign the app-owned user feedback config to the given projects.

    Args:
        session: Open database session containing the annotation write.
        project_ids: Projects receiving a user feedback annotation.
    """
    if not project_ids:
        return
    annotation_config_id = await session.scalar(
        select(models.AnnotationConfig.id).where(
            models.AnnotationConfig.name == USER_FEEDBACK_ANNOTATION_NAME
        )
    )
    if annotation_config_id is None:
        raise RuntimeError("The built-in user feedback annotation config is missing")
    records = [
        {
            "project_id": project_id,
            "annotation_config_id": annotation_config_id,
        }
        for project_id in set(project_ids)
    ]
    await session.execute(
        insert_on_conflict(
            *records,
            dialect=SupportedSQLDialect(session.bind.dialect.name),
            table=models.ProjectAnnotationConfig,
            unique_by=("project_id", "annotation_config_id"),
            on_conflict=OnConflict.DO_NOTHING,
        )
    )
