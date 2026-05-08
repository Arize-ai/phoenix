from typing import Optional

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

CodeEvaluatorVersionId: TypeAlias = int
Key: TypeAlias = CodeEvaluatorVersionId
Result: TypeAlias = Optional[int]


class CodeEvaluatorVersionSequenceNumberDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        version_ids = keys
        row_number = (
            func.row_number().over(
                partition_by=models.CodeEvaluatorVersion.code_evaluator_id,
                order_by=models.CodeEvaluatorVersion.id,
            )
        ).label("sequence_number")
        subq = (select(models.CodeEvaluatorVersion.id.label("version_id"), row_number)).subquery()
        stmt = select(subq).where(subq.c.version_id.in_(version_ids))
        async with self._db.read() as session:
            result = {
                version_id: sequence_number
                async for version_id, sequence_number in await session.stream(stmt)
            }
        return [result.get(version_id) for version_id in keys]
