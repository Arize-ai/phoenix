from typing import (
    Dict,
    List,
)

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanID: TypeAlias = int
Key: TypeAlias = SpanID
Result: TypeAlias = List[models.DatasetExample]


class SpanDatasetExamplesDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        span_rowids = keys
        async with self._db() as session:
            dataset_examples: Dict[Key, List[models.DatasetExample]] = {
                span_rowid: [] for span_rowid in span_rowids
            }
            async for span_rowid, dataset_example in await session.stream(
                select(models.Span.id, models.DatasetExample)
                .select_from(models.Span)
                .join(models.DatasetExample, models.DatasetExample.span_rowid == models.Span.id)
                .where(models.Span.id.in_(span_rowids))
            ):
                dataset_examples[span_rowid].append(dataset_example)
        return [dataset_examples.get(span_rowid, []) for span_rowid in span_rowids]
