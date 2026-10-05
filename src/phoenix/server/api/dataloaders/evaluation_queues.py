from typing import Iterable

from strawberry.dataloader import DataLoader

from phoenix.server.online_eval.queue_health import (
    EvaluationQueue,
    QueueThroughput,
    load_evaluation_queue,
    load_queue_throughput,
)
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
    """The queue's rates, read once per request and only by the fields that show them."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[EvaluationQueue]) -> list[QueueThroughput]:
        return [await load_queue_throughput(self._db, queue) for queue in keys]
