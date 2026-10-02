from typing import Iterable

from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.server.online_eval.queue_health import (
    EvaluationQueue,
    QueueThroughput,
    load_evaluation_queue,
    load_queue_throughput,
)
from phoenix.server.types import DbSessionFactory


class EvaluationQueuesDataLoader(DataLoader[models.EvaluationTarget, EvaluationQueue]):
    """Each evaluation target's queue, measured once per request."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[models.EvaluationTarget]) -> list[EvaluationQueue]:
        return [await load_evaluation_queue(self._db, target) for target in keys]


class EvaluationQueueThroughputDataLoader(DataLoader[EvaluationQueue, QueueThroughput]):
    """Each queue's rates, read once per request and only by the fields that show them."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[EvaluationQueue]) -> list[QueueThroughput]:
        return [await load_queue_throughput(self._db, queue) for queue in keys]
