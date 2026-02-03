"""
Synchronization of builtin evaluator registry to database.

This module ensures the `builtin_evaluators` table stays in sync with
the in-memory registry defined in `evaluators.py`. Called on application
startup via the lifespan callbacks.

Since BuiltinEvaluator inherits from Evaluator (polymorphic hierarchy),
we use SQLAlchemy ORM to properly handle the joined table inheritance.
"""

import logging
import re

from sqlalchemy import delete, select

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.evaluators import get_builtin_evaluators
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)


def _camel_to_snake(name: str) -> str:
    """Convert CamelCase to snake_case for identifier compatibility."""
    # Insert underscore before uppercase letters and convert to lowercase
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


async def sync_builtin_evaluators(db: DbSessionFactory) -> None:
    """
    Synchronize the in-memory builtin evaluator registry to the database.

    This function:
    1. Creates or updates builtin evaluators using ORM (handles inheritance)
    2. Removes any stale evaluators no longer in the registry

    Safe to call multiple times (idempotent).
    """

    async with db() as session:
        current_keys: set[str] = set()

        for key, evaluator_cls in get_builtin_evaluators():
            current_keys.add(key)

            evaluator = evaluator_cls()
            output_cfg = evaluator.output_config

            # Check if this evaluator already exists by key
            existing = await session.scalar(
                select(models.BuiltinEvaluator).where(models.BuiltinEvaluator.key == key)
            )

            # Convert CamelCase display name to snake_case identifier
            identifier_name = _camel_to_snake(evaluator_cls.name)

            if existing:
                # Update existing record (synced_at auto-updates via onupdate)
                existing.name = Identifier(identifier_name)
                existing.description = evaluator_cls.description
                existing.input_schema = evaluator.input_schema
                existing.output_config = output_cfg.model_dump()
            else:
                # Create new record using ORM (handles polymorphic inheritance)
                # synced_at uses server_default=sa.func.now()
                new_evaluator = models.BuiltinEvaluator(
                    name=Identifier(identifier_name),
                    description=evaluator_cls.description,
                    metadata_={},
                    user_id=None,
                    key=key,
                    input_schema=evaluator.input_schema,
                    output_config=output_cfg.model_dump(),
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
