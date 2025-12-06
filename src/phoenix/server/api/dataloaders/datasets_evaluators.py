from typing import Optional

from sqlalchemy import and_, or_, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.types.identifier import Identifier as IdentifierModel
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
                name_model = IdentifierModel.model_validate(name)
                if evaluator_id < 0:
                    conditions.append(
                        and_(
                            models.DatasetsEvaluators.dataset_id == dataset_id,
                            models.DatasetsEvaluators.builtin_evaluator_id == evaluator_id,
                            models.DatasetsEvaluators.display_name == name_model,
                        )
                    )
                else:
                    conditions.append(
                        and_(
                            models.DatasetsEvaluators.dataset_id == dataset_id,
                            models.DatasetsEvaluators.evaluator_id == evaluator_id,
                            models.DatasetsEvaluators.display_name == name_model,
                        )
                    )
            if conditions:
                for junction in await session.scalars(
                    select(models.DatasetsEvaluators).where(or_(*conditions))
                ):
                    junction_dataset_id = junction.dataset_id
                    junction_evaluator_id = junction.evaluator_id
                    junction_builtin_evaluator_id = junction.builtin_evaluator_id
                    junction_name = junction.display_name.root
                    if junction_evaluator_id is not None:
                        key = (junction_dataset_id, junction_evaluator_id, junction_name)
                        datasets_evaluators_by_key[key] = junction
                    elif junction_builtin_evaluator_id is not None:
                        key = (junction_dataset_id, junction_builtin_evaluator_id, junction_name)
                        datasets_evaluators_by_key[key] = junction

            return [datasets_evaluators_by_key.get(key) for key in keys]
