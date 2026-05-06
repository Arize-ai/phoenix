from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

CodeEvaluatorId: TypeAlias = int
Key: TypeAlias = CodeEvaluatorId
Result: TypeAlias = Optional[int]


async def latest_code_evaluator_version_ids_by_evaluator_id(
    code_evaluator_ids: list[int],
    session: AsyncSession,
) -> dict[int, int]:
    """Batch-resolve the latest CodeEvaluatorVersion.id per code_evaluator_id.

    Shared between the dataloader (request-scoped batching) and non-GraphQL
    callers like the experiment runner daemon, which run outside the request
    context but still want the same MAX(id) GROUP BY shape.
    """
    if not code_evaluator_ids:
        return {}
    distinct_ids = list(set(code_evaluator_ids))
    subq = (
        select(
            models.CodeEvaluatorVersion.code_evaluator_id,
            func.max(models.CodeEvaluatorVersion.id).label("latest_version_id"),
        )
        .where(models.CodeEvaluatorVersion.code_evaluator_id.in_(distinct_ids))
        .group_by(models.CodeEvaluatorVersion.code_evaluator_id)
    ).subquery()
    stmt = select(subq.c.code_evaluator_id, subq.c.latest_version_id)
    return {
        code_evaluator_id: latest_version_id
        async for code_evaluator_id, latest_version_id in await session.stream(stmt)
    }


class LatestCodeEvaluatorVersionIdDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        async with self._db.read() as session:
            result = await latest_code_evaluator_version_ids_by_evaluator_id(list(keys), session)
        return [result.get(code_evaluator_id) for code_evaluator_id in keys]
