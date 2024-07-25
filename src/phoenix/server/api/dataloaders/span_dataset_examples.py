from typing import (
    AsyncContextManager,
    Callable,
    List,
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models

SpanID: TypeAlias = int
Key: TypeAlias = SpanID
Result: TypeAlias = List[models.DatasetExample]


class SpanDatasetExamplesDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        span_ids = keys
        async with self._db() as session:
            dataset_examples = {span_id: [] for span_id in span_ids}
            async for span_id, dataset_example in await session.stream(
                select(models.Span.id, models.DatasetExample)
                .select_from(models.Span)
                .join(models.DatasetExample, models.DatasetExample.span_rowid == models.Span.id)
                .where(models.Span.id.in_(span_ids))
            ):
                dataset_examples[span_id].append(dataset_example)
        return [dataset_examples.get(span_id, []) for span_id in span_ids]
