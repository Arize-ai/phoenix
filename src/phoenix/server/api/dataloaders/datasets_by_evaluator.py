from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

EvaluatorID: TypeAlias = int
Key: TypeAlias = EvaluatorID
Result: TypeAlias = list[models.Dataset]


class DatasetsByEvaluatorDataLoader(DataLoader[Key, Result]):
    """Batches requests for datasets associated with evaluators."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        datasets_by_evaluator: dict[Key, list[models.Dataset]] = defaultdict(list)

        async with self._db() as session:
            stmt = (
                select(models.DatasetEvaluators.evaluator_id, models.Dataset)
                .join(
                    models.Dataset,
                    models.DatasetEvaluators.dataset_id == models.Dataset.id,
                )
                .where(models.DatasetEvaluators.evaluator_id.in_(keys))
                .order_by(models.Dataset.name.asc())
            )
            for row in await session.execute(stmt):
                evaluator_id, dataset = row
                datasets_by_evaluator[evaluator_id].append(dataset)

        return [datasets_by_evaluator.get(key, []) for key in keys]
