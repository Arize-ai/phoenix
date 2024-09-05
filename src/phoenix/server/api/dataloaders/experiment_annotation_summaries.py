from collections import defaultdict
from dataclasses import dataclass
from typing import (
    DefaultDict,
    List,
    Optional,
)

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
Result: TypeAlias = List[ExperimentAnnotationSummary]


class ExperimentAnnotationSummaryDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
        cache_map: Optional[AbstractCache[Key, Result]] = None,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        experiment_ids = keys
        summaries: DefaultDict[ExperimentID, Result] = defaultdict(list)
        async with self._db() as session:
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
                    models.ExperimentRun.experiment_id,
                    models.ExperimentRunAnnotation.name,
                    func.min(models.ExperimentRunAnnotation.score),
                    func.max(models.ExperimentRunAnnotation.score),
                    func.avg(models.ExperimentRunAnnotation.score),
                    func.count(),
                    func.count(models.ExperimentRunAnnotation.error),
                )
                .join(
                    models.ExperimentRun,
                    models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
                )
                .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
                .group_by(models.ExperimentRun.experiment_id, models.ExperimentRunAnnotation.name)
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
