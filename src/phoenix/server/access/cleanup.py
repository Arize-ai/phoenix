from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models


async def delete_object_grants(session: AsyncSession, object_type: str, object_id: int) -> None:
    """Remove grants that name one concrete object.

    ACL object references are polymorphic (object_type, object_id), so the database
    cannot enforce an ON DELETE CASCADE to projects/datasets/prompts. Type-wide grants
    intentionally remain: deleting one project must not remove "all projects" access.
    """
    await session.execute(
        delete(models.AccessGrant).where(
            models.AccessGrant.object_type == object_type,
            models.AccessGrant.object_id == object_id,
            models.AccessGrant.selector_kind == "ids",
        )
    )


async def delete_object_tags(session: AsyncSession, object_type: str, object_id: int) -> None:
    """Remove the curated tags of one concrete object.

    Like ACL references, ResourceTag references are polymorphic (object_type,
    object_id), so no ON DELETE CASCADE fires when the object is deleted — its tags
    must be swept explicitly, alongside :func:`delete_object_grants`, on the same
    delete path and in the same transaction. Without this, a later object that reused
    the freed id would inherit the stale tags (and any tag grant matching them). Tag
    *grants* need no sweep: they carry the key/value as strings, not a FK to a tag
    row, so a removed tag simply stops matching.
    """
    await session.execute(
        delete(models.ResourceTag).where(
            models.ResourceTag.object_type == object_type,
            models.ResourceTag.object_id == object_id,
        )
    )
