from typing import Iterable

from strawberry.dataloader import DataLoader

from phoenix.server.api.dataloaders.project_evaluator_queues import (
    ProjectEvaluatorQueuesDataLoader,
)
from phoenix.server.online_eval.current_queue import (
    ProjectQueue,
    load_project_evaluator_targets,
    project_queues,
)
from phoenix.server.types import DbSessionFactory


class ProjectEvaluationQueueDataLoader(DataLoader[int, ProjectQueue]):
    """Each project's part of the evaluation queue, batched across projects. Its evaluators'
    queued evaluations come from the request's per-evaluator loader, so a request that also
    reads them per evaluator reads them once."""

    def __init__(
        self, db: DbSessionFactory, evaluator_queues: ProjectEvaluatorQueuesDataLoader
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db
        self._evaluator_queues = evaluator_queues

    async def _load_fn(self, keys: Iterable[int]) -> list[ProjectQueue]:
        keys = list(keys)
        evaluators = await load_project_evaluator_targets(self._db, keys)
        ids = [evaluator.id for evaluator in evaluators]
        queued = dict(zip(ids, await self._evaluator_queues.load_many(ids), strict=True))
        queues = project_queues(keys, evaluators, queued)
        return [queues[key] for key in keys]
