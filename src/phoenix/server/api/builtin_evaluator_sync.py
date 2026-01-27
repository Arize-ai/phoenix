"""
Synchronization of builtin evaluator registry to database.

This module ensures the `builtin_evaluators` table stays in sync with
the in-memory registry defined in `evaluators.py`. Called on application
startup via the lifespan callbacks.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)


async def sync_builtin_evaluators(db: DbSessionFactory) -> None:
    """
    Synchronize the in-memory builtin evaluator registry to the database.

    This function:
    1. Upserts all current builtin evaluators from the registry
    2. Removes any stale evaluators no longer in the registry

    Safe to call multiple times (idempotent).
    """
    from phoenix.server.api.evaluators import get_builtin_evaluators

    async with db() as session:
        current_ids: set[int] = set()
        now = datetime.now(timezone.utc)

        records: list[dict[str, Any]] = []
        for evaluator_id, evaluator_cls in get_builtin_evaluators():
            current_ids.add(evaluator_id)

            evaluator = evaluator_cls()
            output_cfg = evaluator.output_config

            records.append(
                {
                    "id": evaluator_id,
                    "name": evaluator_cls.name,
                    "description": evaluator_cls.description,
                    "input_schema": evaluator.input_schema,
                    "output_config_type": output_cfg.type,
                    "output_config": output_cfg.model_dump(),
                    "synced_at": now,
                }
            )

        if records:
            # Upsert all evaluators in one batch
            stmt = insert_on_conflict(
                *records,
                table=models.BuiltinEvaluator,
                dialect=db.dialect,
                unique_by=["id"],
                on_conflict=OnConflict.DO_UPDATE,
                constraint_name="pk_builtin_evaluators"
                if db.dialect is SupportedSQLDialect.POSTGRESQL
                else None,
            )
            await session.execute(stmt)

        # Remove stale evaluators no longer in registry
        if current_ids:
            delete_stmt = delete(models.BuiltinEvaluator).where(
                models.BuiltinEvaluator.id.notin_(current_ids)
            )
            result = await session.execute(delete_stmt)
            if result.rowcount and result.rowcount > 0:  # type: ignore[attr-defined]
                logger.warning(
                    f"Removed {result.rowcount} stale builtin evaluator(s) "  # type: ignore[attr-defined]
                    "from database"
                )

        logger.info(f"Synced {len(current_ids)} builtin evaluators to database")


class BuiltinEvaluatorSyncCallback:
    """
    Startup callback for builtin evaluator synchronization.

    Implements the _Callback protocol expected by _lifespan().
    """

    def __init__(self, db: DbSessionFactory) -> None:
        self._db = db

    async def __call__(self) -> None:
        await sync_builtin_evaluators(self._db)
