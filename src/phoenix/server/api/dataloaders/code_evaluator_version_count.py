from typing import Iterable

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

CodeEvaluatorId: TypeAlias = int

Key: TypeAlias = CodeEvaluatorId
Result: TypeAlias = int


class CodeEvaluatorVersionCountDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        code_evaluator_ids = list(set(keys))
        result: dict[Key, Result] = {}
        stmt = (
            select(
                models.CodeEvaluatorVersion.code_evaluator_id,
                func.count(),
            )
            .where(models.CodeEvaluatorVersion.code_evaluator_id.in_(code_evaluator_ids))
            .group_by(models.CodeEvaluatorVersion.code_evaluator_id)
        )
        async with self._db.read() as session:
            data = await session.stream(stmt)
            async for code_evaluator_id, count in data:
                result[code_evaluator_id] = count
        return [result.get(code_evaluator_id, 0) for code_evaluator_id in keys]
