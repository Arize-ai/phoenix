from typing import Iterable

from strawberry.dataloader import DataLoader

from phoenix.server.online_eval.current_queue import (
    ProjectEvaluatorQueue,
    load_project_evaluator_queues,
)
from phoenix.server.types import DbSessionFactory


class ProjectEvaluatorQueuesDataLoader(DataLoader[int, ProjectEvaluatorQueue]):
    """Each project evaluator's queued evaluations, batched across a page of evaluators."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[int]) -> list[ProjectEvaluatorQueue]:
        keys = list(keys)
        queues = await load_project_evaluator_queues(self._db, keys)
        return [queues.get(key, ProjectEvaluatorQueue()) for key in keys]
