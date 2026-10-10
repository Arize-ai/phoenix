from typing import Iterable

from strawberry.dataloader import DataLoader

from phoenix.server.online_eval.queue_health import ProjectQueue, load_project_queues
from phoenix.server.types import DbSessionFactory


class ProjectEvaluationQueueDataLoader(DataLoader[int, ProjectQueue]):
    """Each project's part of the evaluation queue, batched across projects."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[int]) -> list[ProjectQueue]:
        keys = list(keys)
        queues = await load_project_queues(self._db, keys)
        return [queues[key] for key in keys]
