from typing import Iterable

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ProjectEvaluatorId: TypeAlias = int
Key: TypeAlias = ProjectEvaluatorId
Result: TypeAlias = list[models.ProjectEvaluatorTrigger]


class ProjectEvaluatorTriggersDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[list[models.ProjectEvaluatorTrigger]]:
        criteria_ids = list(set(keys))
        triggers_by_criteria: dict[Key, list[models.ProjectEvaluatorTrigger]] = {}
        async with self._db.read() as session:
            records = await session.stream_scalars(
                select(models.ProjectEvaluatorTrigger)
                .where(models.ProjectEvaluatorTrigger.criteria_id.in_(criteria_ids))
                .order_by(models.ProjectEvaluatorTrigger.id)
            )
            async for record in records:
                triggers_by_criteria.setdefault(record.criteria_id, []).append(record)
        return [triggers_by_criteria.get(key, []) for key in keys]
