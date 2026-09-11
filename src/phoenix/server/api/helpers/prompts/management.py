"""Persist prompt version tags within caller-owned transactions."""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.identifier import Identifier


async def upsert_prompt_version_tag(
    session: AsyncSession,
    prompt_id: int,
    prompt_version_id: int,
    name: Identifier,
    description: Optional[str] = None,
    user_id: Optional[int] = None,
) -> models.PromptVersionTag:
    """Create or retarget a tag within the caller's transaction."""
    existing_tag = await session.scalar(
        select(models.PromptVersionTag).where(
            models.PromptVersionTag.prompt_id == prompt_id,
            models.PromptVersionTag.name == name,
        )
    )

    if existing_tag:
        existing_tag.prompt_version_id = prompt_version_id
        if description is not None:
            existing_tag.description = description
        return existing_tag
    else:
        new_tag = models.PromptVersionTag(
            name=name,
            description=description,
            prompt_id=prompt_id,
            prompt_version_id=prompt_version_id,
            user_id=user_id,
        )
        session.add(new_tag)
        return new_tag
