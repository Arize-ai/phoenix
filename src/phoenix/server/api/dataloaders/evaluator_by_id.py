from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import with_polymorphic
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

EvaluatorId: TypeAlias = int
Key: TypeAlias = EvaluatorId
Result: TypeAlias = Optional[models.Evaluator]


class EvaluatorByIdDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        evaluator_ids = list(set(keys))
        evaluators_by_id: dict[Key, models.Evaluator] = {}

        async with self._db() as session:
            evaluator_model = with_polymorphic(
                models.Evaluator,
                [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
            )
            data = await session.stream_scalars(
                select(evaluator_model).where(evaluator_model.id.in_(evaluator_ids))
            )
            async for evaluator in data:
                evaluators_by_id[evaluator.id] = evaluator

        return [evaluators_by_id.get(key) for key in keys]
