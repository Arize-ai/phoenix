from typing import Optional

from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import latest_code_evaluator_versions_by_evaluator_id
from phoenix.server.types import DbSessionFactory

CodeEvaluatorId: TypeAlias = int
Key: TypeAlias = CodeEvaluatorId
Result: TypeAlias = Optional[models.CodeEvaluatorVersion]


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
