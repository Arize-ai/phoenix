"""
Experiment tags: dataset-scoped, movable pointers to a single experiment.

``experiment_tags`` carries a ``UNIQUE (dataset_id, name)`` constraint, so at most
one experiment per dataset owns a given tag name at a time. These helpers hold the
resulting invariants in one place so that every surface that writes tags — the
GraphQL ``setExperimentBaseline`` mutation and the v1 REST routes — behaves
identically. The reserved ``baseline`` name backs ``Experiment.isBaseline`` and
``Dataset.baselineExperiment``.
"""

from typing import Optional

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import insert_on_conflict

BASELINE_EXPERIMENT_TAG_NAME = "baseline"


async def upsert_experiment_tag(
    session: AsyncSession,
    *,
    experiment: models.Experiment,
    name: str,
    description: Optional[str],
    user_id: Optional[int],
    dialect: SupportedSQLDialect,
) -> None:
    """
    Point the tag `name` at `experiment`, recording `user_id` as its author.

    Because the tag name is unique per dataset, this moves the tag off whichever
    experiment on the same dataset currently owns it rather than creating a
    second row.
    """
    await session.execute(
        insert_on_conflict(
            {
                "experiment_id": experiment.id,
                "dataset_id": experiment.dataset_id,
                "user_id": user_id,
                "name": name,
                "description": description,
            },
            table=models.ExperimentTag,
            dialect=dialect,
            unique_by=("dataset_id", "name"),
            set_={
                "experiment_id": experiment.id,
                "user_id": user_id,
                "description": description,
            },
        )
    )


async def remove_experiment_tag(
    session: AsyncSession,
    *,
    experiment: models.Experiment,
    name: str,
) -> None:
    """
    Remove the tag `name` from `experiment`, but only if `experiment` owns it.

    Removing a tag the experiment does not own is a no-op, which keeps removal
    idempotent and stops one experiment from clearing another's tag.
    """
    await session.execute(
        delete(models.ExperimentTag)
        .where(models.ExperimentTag.dataset_id == experiment.dataset_id)
        .where(models.ExperimentTag.name == name)
        .where(models.ExperimentTag.experiment_id == experiment.id)
    )
