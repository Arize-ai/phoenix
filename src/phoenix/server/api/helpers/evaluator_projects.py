"""Utilities for managing evaluator-specific projects."""

from typing import Optional, overload

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models


@overload
async def get_or_create_evaluator_project(
    session: AsyncSession,
    evaluator_id: int,
    builtin_evaluator_id: None,
    evaluator_name: str,
) -> int: ...


@overload
async def get_or_create_evaluator_project(
    session: AsyncSession,
    evaluator_id: None,
    builtin_evaluator_id: int,
    evaluator_name: str,
) -> int: ...


async def get_or_create_evaluator_project(
    session: AsyncSession,
    evaluator_id: Optional[int],
    builtin_evaluator_id: Optional[int],
    evaluator_name: str,
) -> int:
    """
    Get or create a project for the evaluator.

    The project name will be the same as the evaluator name.
    Creates an EvaluatorsProjects link if one doesn't exist.

    Args:
        evaluator_id: Database evaluator ID (or None for builtin)
        builtin_evaluator_id: Builtin evaluator ID (or None for DB evaluator)
        evaluator_name: Name of the evaluator (used as project name)

    Returns:
        Project ID for the evaluator
    """
    # Check if evaluator already has a linked project
    if evaluator_id is not None:
        existing_link = await session.scalar(
            select(models.EvaluatorsProjects).where(
                models.EvaluatorsProjects.evaluator_id == evaluator_id
            )
        )
    else:
        existing_link = await session.scalar(
            select(models.EvaluatorsProjects).where(
                models.EvaluatorsProjects.builtin_evaluator_id == builtin_evaluator_id
            )
        )

    if existing_link:
        return existing_link.project_id

    # Get or create project with evaluator's name
    project_id = await session.scalar(
        select(models.Project.id).where(models.Project.name == evaluator_name)
    )

    if project_id is None:
        # Create new project with evaluator's name
        project_id = await session.scalar(
            insert(models.Project)
            .values(
                name=evaluator_name,
                description=f"Traces for evaluator: {evaluator_name}",
            )
            .returning(models.Project.id)
        )

    # Create the evaluator-project link
    await session.execute(
        insert(models.EvaluatorsProjects).values(
            evaluator_id=evaluator_id,
            builtin_evaluator_id=builtin_evaluator_id,
            project_id=project_id,
        )
    )
    await session.flush()

    return project_id


@overload
async def get_evaluator_project_id(
    session: AsyncSession,
    evaluator_id: int,
    builtin_evaluator_id: None,
) -> Optional[int]: ...


@overload
async def get_evaluator_project_id(
    session: AsyncSession,
    evaluator_id: None,
    builtin_evaluator_id: int,
) -> Optional[int]: ...


async def get_evaluator_project_id(
    session: AsyncSession,
    evaluator_id: Optional[int],
    builtin_evaluator_id: Optional[int],
) -> Optional[int]:
    """Get the project ID for an evaluator if it exists."""
    if evaluator_id is not None:
        link = await session.scalar(
            select(models.EvaluatorsProjects).where(
                models.EvaluatorsProjects.evaluator_id == evaluator_id
            )
        )
    else:
        link = await session.scalar(
            select(models.EvaluatorsProjects).where(
                models.EvaluatorsProjects.builtin_evaluator_id == builtin_evaluator_id
            )
        )

    return link.project_id if link else None
