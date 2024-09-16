from collections import defaultdict
from typing import (
    DefaultDict,
    List,
)

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import ExperimentRunAnnotation as OrmExperimentRunAnnotation
from phoenix.server.types import DbSessionFactory

ExperimentRunID: TypeAlias = int
Key: TypeAlias = ExperimentRunID
Result: TypeAlias = List[OrmExperimentRunAnnotation]


class ExperimentRunAnnotations(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        run_ids = keys
        annotations: DefaultDict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            async for run_id, annotation in await session.stream(
                select(
                    OrmExperimentRunAnnotation.experiment_run_id, OrmExperimentRunAnnotation
                ).where(OrmExperimentRunAnnotation.experiment_run_id.in_(run_ids))
            ):
                annotations[run_id].append(annotation)
        return [
            sorted(annotations[run_id], key=lambda annotation: annotation.name, reverse=True)
            for run_id in keys
        ]
