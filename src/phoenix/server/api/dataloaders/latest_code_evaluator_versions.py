from typing import Any, Optional, cast

from sqlalchemy import Select, Values, column, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.types import DbSessionFactory

CodeEvaluatorId: TypeAlias = int
Key: TypeAlias = CodeEvaluatorId
Result: TypeAlias = Optional[models.CodeEvaluatorVersion]


async def latest_code_evaluator_versions_by_evaluator_id(
    code_evaluator_ids: list[int],
    session: AsyncSession,
) -> dict[int, models.CodeEvaluatorVersion]:
    """Batch-resolve the latest CodeEvaluatorVersion row per code_evaluator_id.

    Shared between the dataloader (request-scoped batching) and non-GraphQL
    callers like the experiment runner daemon, which run outside the request
    context but still want the same latest-version lookup shape.
    """
    if not code_evaluator_ids:
        return {}
    distinct_ids = list(set(code_evaluator_ids))
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    if dialect == SupportedSQLDialect.POSTGRESQL:
        stmt = _postgresql_stmt(distinct_ids)
    else:
        stmt = _sqlite_stmt(distinct_ids)
    return {
        version.code_evaluator_id: version async for version in await session.stream_scalars(stmt)
    }


async def latest_code_evaluator_version_for_update(
    session: AsyncSession,
    code_evaluator_id: int,
) -> Optional[models.CodeEvaluatorVersion]:
    """Resolve one evaluator's latest version inside an existing write session."""
    return cast(
        Optional[models.CodeEvaluatorVersion],
        await session.scalar(
            select(models.CodeEvaluatorVersion)
            .where(models.CodeEvaluatorVersion.code_evaluator_id == code_evaluator_id)
            .order_by(models.CodeEvaluatorVersion.id.desc())
            .limit(1)
        ),
    )


class LatestCodeEvaluatorVersionDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        async with self._db.read() as session:
            result = await latest_code_evaluator_versions_by_evaluator_id(list(keys), session)
            for row in result.values():
                session.expunge(row)
        return [result.get(code_evaluator_id) for code_evaluator_id in keys]


def _postgresql_stmt(keys: list[Key]) -> Select[Any]:
    keys_vals = (
        Values(column("code_evaluator_id", models.CodeEvaluatorVersion.code_evaluator_id.type))
        .data([(key,) for key in keys])
        .alias("keys")
    )
    latest = (
        select(models.CodeEvaluatorVersion.id)
        .where(models.CodeEvaluatorVersion.code_evaluator_id == keys_vals.c.code_evaluator_id)
        .order_by(models.CodeEvaluatorVersion.id.desc())
        .limit(1)
        .correlate(keys_vals)
        .lateral("latest")
    )
    return (
        select(models.CodeEvaluatorVersion)
        .select_from(keys_vals)
        .join(latest, literal_column("true"))
        .join(models.CodeEvaluatorVersion, models.CodeEvaluatorVersion.id == latest.c.id)
    )


def _sqlite_stmt(keys: list[Key]) -> Select[Any]:
    ranked = (
        select(
            models.CodeEvaluatorVersion.id,
            func.row_number()
            .over(
                partition_by=models.CodeEvaluatorVersion.code_evaluator_id,
                order_by=models.CodeEvaluatorVersion.id.desc(),
            )
            .label("rn"),
        )
        .where(models.CodeEvaluatorVersion.code_evaluator_id.in_(keys))
        .subquery()
    )
    return (
        select(models.CodeEvaluatorVersion)
        .join(ranked, models.CodeEvaluatorVersion.id == ranked.c.id)
        .where(ranked.c.rn == 1)
    )
