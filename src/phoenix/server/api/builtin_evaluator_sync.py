"""
Synchronization of builtin evaluator registry to database.

This module ensures the `builtin_evaluators` table stays in sync with
the in-memory registry defined in `evaluators.py`. Called on application
startup via the lifespan callbacks.

Since BuiltinEvaluator inherits from Evaluator (polymorphic hierarchy),
we must upsert into both the base `evaluators` table and the subclass
`builtin_evaluators` table.
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
    1. Upserts all current builtin evaluators into base evaluators table
    2. Upserts corresponding records into builtin_evaluators subclass table
    3. Removes any stale evaluators no longer in the registry

    Safe to call multiple times (idempotent).
    """
    from phoenix.db.types.identifier import Identifier
    from phoenix.server.api.evaluators import get_builtin_evaluators

    async with db() as session:
        current_ids: set[int] = set()
        now = datetime.now(timezone.utc)

        # Records for base evaluators table
        base_records: list[dict[str, Any]] = []
        # Records for builtin_evaluators subclass table
        subclass_records: list[dict[str, Any]] = []

        for evaluator_id, evaluator_cls in get_builtin_evaluators():
            current_ids.add(evaluator_id)

            evaluator = evaluator_cls()
            output_cfg = evaluator.output_config

            # Base evaluator record
            # Convert PascalCase name to lowercase identifier (e.g., "Contains" -> "contains")
            # The Identifier type requires lowercase names matching ^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$
            identifier_name = evaluator_cls._stable_name.lower()
            base_records.append(
                {
                    "id": evaluator_id,
                    "kind": "BUILTIN",
                    "name": Identifier(identifier_name),
                    "description": evaluator_cls.description,
                    "metadata_": {},
                    "user_id": None,
                }
            )

            # Subclass builtin_evaluator record
            subclass_records.append(
                {
                    "id": evaluator_id,
                    "kind": "BUILTIN",
                    "input_schema": evaluator.input_schema,
                    "output_config_type": output_cfg.type,
                    "output_config": output_cfg.model_dump(),
                    "synced_at": now,
                }
            )

        if base_records:
            # First upsert into base evaluators table
            base_stmt = insert_on_conflict(
                *base_records,
                table=models.Evaluator,
                dialect=db.dialect,
                unique_by=["id"],
                on_conflict=OnConflict.DO_UPDATE,
                constraint_name="pk_evaluators"
                if db.dialect is SupportedSQLDialect.POSTGRESQL
                else None,
            )
            await session.execute(base_stmt)

            # Then upsert into builtin_evaluators subclass table
            subclass_stmt = insert_on_conflict(
                *subclass_records,
                table=models.BuiltinEvaluator,
                dialect=db.dialect,
                unique_by=["id"],
                on_conflict=OnConflict.DO_UPDATE,
                constraint_name="pk_builtin_evaluators"
                if db.dialect is SupportedSQLDialect.POSTGRESQL
                else None,
            )
            await session.execute(subclass_stmt)

        # Remove stale evaluators no longer in registry
        # Deleting from base evaluators table will CASCADE to builtin_evaluators
        if current_ids:
            delete_stmt = delete(models.Evaluator).where(
                models.Evaluator.kind == "BUILTIN",
                models.Evaluator.id.notin_(current_ids),
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
