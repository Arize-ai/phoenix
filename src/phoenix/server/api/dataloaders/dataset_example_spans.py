from typing import (
    List,
    Optional,
)

from sqlalchemy import select
from sqlalchemy.orm import joinedload
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExampleID: TypeAlias = int
Key: TypeAlias = ExampleID
Result: TypeAlias = Optional[models.Span]


class DatasetExampleSpansDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        example_ids = keys
        async with self._db() as session:
            spans = {
                example_id: span
                async for example_id, span in await session.stream(
                    select(models.DatasetExample.id, models.Span)
                    .select_from(models.DatasetExample)
                    .join(models.Span, models.DatasetExample.span_rowid == models.Span.id)
                    .where(models.DatasetExample.id.in_(example_ids))
                    .options(
                        joinedload(models.Span.trace, innerjoin=True).load_only(
                            models.Trace.trace_id
                        )
                    )
                )
            }
        return [spans.get(example_id) for example_id in example_ids]
