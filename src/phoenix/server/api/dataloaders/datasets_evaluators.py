from typing import Optional

from sqlalchemy import and_, or_, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

DatasetID: TypeAlias = int
EvaluatorID: TypeAlias = int
Name: TypeAlias = str
Key: TypeAlias = tuple[DatasetID, EvaluatorID, Name]
Result: TypeAlias = Optional[models.DatasetsEvaluators]


class DatasetsEvaluatorsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        datasets_evaluators_by_key: dict[Key, Result] = {}
        async with self._db() as session:
            conditions = []
            for dataset_id, evaluator_id, name in keys:
                if evaluator_id < 0:
                    conditions.append(
                        and_(
                            models.DatasetsEvaluators.dataset_id == dataset_id,
                            models.DatasetsEvaluators.builtin_evaluator_id == evaluator_id,
                            models.DatasetsEvaluators.name == name,
                        )
                    )
                else:
                    conditions.append(
                        and_(
                            models.DatasetsEvaluators.dataset_id == dataset_id,
                            models.DatasetsEvaluators.evaluator_id == evaluator_id,
                            models.DatasetsEvaluators.name == name,
                        )
                    )
            if conditions:
                for junction in await session.scalars(
                    select(models.DatasetsEvaluators).where(or_(*conditions))
                ):
                    dataset_id = junction.dataset_id
                    evaluator_id = junction.evaluator_id
                    builtin_evaluator_id = junction.builtin_evaluator_id
                    name = junction.name
                    if evaluator_id is not None and name is not None:
                        key = (dataset_id, evaluator_id, name)
                        datasets_evaluators_by_key[key] = junction
                    elif builtin_evaluator_id is not None and name is not None:
                        key = (dataset_id, builtin_evaluator_id, name)
                        datasets_evaluators_by_key[key] = junction

            return [datasets_evaluators_by_key.get(key) for key in keys]
