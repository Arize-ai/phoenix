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
    """
    Batches requests for datasets associated with evaluators.

    For regular evaluators (positive IDs), queries via evaluator_id.
    For builtin evaluators (negative IDs), queries via builtin_evaluator_id.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        regular_ids = [k for k in keys if k >= 0]
        builtin_ids = [k for k in keys if k < 0]

        datasets_by_evaluator: dict[Key, list[models.Dataset]] = defaultdict(list)

        async with self._db() as session:
            # Query for regular evaluators
            if regular_ids:
                stmt = (
                    select(models.DatasetEvaluators.evaluator_id, models.Dataset)
                    .join(
                        models.Dataset,
                        models.DatasetEvaluators.dataset_id == models.Dataset.id,
                    )
                    .where(models.DatasetEvaluators.evaluator_id.in_(regular_ids))
                    .order_by(models.Dataset.name.asc())
                )
                for row in await session.execute(stmt):
                    evaluator_id, dataset = row
                    datasets_by_evaluator[evaluator_id].append(dataset)

            # Query for builtin evaluators
            if builtin_ids:
                stmt = (
                    select(models.DatasetEvaluators.builtin_evaluator_id, models.Dataset)
                    .join(
                        models.Dataset,
                        models.DatasetEvaluators.dataset_id == models.Dataset.id,
                    )
                    .where(models.DatasetEvaluators.builtin_evaluator_id.in_(builtin_ids))
                    .order_by(models.Dataset.name.asc())
                )
                for row in await session.execute(stmt):
                    builtin_evaluator_id, dataset = row
                    datasets_by_evaluator[builtin_evaluator_id].append(dataset)

        return [datasets_by_evaluator.get(key, []) for key in keys]
