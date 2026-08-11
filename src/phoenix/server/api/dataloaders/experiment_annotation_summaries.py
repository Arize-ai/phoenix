from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.sql.elements import ColumnElement
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
    score_count: int
    label_count: int


ExperimentID: TypeAlias = int
AnnotationName: TypeAlias = str
Key: TypeAlias = tuple[ExperimentID, Optional[AnnotationName]]
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
        requested_keys = set(keys)
        summaries: defaultdict[Key, Result] = defaultdict(list)

        # GraphQL can request filtered and unfiltered aliases in one operation,
        # so a single DataLoader batch may contain both key shapes.
        unfiltered_experiment_ids = [
            experiment_id for experiment_id, annotation_name in keys if annotation_name is None
        ]
        filtered_experiment_ids_by_name: defaultdict[str, list[int]] = defaultdict(list)
        for experiment_id, annotation_name in keys:
            if annotation_name is not None:
                filtered_experiment_ids_by_name[annotation_name].append(experiment_id)
        annotation_filter_conditions: list[ColumnElement[bool]] = []
        if unfiltered_experiment_ids:
            annotation_filter_conditions.append(
                models.ExperimentRun.experiment_id.in_(unfiltered_experiment_ids)
            )
        for annotation_name, filtered_experiment_ids in filtered_experiment_ids_by_name.items():
            annotation_filter_conditions.append(
                and_(
                    models.ExperimentRun.experiment_id.in_(filtered_experiment_ids),
                    models.ExperimentRunAnnotation.name == annotation_name,
                )
            )
        annotation_filter = or_(*annotation_filter_conditions)
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
            .where(annotation_filter)
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
                func.count(models.ExperimentRunAnnotation.score).label("score_count"),
                func.count(models.ExperimentRunAnnotation.label).label("label_count"),
            )
            .select_from(models.ExperimentRunAnnotation)
            .join(
                models.ExperimentRun,
                models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
            )
            .where(annotation_filter)
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
                repetitions_subquery.c.score_count.label("score_count"),
                repetitions_subquery.c.label_count.label("label_count"),
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
        async with self._db.read() as session:
            async for scores_tuple in await session.stream(run_scores_query):
                summary = ExperimentAnnotationSummary(
                    annotation_name=scores_tuple.annotation_name,
                    min_score=scores_tuple.min_score,
                    max_score=scores_tuple.max_score,
                    mean_score=scores_tuple.mean_score,
                    count=scores_tuple.count_,
                    error_count=scores_tuple.error_count,
                    score_count=scores_tuple.score_count,
                    label_count=scores_tuple.label_count,
                )
                unfiltered_key = (scores_tuple.experiment_id, None)
                filtered_key = (scores_tuple.experiment_id, scores_tuple.annotation_name)
                if unfiltered_key in requested_keys:
                    summaries[unfiltered_key].append(summary)
                if filtered_key in requested_keys:
                    summaries[filtered_key].append(summary)
        return [sorted(summaries[key], key=lambda summary: summary.annotation_name) for key in keys]
