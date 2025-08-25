from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import func, select
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


@dataclass
class ExperimentAnnotationSummary:
    annotation_name: str
    min_score: float
    max_score: float
    mean_score: float
    count: int
    error_count: int


ExperimentID: TypeAlias = int
Key: TypeAlias = ExperimentID
Result: TypeAlias = list[ExperimentAnnotationSummary]


class ExperimentAnnotationSummaryDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
        cache_map: Optional[AbstractCache[Key, Result]] = None,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        experiment_ids = keys
        summaries: defaultdict[ExperimentID, Result] = defaultdict(list)
        async with self._db() as session:
            # CTE with distinct to avoid duplicate aggregation when experiment_runs has multiple
            # entries per experiment_id (due to different dataset examples and repetitions).
            # Table uniqueness:
            # experiment_runs(experiment_id, dataset_example_id, repetition_number)
            # experiment_run_annotations(experiment_run_id, name)
            experiment_runs = (
                select(
                    models.ExperimentRun.id,
                    models.ExperimentRun.experiment_id,
                )
                .distinct()
                .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
                .cte("experiment_runs")
            )
            async for (
                experiment_id,
                annotation_name,
                min_score,
                max_score,
                mean_score,
                count,
                error_count,
            ) in await session.stream(
                select(
                    experiment_runs.c.experiment_id,
                    models.ExperimentRunAnnotation.name,
                    func.min(models.ExperimentRunAnnotation.score),
                    func.max(models.ExperimentRunAnnotation.score),
                    func.avg(models.ExperimentRunAnnotation.score),
                    func.count(),
                    func.count(models.ExperimentRunAnnotation.error),
                )
                .join_from(
                    models.ExperimentRunAnnotation,
                    experiment_runs,
                    models.ExperimentRunAnnotation.experiment_run_id == experiment_runs.c.id,
                )
                .group_by(experiment_runs.c.experiment_id, models.ExperimentRunAnnotation.name)
            ):
                summaries[experiment_id].append(
                    ExperimentAnnotationSummary(
                        annotation_name=annotation_name,
                        min_score=min_score,
                        max_score=max_score,
                        mean_score=mean_score,
                        count=count,
                        error_count=error_count,
                    )
                )
        return [
            sorted(summaries[experiment_id], key=lambda summary: summary.annotation_name)
            for experiment_id in keys
        ]
