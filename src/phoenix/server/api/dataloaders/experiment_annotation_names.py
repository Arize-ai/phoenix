from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
Key: TypeAlias = ExperimentID
Result: TypeAlias = list[str]


class ExperimentAnnotationNamesDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        experiment_ids = keys
        names_by_experiment: defaultdict[ExperimentID, Result] = defaultdict(list)
        async with self._db() as session:
            async for experiment_id, annotation_name in await session.stream(
                select(
                    models.ExperimentRun.experiment_id,
                    models.ExperimentRunAnnotation.name,
                )
                .distinct()
                .select_from(models.ExperimentRun)
                .join(
                    models.ExperimentRunAnnotation,
                    models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
                )
                .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
                .order_by(models.ExperimentRun.experiment_id, models.ExperimentRunAnnotation.name)
            ):
                names_by_experiment[experiment_id].append(annotation_name)
        return [names_by_experiment[experiment_id] for experiment_id in keys]
