"""Shared write helpers for decision version tags, used by the REST and GraphQL APIs."""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError as PostgreSQLIntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]

from phoenix.db import models
from phoenix.db.types.identifier import Identifier


async def _find_tag(
    session: AsyncSession, *, decision_id: int, name: Identifier
) -> Optional[models.DecisionVersionTag]:
    return await session.scalar(
        select(models.DecisionVersionTag).where(
            models.DecisionVersionTag.decision_id == decision_id,
            models.DecisionVersionTag.name == name,
        )
    )


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
    tag, _ = await set_decision_version_tag(
        session,
        decision_id=decision_id,
        decision_version_id=decision_version_id,
        name=name,
        description=description,
        user_id=user_id,
    )
    return tag


async def set_decision_version_tag(
    session: AsyncSession,
    *,
    decision_id: int,
    decision_version_id: int,
    name: Identifier,
    description: Optional[str],
    user_id: Optional[int],
) -> tuple[models.DecisionVersionTag, bool]:
    """Like :func:`upsert_decision_version_tag`, and also whether the tag was created
    (``True``) rather than moved."""
    tag = await _find_tag(session, decision_id=decision_id, name=name)
    if tag is None:
        new_tag = models.DecisionVersionTag(
            name=name,
            description=description,
            decision_id=decision_id,
            decision_version_id=decision_version_id,
            user_id=user_id,
        )
        try:
            async with session.begin_nested():
                session.add(new_tag)
            return new_tag, True
        except (PostgreSQLIntegrityError, SQLiteIntegrityError):
            # A concurrent request created the tag first: move that one instead.
            tag = await _find_tag(session, decision_id=decision_id, name=name)
            if tag is None:
                raise
    tag.decision_version_id = decision_version_id
    if description is not None:
        tag.description = description
    await session.flush()
    return tag, False
