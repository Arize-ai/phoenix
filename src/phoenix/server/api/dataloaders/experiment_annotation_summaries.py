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
    mean_score: float
    min_score: float
    max_score: float


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
        repetition_scores_subquery = (
            select(
                models.ExperimentRunAnnotation.experiment_run_id.label("experiment_run_id"),
                models.ExperimentRunAnnotation.name.label("annotation_name"),
                func.min(models.ExperimentRunAnnotation.score).label("min_repetition_score"),
                func.max(models.ExperimentRunAnnotation.score).label("max_repetition_score"),
                func.avg(models.ExperimentRunAnnotation.score).label("mean_repetition_score"),
                func.min(models.ExperimentRun.experiment_id).label("experiment_id"),
            )
            .select_from(models.ExperimentRunAnnotation)
            .join(
                models.ExperimentRun,
                models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
            )
            .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
            .group_by(
                models.ExperimentRunAnnotation.experiment_run_id,
                models.ExperimentRunAnnotation.name,
            )
            .subquery()
            .alias("repetition_scores")
        )
        run_scores_query = select(
            repetition_scores_subquery.c.experiment_id,
            repetition_scores_subquery.c.annotation_name,
            func.min(repetition_scores_subquery.c.min_repetition_score).label("min_run_score"),
            func.max(repetition_scores_subquery.c.max_repetition_score).label("max_run_score"),
            func.avg(repetition_scores_subquery.c.mean_repetition_score).label("mean_run_score"),
        ).group_by(
            repetition_scores_subquery.c.experiment_id, repetition_scores_subquery.c.annotation_name
        )
        async with self._db() as session:
            async for scores_tuple in await session.stream(run_scores_query):
                summaries[scores_tuple.experiment_id].append(
                    ExperimentAnnotationSummary(
                        annotation_name=scores_tuple.annotation_name,
                        min_score=scores_tuple.min_run_score,
                        max_score=scores_tuple.max_run_score,
                        mean_score=scores_tuple.mean_run_score,
                    )
                )
        return [
            sorted(summaries[experiment_id], key=lambda summary: summary.annotation_name)
            for experiment_id in experiment_ids
        ]
