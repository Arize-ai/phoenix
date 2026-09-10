from collections import defaultdict
from typing import Union

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.online_eval.tracing import EVALUATOR_TRACE_ID_METADATA_KEY
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = str
EvaluatorResultAnnotation: TypeAlias = Union[
    models.SpanAnnotation,
    models.TraceAnnotation,
    models.ProjectSessionAnnotation,
]
Result: TypeAlias = list[EvaluatorResultAnnotation]


class EvaluatorResultAnnotationsDataLoader(DataLoader[Key, Result]):
    """Loads target annotations keyed by the evaluator trace that produced them."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        annotations_by_trace_id: defaultdict[Key, Result] = defaultdict(list)
        async with self._db.read() as session:
            async for annotation in await session.stream_scalars(
                select(models.SpanAnnotation)
                .where(
                    models.SpanAnnotation.metadata_[EVALUATOR_TRACE_ID_METADATA_KEY]
                    .as_string()
                    .in_(keys)
                )
                .order_by(models.SpanAnnotation.id)
            ):
                trace_id = annotation.metadata_.get(EVALUATOR_TRACE_ID_METADATA_KEY)
                if isinstance(trace_id, str):
                    annotations_by_trace_id[trace_id].append(annotation)

            async for annotation in await session.stream_scalars(
                select(models.TraceAnnotation)
                .where(
                    models.TraceAnnotation.metadata_[EVALUATOR_TRACE_ID_METADATA_KEY]
                    .as_string()
                    .in_(keys)
                )
                .order_by(models.TraceAnnotation.id)
            ):
                trace_id = annotation.metadata_.get(EVALUATOR_TRACE_ID_METADATA_KEY)
                if isinstance(trace_id, str):
                    annotations_by_trace_id[trace_id].append(annotation)

            async for annotation in await session.stream_scalars(
                select(models.ProjectSessionAnnotation)
                .where(
                    models.ProjectSessionAnnotation.metadata_[EVALUATOR_TRACE_ID_METADATA_KEY]
                    .as_string()
                    .in_(keys)
                )
                .order_by(models.ProjectSessionAnnotation.id)
            ):
                trace_id = annotation.metadata_.get(EVALUATOR_TRACE_ID_METADATA_KEY)
                if isinstance(trace_id, str):
                    annotations_by_trace_id[trace_id].append(annotation)

        return [annotations_by_trace_id[key] for key in keys]
