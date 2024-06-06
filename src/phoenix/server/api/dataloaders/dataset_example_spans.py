from typing import (
    AsyncContextManager,
    Callable,
    List,
    Optional,
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, load_only
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.Span import Span, to_gql_span

ExampleID: TypeAlias = int
Key: TypeAlias = ExampleID
Result: TypeAlias = Optional[Span]


class DatasetExampleSpansDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        example_ids = keys
        async with self._db() as session:
            spans = {
                example.id: span if (span := example.span) else None
                async for example in await session.stream_scalars(
                    select(models.DatasetExample)
                    .options(
                        load_only(models.DatasetExample.id), joinedload(models.DatasetExample.span)
                    )
                    .where(models.DatasetExample.id.in_(example_ids))
                )
            }
        return [
            to_gql_span(span) if (span := spans.get(example_id)) else None
            for example_id in example_ids
        ]
