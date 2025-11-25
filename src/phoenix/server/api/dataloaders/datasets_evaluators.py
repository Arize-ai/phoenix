from typing import Optional

from sqlalchemy import select, tuple_
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

DatasetID: TypeAlias = int
EvaluatorID: TypeAlias = int
Key: TypeAlias = tuple[DatasetID, EvaluatorID]
Result: TypeAlias = Optional[models.DatasetsEvaluators]


class DatasetsEvaluatorsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        datasets_evaluators_by_key: dict[Key, Result] = {}
        async with self._db() as session:
            for junction in await session.scalars(
                select(models.DatasetsEvaluators).where(
                    tuple_(
                        models.DatasetsEvaluators.dataset_id,
                        models.DatasetsEvaluators.evaluator_id,
                    ).in_(set(keys))
                )
            ):
                dataset_id = junction.dataset_id
                evaluator_id = junction.evaluator_id
                builtin_evaluator_id = junction.builtin_evaluator_id
                if evaluator_id is not None:
                    key = (dataset_id, evaluator_id)
                    datasets_evaluators_by_key[key] = junction
                elif builtin_evaluator_id is not None:
                    key = (dataset_id, builtin_evaluator_id)
                    datasets_evaluators_by_key[key] = junction

            return [datasets_evaluators_by_key.get(key) for key in keys]
