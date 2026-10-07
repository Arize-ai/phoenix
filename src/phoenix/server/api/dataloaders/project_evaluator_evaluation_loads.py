from typing import Iterable

from strawberry.dataloader import DataLoader

from phoenix.server.online_eval.queue_health import EvaluationLoad, load_evaluation_loads
from phoenix.server.types import DbSessionFactory


class ProjectEvaluatorEvaluationLoadsDataLoader(DataLoader[int, EvaluationLoad]):
    """Each project evaluator's evaluation load. One read per batch covers every project
    evaluator on the server, whose total each share divides by."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[int]) -> list[EvaluationLoad]:
        keys = list(keys)
        loads = await load_evaluation_loads(self._db, keys)
        return [loads[key] for key in keys]
