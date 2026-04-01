from typing import Any, Optional

from sqlalchemy import Select, Values, column, func, literal_column, select
from sqlalchemy.orm import with_polymorphic
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.types import DbSessionFactory

Key = int  # Experiment ID
Result = Optional[models.ExperimentLog]


class LastExperimentErrorsDataLoader(DataLoader[Key, Result]):
    """Batches loads of the most recent experiment log row per experiment id."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        poly = with_polymorphic(models.ExperimentLog, "*")
        async with self._db() as session:
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            if dialect == SupportedSQLDialect.POSTGRESQL:
                stmt = _postgresql_stmt(poly, keys)
            else:
                stmt = _sqlite_stmt(poly, keys)
            by_experiment_id: dict[int, models.ExperimentLog] = {}
            for row in await session.scalars(stmt):
                by_experiment_id[row.experiment_id] = row
            for row in by_experiment_id.values():
                session.expunge(row)
        return [by_experiment_id.get(key) for key in keys]


def _postgresql_stmt(poly: Any, keys: list[Key]) -> Select[Any]:
    """Use LATERAL join for efficient index-only lookup on Postgres."""
    keys_vals = (
        Values(column("experiment_id", models.ExperimentLog.experiment_id.type))
        .data([(k,) for k in keys])
        .alias("keys")
    )
    latest = (
        select(models.ExperimentLog.id)
        .where(models.ExperimentLog.experiment_id == keys_vals.c.experiment_id)
        .where(models.ExperimentLog.level == "ERROR")
        .order_by(models.ExperimentLog.occurred_at.desc())
        .limit(1)
        .correlate(keys_vals)
        .lateral("latest")
    )
    return (
        select(poly)
        .select_from(keys_vals)
        .join(latest, literal_column("true"))
        .join(poly, poly.id == latest.c.id)
    )


def _sqlite_stmt(poly: Any, keys: list[Key]) -> Select[Any]:
    """Use ROW_NUMBER window function as fallback for SQLite."""
    ranked = (
        select(
            models.ExperimentLog.id,
            func.row_number()
            .over(
                partition_by=models.ExperimentLog.experiment_id,
                order_by=models.ExperimentLog.occurred_at.desc(),
            )
            .label("rn"),
        )
        .where(models.ExperimentLog.experiment_id.in_(keys))
        .where(models.ExperimentLog.level == "ERROR")
        .subquery()
    )
    return select(poly).join(ranked, poly.id == ranked.c.id).where(ranked.c.rn == 1)
