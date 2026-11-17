"""Synchronize the in-memory builtin evaluator registry to the database."""

import logging

from sqlalchemy import delete, func, select

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.types.annotation_configs import OutputConfigType
from phoenix.db.types.identifier import Identifier
from phoenix.server.cleanup.lifecycle import (
    _lock_projects,
    logical_delete_dataset_evaluators,
    logical_delete_project_evaluators,
)
from phoenix.server.evaluators.runtime.builtin import get_builtin_evaluators
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)

# Distinct from cleanup admission (0x636C6E705F717565) and model costs (0x70686F656E6978).
_BUILTIN_EVALUATOR_SYNC_LOCK_ID = 0x626C746E5F65766C  # "bltn_evl"


async def sync_builtin_evaluators(db: DbSessionFactory) -> None:
    """
    Synchronize the in-memory builtin evaluator registry to the database.

    This function:
    1. Creates or updates builtin evaluators using ORM (handles inheritance)
    2. Removes any stale evaluators no longer in the registry

    Safe to call multiple times (idempotent) and concurrently across replicas.
    """
    dialect = SupportedSQLDialect(db.dialect.value)
    current_keys: set[str] = set()

    async with db() as session:
        if dialect is SupportedSQLDialect.POSTGRESQL:
            await session.execute(
                select(func.pg_advisory_xact_lock(_BUILTIN_EVALUATOR_SYNC_LOCK_ID))
            )

        for key, evaluator_cls in get_builtin_evaluators():
            current_keys.add(key)

            evaluator = evaluator_cls()
            output_cfgs: list[OutputConfigType] = list(evaluator.output_configs)

            existing = await session.scalar(
                select(models.BuiltinEvaluator).where(models.BuiltinEvaluator.key == key)
            )

            if existing:
                existing.name = Identifier(evaluator_cls.name)
                existing.description = evaluator_cls.description
                existing.input_schema = evaluator.input_schema
                existing.output_configs = output_cfgs
            else:
                new_evaluator = models.BuiltinEvaluator(
                    name=Identifier(evaluator_cls.name),
                    description=evaluator_cls.description,
                    metadata_={},
                    user_id=None,
                    key=key,
                    input_schema=evaluator.input_schema,
                    output_configs=output_cfgs,
                )
                session.add(new_evaluator)

        await session.flush()

    if current_keys:
        async with db() as session:
            if dialect is SupportedSQLDialect.POSTGRESQL:
                await session.execute(
                    select(func.pg_advisory_xact_lock(_BUILTIN_EVALUATOR_SYNC_LOCK_ID))
                )

            stale_ids = sorted(
                await session.scalars(
                    select(models.BuiltinEvaluator.id).where(
                        models.BuiltinEvaluator.key.notin_(current_keys)
                    )
                )
            )

            if stale_ids:
                dataset_binding_rows = (
                    await session.execute(
                        select(
                            models.DatasetEvaluators.id,
                            models.DatasetEvaluators.dataset_id,
                            models.DatasetEvaluators.project_id,
                        ).where(
                            models.DatasetEvaluators.evaluator_id.in_(stale_ids),
                            models.DatasetEvaluators.deleted_at.is_(None),
                        )
                    )
                ).all()
                project_binding_rows = (
                    await session.execute(
                        select(
                            models.ProjectEvaluator.id,
                            models.ProjectEvaluator.project_id,
                            models.ProjectEvaluator.trace_project_id,
                        ).where(
                            models.ProjectEvaluator.evaluator_id.in_(stale_ids),
                            models.ProjectEvaluator.deleted_at.is_(None),
                        )
                    )
                ).all()

                dataset_ids = sorted(
                    {
                        int(row.dataset_id)
                        for row in dataset_binding_rows
                        if row.dataset_id is not None
                    }
                )
                if dataset_ids and dialect is SupportedSQLDialect.POSTGRESQL:
                    await session.execute(
                        select(models.Dataset.id)
                        .where(models.Dataset.id.in_(dataset_ids))
                        .order_by(models.Dataset.id.asc())
                        .with_for_update(key_share=True)
                    )

                all_project_ids = {int(row.project_id) for row in dataset_binding_rows} | {
                    project_id
                    for row in project_binding_rows
                    for project_id in (int(row.project_id), int(row.trace_project_id))
                }
                await _lock_projects(session, dialect, all_project_ids, key_share=True)

                if dialect is SupportedSQLDialect.POSTGRESQL:
                    await session.execute(
                        select(models.Evaluator.id)
                        .where(
                            models.Evaluator.kind == "BUILTIN",
                            models.Evaluator.id.in_(stale_ids),
                        )
                        .order_by(models.Evaluator.id.asc())
                        .with_for_update()
                    )

                await logical_delete_dataset_evaluators(
                    session,
                    dialect=dialect,
                    binding_ids=[int(row.id) for row in dataset_binding_rows],
                    collect_unused_evaluator=False,
                    collect_unused_prompt_or_decision=False,
                )
                await logical_delete_project_evaluators(
                    session,
                    dialect=dialect,
                    binding_ids=[int(row.id) for row in project_binding_rows],
                    collect_unused_evaluator=False,
                    collect_unused_prompt_or_decision=False,
                )
                delete_stmt = delete(models.Evaluator).where(
                    models.Evaluator.kind == "BUILTIN",
                    models.Evaluator.id.in_(stale_ids),
                    ~select(models.DatasetEvaluators.id)
                    .where(
                        models.DatasetEvaluators.evaluator_id == models.Evaluator.id,
                        models.DatasetEvaluators.deleted_at.is_(None),
                    )
                    .exists(),
                    ~select(models.ProjectEvaluator.id)
                    .where(
                        models.ProjectEvaluator.evaluator_id == models.Evaluator.id,
                        models.ProjectEvaluator.deleted_at.is_(None),
                    )
                    .exists(),
                )
                result = await session.execute(delete_stmt)
                if result.rowcount and result.rowcount > 0:  # type: ignore[attr-defined]
                    logger.warning(
                        f"Removed {result.rowcount} stale builtin evaluator(s) "  # type: ignore[attr-defined]
                        "from database"
                    )

    logger.info(f"Synced {len(current_keys)} builtin evaluators to database")
