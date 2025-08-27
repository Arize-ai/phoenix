from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import and_, func, select
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
        repetition_mean_scores_by_example_subquery = (
            select(
                models.ExperimentRun.experiment_id.label("experiment_id"),
                models.ExperimentRunAnnotation.name.label("annotation_name"),
                func.avg(models.ExperimentRunAnnotation.score).label("mean_repetition_score"),
            )
            .select_from(models.ExperimentRunAnnotation)
            .join(
                models.ExperimentRun,
                models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
            )
            .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
            .group_by(
                models.ExperimentRun.experiment_id,
                models.ExperimentRun.dataset_example_id,
                models.ExperimentRunAnnotation.name,
            )
            .subquery()
            .alias("repetition_mean_scores_by_example")
        )
        repetition_mean_scores_subquery = (
            select(
                repetition_mean_scores_by_example_subquery.c.experiment_id.label("experiment_id"),
                repetition_mean_scores_by_example_subquery.c.annotation_name.label(
                    "annotation_name"
                ),
                func.avg(repetition_mean_scores_by_example_subquery.c.mean_repetition_score).label(
                    "mean_score"
                ),
            )
            .select_from(repetition_mean_scores_by_example_subquery)
            .group_by(
                repetition_mean_scores_by_example_subquery.c.experiment_id,
                repetition_mean_scores_by_example_subquery.c.annotation_name,
            )
            .subquery()
            .alias("repetition_mean_scores")
        )
        repetitions_subquery = (
            select(
                models.ExperimentRun.experiment_id.label("experiment_id"),
                models.ExperimentRunAnnotation.name.label("annotation_name"),
                func.min(models.ExperimentRunAnnotation.score).label("min_score"),
                func.max(models.ExperimentRunAnnotation.score).label("max_score"),
                func.count().label("count"),
                func.count(models.ExperimentRunAnnotation.error).label("error_count"),
            )
            .select_from(models.ExperimentRunAnnotation)
            .join(
                models.ExperimentRun,
                models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
            )
            .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
            .group_by(models.ExperimentRun.experiment_id, models.ExperimentRunAnnotation.name)
            .subquery()
        )
        run_scores_query = (
            select(
                repetition_mean_scores_subquery.c.experiment_id.label("experiment_id"),
                repetition_mean_scores_subquery.c.annotation_name.label("annotation_name"),
                repetition_mean_scores_subquery.c.mean_score.label("mean_score"),
                repetitions_subquery.c.min_score.label("min_score"),
                repetitions_subquery.c.max_score.label("max_score"),
                repetitions_subquery.c.count.label("count_"),
                repetitions_subquery.c.error_count.label("error_count"),
            )
            .select_from(repetition_mean_scores_subquery)
            .join(
                repetitions_subquery,
                and_(
                    repetitions_subquery.c.experiment_id
                    == repetition_mean_scores_subquery.c.experiment_id,
                    repetitions_subquery.c.annotation_name
                    == repetition_mean_scores_subquery.c.annotation_name,
                ),
            )
            .order_by(repetition_mean_scores_subquery.c.annotation_name)
        )
        async with self._db() as session:
            async for scores_tuple in await session.stream(run_scores_query):
                summaries[scores_tuple.experiment_id].append(
                    ExperimentAnnotationSummary(
                        annotation_name=scores_tuple.annotation_name,
                        min_score=scores_tuple.min_score,
                        max_score=scores_tuple.max_score,
                        mean_score=scores_tuple.mean_score,
                        count=scores_tuple.count_,
                        error_count=scores_tuple.error_count,
                    )
                )
        return [
            sorted(summaries[experiment_id], key=lambda summary: summary.annotation_name)
            for experiment_id in experiment_ids
        ]
