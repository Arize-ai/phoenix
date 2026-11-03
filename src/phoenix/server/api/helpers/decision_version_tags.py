"""Shared write helpers for decision version tags."""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.identifier import Identifier


async def upsert_decision_version_tag(
    session: AsyncSession,
    *,
    decision_id: int,
    decision_version_id: int,
    name: Identifier,
    description: Optional[str],
    user_id: Optional[int],
) -> models.DecisionVersionTag:
    """Create the tag, or move it to the version if the decision already has it.

    Moving a tag keeps its description unless a new one is given.
    """
    tag = await session.scalar(
        select(models.DecisionVersionTag).where(
            models.DecisionVersionTag.decision_id == decision_id,
            models.DecisionVersionTag.name == name,
        )
    )
    if tag is None:
        tag = models.DecisionVersionTag(
            name=name,
            description=description,
            decision_id=decision_id,
            decision_version_id=decision_version_id,
            user_id=user_id,
        )
        session.add(tag)
    else:
        tag.decision_version_id = decision_version_id
        if description is not None:
            tag.description = description
    await session.flush()
    return tag
