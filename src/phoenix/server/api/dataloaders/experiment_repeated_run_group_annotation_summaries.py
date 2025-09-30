from dataclasses import dataclass
from typing import Optional

from sqlalchemy import func, select, tuple_
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
DatasetExampleID: TypeAlias = int
AnnotationName: TypeAlias = str
MeanAnnotationScore: TypeAlias = float


@dataclass
class AnnotationSummary:
    annotation_name: AnnotationName
    mean_score: Optional[MeanAnnotationScore]


Key: TypeAlias = tuple[ExperimentID, DatasetExampleID]
Result: TypeAlias = list[AnnotationSummary]


class ExperimentRepeatedRunGroupAnnotationSummariesDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        annotation_summaries_query = (
            select(
                models.ExperimentRun.experiment_id.label("experiment_id"),
                models.ExperimentRun.dataset_example_id.label("dataset_example_id"),
                models.ExperimentRunAnnotation.name.label("annotation_name"),
                func.avg(models.ExperimentRunAnnotation.score).label("mean_score"),
            )
            .select_from(models.ExperimentRunAnnotation)
            .join(
                models.ExperimentRun,
                models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
            )
            .where(
                tuple_(
                    models.ExperimentRun.experiment_id, models.ExperimentRun.dataset_example_id
                ).in_(set(keys))
            )
            .group_by(
                models.ExperimentRun.experiment_id,
                models.ExperimentRun.dataset_example_id,
                models.ExperimentRunAnnotation.name,
            )
        )
        async with self._db() as session:
            annotation_summaries = (await session.execute(annotation_summaries_query)).all()
        annotation_summaries_by_key: dict[Key, list[AnnotationSummary]] = {}
        for summary in annotation_summaries:
            key = (summary.experiment_id, summary.dataset_example_id)
            gql_summary = AnnotationSummary(
                annotation_name=summary.annotation_name,
                mean_score=summary.mean_score,
            )
            if key not in annotation_summaries_by_key:
                annotation_summaries_by_key[key] = []
            annotation_summaries_by_key[key].append(gql_summary)
        return [
            sorted(
                annotation_summaries_by_key.get(key, []),
                key=lambda summary: summary.annotation_name,
            )
            for key in keys
        ]
