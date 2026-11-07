from typing import Iterable

from strawberry.dataloader import DataLoader

from phoenix.server.api.dataloaders.project_evaluator_queues import (
    ProjectEvaluatorQueuesDataLoader,
)
from phoenix.server.online_eval.current_queue import (
    EvaluationQueue,
    ProjectQueuedCount,
    load_evaluation_queue,
    load_project_evaluator_targets,
    queued_by_project,
)
from phoenix.server.online_eval.throughput import QueueThroughput, load_queue_throughput
from phoenix.server.types import DbSessionFactory


class EvaluationQueueDataLoader(DataLoader[None, EvaluationQueue]):
    """The evaluation queue, measured once per request. Its one key is None."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[None]) -> list[EvaluationQueue]:
        queue = await load_evaluation_queue(self._db)
        return [queue for _ in keys]


class EvaluationQueueThroughputDataLoader(DataLoader[EvaluationQueue, QueueThroughput]):
    """The queue's rates, read once per request and only by the fields that show them. A
    project's rates come from the same read."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[EvaluationQueue]) -> list[QueueThroughput]:
        return [await load_queue_throughput(self._db, queue) for queue in keys]


class EvaluationQueueProjectsDataLoader(DataLoader[int, list[ProjectQueuedCount]]):
    """The projects with the most queued evaluations, most first. Keyed by how many to
    read. Evaluators' queued evaluations come from the request's per-evaluator loader."""

    def __init__(
        self, db: DbSessionFactory, evaluator_queues: ProjectEvaluatorQueuesDataLoader
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db
        self._evaluator_queues = evaluator_queues

    async def _load_fn(self, keys: Iterable[int]) -> list[list[ProjectQueuedCount]]:
        evaluators = await load_project_evaluator_targets(self._db)
        ids = [evaluator.id for evaluator in evaluators]
        queued = dict(zip(ids, await self._evaluator_queues.load_many(ids), strict=True))
        return [queued_by_project(evaluators, queued, limit) for limit in keys]
