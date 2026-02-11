from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

EvaluatorID: TypeAlias = int
Key: TypeAlias = EvaluatorID
Result: TypeAlias = list[models.DatasetEvaluators]


class DatasetEvaluatorsByEvaluatorDataLoader(DataLoader[Key, Result]):
    """Batches requests for dataset evaluators associated with evaluators."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        dataset_evaluators_by_evaluator: dict[Key, list[models.DatasetEvaluators]] = defaultdict(
            list
        )

        async with self._db() as session:
            stmt = (
                select(models.DatasetEvaluators)
                .where(models.DatasetEvaluators.evaluator_id.in_(keys))
                .order_by(models.DatasetEvaluators.name.asc())
            )
            for row in await session.scalars(stmt):
                dataset_evaluators_by_evaluator[row.evaluator_id].append(row)

        return [dataset_evaluators_by_evaluator.get(key, []) for key in keys]
