"""
Synchronization of builtin evaluator registry to database.

This module ensures the `builtin_evaluators` table stays in sync with
the in-memory registry defined in `evaluators.py`. Called on application
startup via the lifespan callbacks.

Since BuiltinEvaluator inherits from Evaluator (polymorphic hierarchy),
we use SQLAlchemy ORM to properly handle the joined table inheritance.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)


async def sync_builtin_evaluators(db: DbSessionFactory) -> None:
    """
    Synchronize the in-memory builtin evaluator registry to the database.

    This function:
    1. Creates or updates builtin evaluators using ORM (handles inheritance)
    2. Removes any stale evaluators no longer in the registry

    Safe to call multiple times (idempotent).
    """
    from phoenix.db.types.identifier import Identifier
    from phoenix.server.api.evaluators import get_builtin_evaluators

    async with db() as session:
        current_keys: set[str] = set()
        now = datetime.now(timezone.utc)

        for key, evaluator_cls in get_builtin_evaluators():
            current_keys.add(key)

            evaluator = evaluator_cls()
            output_cfg = evaluator.output_config

            # Check if this evaluator already exists by key
            existing = await session.scalar(
                select(models.BuiltinEvaluator).where(models.BuiltinEvaluator.key == key)
            )

            if existing:
                # Update existing record
                existing.name = Identifier(key)
                existing.description = evaluator_cls.description
                existing.input_schema = evaluator.input_schema
                existing.output_config = output_cfg.model_dump()
                existing.synced_at = now
            else:
                # Create new record using ORM (handles polymorphic inheritance)
                new_evaluator = models.BuiltinEvaluator(
                    name=Identifier(key),
                    description=evaluator_cls.description,
                    metadata_={},
                    user_id=None,
                    key=key,
                    input_schema=evaluator.input_schema,
                    output_config=output_cfg.model_dump(),
                    synced_at=now,
                )
                session.add(new_evaluator)

        # Flush to ensure all evaluators are created before checking for stale ones
        await session.flush()

        # Remove stale evaluators no longer in registry
        if current_keys:
            # Find builtin evaluators with keys not in the current registry
            stale_ids_stmt = select(models.BuiltinEvaluator.id).where(
                models.BuiltinEvaluator.key.notin_(current_keys)
            )
            stale_ids_result = await session.execute(stale_ids_stmt)
            stale_ids = [row[0] for row in stale_ids_result.fetchall()]

            if stale_ids:
                delete_stmt = delete(models.Evaluator).where(
                    models.Evaluator.kind == "BUILTIN",
                    models.Evaluator.id.in_(stale_ids),
                )
                result = await session.execute(delete_stmt)
                if result.rowcount and result.rowcount > 0:  # type: ignore[attr-defined]
                    logger.warning(
                        f"Removed {result.rowcount} stale builtin evaluator(s) "  # type: ignore[attr-defined]
                        "from database"
                    )

        logger.info(f"Synced {len(current_keys)} builtin evaluators to database")


class BuiltinEvaluatorSyncCallback:
    """
    Startup callback for builtin evaluator synchronization.

    Implements the _Callback protocol expected by _lifespan().
    """

    def __init__(self, db: DbSessionFactory) -> None:
        self._db = db

    async def __call__(self) -> None:
        await sync_builtin_evaluators(self._db)
