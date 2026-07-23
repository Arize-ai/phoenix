from collections import defaultdict
from typing import Optional

from aioitertools.itertools import groupby
from sqlalchemy import func, or_, select, tuple_
from strawberry.dataloader import AbstractCache, DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
AnnotationName: TypeAlias = str
Key: TypeAlias = tuple[ExperimentID, AnnotationName]
Result: TypeAlias = list[tuple[str, float]]


class ExperimentAnnotationLabelFractionsDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
        cache_map: Optional[AbstractCache[Key, Result]] = None,
    ) -> None:
        super().__init__(load_fn=self._load_fn, cache_map=cache_map)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        label_fraction_sums_by_key: defaultdict[Key, defaultdict[str, float]] = defaultdict(
            lambda: defaultdict(float)
        )
        result_entity_counts_by_key: defaultdict[Key, int] = defaultdict(int)
        label_counts_query = (
            select(
                models.ExperimentRun.experiment_id.label("experiment_id"),
                models.ExperimentRun.dataset_example_id.label("dataset_example_id"),
                models.ExperimentRunAnnotation.name.label("annotation_name"),
                models.ExperimentRunAnnotation.label.label("label"),
                func.count().label("label_count"),
            )
            .select_from(models.ExperimentRunAnnotation)
            .join(
                models.ExperimentRun,
                models.ExperimentRunAnnotation.experiment_run_id == models.ExperimentRun.id,
            )
            .where(
                tuple_(
                    models.ExperimentRun.experiment_id,
                    models.ExperimentRunAnnotation.name,
                ).in_(set(keys))
            )
            .where(models.ExperimentRunAnnotation.error.is_(None))
            .where(
                or_(
                    models.ExperimentRunAnnotation.score.is_not(None),
                    models.ExperimentRunAnnotation.label.is_not(None),
                )
            )
            .group_by(
                models.ExperimentRun.experiment_id,
                models.ExperimentRun.dataset_example_id,
                models.ExperimentRunAnnotation.name,
                models.ExperimentRunAnnotation.label,
            )
            .order_by(
                models.ExperimentRun.experiment_id,
                models.ExperimentRunAnnotation.name,
                models.ExperimentRun.dataset_example_id,
                models.ExperimentRunAnnotation.label,
            )
        )
        async with self._db.read() as session:
            label_count_rows = await session.stream(label_counts_query)
            # Match `annotation_summaries.py`: normalize repeated labels within
            # each dataset example, then average across every result-bearing
            # example, including examples whose successful result has no label.
            async for entity_key, entity_rows in groupby(
                label_count_rows,
                lambda row: (
                    row.experiment_id,
                    row.annotation_name,
                    row.dataset_example_id,
                ),
            ):
                key = (entity_key[0], entity_key[1])
                result_entity_counts_by_key[key] += 1
                label_counts = {
                    row.label: int(row.label_count) for row in entity_rows if row.label is not None
                }
                total_label_count = sum(label_counts.values())
                if total_label_count:
                    for label, count in label_counts.items():
                        label_fraction_sums_by_key[key][label] += count / total_label_count
        return [
            [
                (label, fraction_sum / result_entity_count)
                for label, fraction_sum in sorted(label_fraction_sums_by_key[key].items())
            ]
            if (result_entity_count := result_entity_counts_by_key[key])
            else []
            for key in keys
        ]
